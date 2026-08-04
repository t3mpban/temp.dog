#!/usr/bin/env python3
"""Generate scripts/scene.json and images/game/*.webp from the Godot project."""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GODOT = ROOT / ".godot" / "temp.dog"
SCENE = GODOT / "tscn" / "scene.tscn"
OUT_JSON = ROOT / "scripts" / "scene.json"
OUT_IMG = ROOT / "images" / "game"

HEADER = re.compile(r"^\[(gd_scene|gd_resource|ext_resource|sub_resource|node|resource)\b(.*)\]\s*$")
ATTR = re.compile(r'(\w+)=("(?:[^"\\]|\\.)*"|\[[^\]]*\]|[^\s\]]+)')
PROP = re.compile(r"^([\w/]+) = (.*)$")
VEC = re.compile(r"^\w+\(([^)]*)\)$")
REF = re.compile(r'^(?:Ext|Sub)Resource\("([^"]+)"\)$')


def unquote(text):
    return text[1:-1] if text.startswith('"') else text


def numbers(text):
    match = VEC.match(text.strip())
    return [float(n) for n in match.group(1).split(",")] if match else []


def blocks(path):
    """Yield (kind, attrs, props) for each block, tolerating multi-line strings."""
    out = []
    kind = attrs = None
    body = []
    open_string = False
    for line in path.read_text().splitlines():
        head = None if open_string else HEADER.match(line)
        if head:
            if kind:
                out.append((kind, attrs, body))
            kind = head.group(1)
            attrs = {k: unquote(v) for k, v in ATTR.findall(head.group(2))}
            body = []
        elif kind:
            body.append(line)
        if line.count('"') % 2:
            open_string = not open_string
    if kind:
        out.append((kind, attrs, body))
    return [(k, a, props(b)) for k, a, b in out]


def props(body):
    out = {}
    open_string = False
    for line in body:
        if not open_string:
            match = PROP.match(line)
            if match:
                out[match.group(1)] = match.group(2)
        if line.count('"') % 2:
            open_string = not open_string
    return out


def clean(value):
    value = round(value, 6)
    return 0 if value == 0 else value


def transform(text):
    """Godot lays a Transform3D out as basis rows then origin."""
    return [clean(n) for n in numbers(text)]


def hexcolor(text):
    r, g, b = numbers(text)[:3]
    return "#%02x%02x%02x" % tuple(round(c * 255) for c in (r, g, b))


def groups(attrs):
    raw = attrs.get("groups", "")
    return re.findall(r'"([^"]+)"', raw)


def material(path):
    """Read a .tres into {"map": name} or {"color": hex}."""
    textures = {}
    body = {}
    for kind, attrs, fields in blocks(path):
        if kind == "ext_resource":
            textures[attrs["id"]] = Path(attrs["path"]).stem
        elif kind == "sub_resource":
            stem = Path(unquote(fields["load_path"])).name
            textures[attrs["id"]] = stem[: stem.index(".png-")]
        elif kind == "resource":
            body = fields
    if "albedo_texture" in body:
        ref = REF.match(body["albedo_texture"])
        return {"map": textures[ref.group(1)]}
    return {"color": hexcolor(body["albedo_color"])}


def build_scene():
    resources = {}
    subs = {}
    scene = {"markers": {}, "mats": {}, "meshes": [], "boxes": [], "labels": []}
    seen = set()

    for kind, attrs, fields in blocks(SCENE):
        if kind == "ext_resource":
            resources[attrs["id"]] = attrs["path"]
        elif kind == "sub_resource":
            subs[attrs["id"]] = (attrs["type"], fields)

    def mat(text):
        ref = REF.match(text)
        name = Path(resources[ref.group(1)]).stem
        if name not in scene["mats"]:
            scene["mats"][name] = material(GODOT / resources[ref.group(1)][len("res://") :])
        return name

    for kind, attrs, fields in blocks(SCENE):
        if kind != "node":
            continue
        name = attrs["name"]
        kind = attrs.get("type", "")
        tag = groups(attrs)

        if kind == "Camera3D":
            env = subs[REF.match(fields["environment"]).group(1)][1]
            scene["camera"] = {
                "t": transform(fields["transform"]),
                "fov": float(fields.get("fov", 75)),
                "bg": hexcolor(env["background_color"]),
            }
        elif kind == "Marker3D":
            scene["markers"][name] = transform(fields["transform"])
        elif kind == "CollisionShape3D":
            shape = subs[REF.match(fields["shape"]).group(1)][1]
            scene["boxes"].append(
                {
                    "n": name,
                    "t": transform(fields["transform"]),
                    "size": [clean(n) for n in numbers(shape["size"])],
                    "g": tag,
                    "off": fields.get("disabled") == "true",
                }
            )
        elif kind == "Label3D":
            scene["labels"].append(
                {
                    "n": name,
                    "t": transform(fields["transform"]),
                    "px": float(fields.get("pixel_size", 0.01)),
                    "font": int(fields.get("font_size", 32)),
                    "w": float(fields.get("width", 500)),
                    "align": [
                        int(fields.get("horizontal_alignment", 1)),
                        int(fields.get("vertical_alignment", 1)),
                    ],
                    "color": hexcolor(fields.get("modulate", "Color(1, 1, 1, 1)")),
                    "g": tag,
                }
            )
        elif kind == "MeshInstance3D":
            geo, shape = subs[REF.match(fields["mesh"]).group(1)]
            entry = {
                "n": name,
                "t": transform(fields["transform"]),
                "geo": "box" if geo == "BoxMesh" else "quad",
                "mat": mat(fields["material_override"]) if "material_override" in fields else None,
                "g": tag,
            }
            if entry["geo"] == "box":
                entry["size"] = [clean(n) for n in numbers(shape["size"])]
            if fields.get("visible") == "false":
                entry["vis"] = False
            for key in ("day", "night"):
                if "metadata/" + key in fields:
                    entry[key] = mat(fields["metadata/" + key])
            fingerprint = json.dumps({k: v for k, v in entry.items() if k != "n"}, sort_keys=True)
            if fingerprint in seen:
                continue
            seen.add(fingerprint)
            scene["meshes"].append(entry)

    return scene


def encode(src, dest, tile=None):
    args = ["ffmpeg", "-y", "-v", "error"]
    if tile:
        args += ["-i", str(src), "-filter_complex", "tile=" + tile, "-frames:v", "1"]
    else:
        args += ["-i", str(src)]
    args += ["-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", str(dest)]
    subprocess.run(args, check=True)


def build_images(scene):
    if OUT_IMG.exists():
        shutil.rmtree(OUT_IMG)
    OUT_IMG.mkdir(parents=True)
    total = 0
    for entry in scene["mats"].values():
        name = entry.get("map")
        if not name:
            continue
        if name.startswith("frame"):
            entry["map"] = "tv-frames"
            entry["frames"] = len(list((GODOT / "anim").glob("*.png")))
            encode(GODOT / "anim" / "frame%04d.png", OUT_IMG / "tv-frames.webp", "1x8")
        else:
            encode(GODOT / "pngs" / (name + ".png"), OUT_IMG / (name + ".webp"))
        total += 1
    return total


def main():
    scene = build_scene()
    count = build_images(scene)
    OUT_JSON.write_text(json.dumps(scene, separators=(",", ":")) + "\n")
    size = sum(f.stat().st_size for f in OUT_IMG.iterdir())
    print(
        "%d meshes, %d boxes, %d labels, %d markers, %d materials"
        % (
            len(scene["meshes"]),
            len(scene["boxes"]),
            len(scene["labels"]),
            len(scene["markers"]),
            len(scene["mats"]),
        )
    )
    print("%s  %.1f KB" % (OUT_JSON.relative_to(ROOT), OUT_JSON.stat().st_size / 1024))
    print("%d textures  %.1f KB" % (count, size / 1024))


if __name__ == "__main__":
    sys.exit(main())
