extends Node3D

signal zone_changed(zone: String)
signal object_hovered(id: String)
signal object_clicked(id: String)

const BACK_BAND := 0.15
const MIN_BOX := 0.15
const PAD := 0.03
const HOVER_LOCK_FRAC := 0.05

const ZONE_TAG := "zone:"
const OBJ_TAG := "obj:"
const NO_LOOK := "nolookat"

const ZONES := {
	"main": {"marker": "main", "parent": "", "area": ""},
	"setup": {"marker": "setup", "parent": "main", "area": "setupzone"},
	"pc-screen": {"marker": "pc-screen", "parent": "setup", "area": "monitor"},
	"bed": {"marker": "bed", "parent": "main", "area": "bedzone"},
	"tv": {"marker": "tv", "parent": "main", "area": "tvzone"},
	"tv-screen": {"marker": "tv-screen", "parent": "tv", "area": "tv"},
}

var zone := ""
var hovered := ""
var hovered_zone := ""
var blocked := false
var locked := {"pc-screen": true, "tv-screen": true}

@onready var cam: Camera3D = $camera
@onready var markers: Node3D = $markers

var _boxes := {}
var _of_zone := {}
var _areas := {}
var _nolook := {}
var _hot := []
var _at := Vector3.ZERO
var _back := false
var _hover_hot := {}
var _hover_mouse := Vector2.ZERO
var _hover_locked := false


func _ready() -> void:
	for node in get_children():
		var mesh := node as VisualInstance3D
		if mesh == null:
			continue
		var id := _tag(mesh, OBJ_TAG)
		if id == "":
			continue
		if not _boxes.has(id):
			_boxes[id] = []
			_of_zone[id] = _tags(mesh, ZONE_TAG)
		if mesh.is_in_group(NO_LOOK):
			_nolook[id] = true
		_boxes[id].append(_box(mesh))
	var override := {}
	for node in get_children():
		var shape := node as CollisionShape3D
		if shape == null or shape.disabled:
			continue
		var id := _tag(shape, OBJ_TAG)
		if id == "":
			continue
		if not override.has(id):
			override[id] = true
			_boxes[id] = []
		_boxes[id].append(_cube(shape))
		if shape.is_in_group(NO_LOOK):
			_nolook[id] = true
		var zs := _tags(shape, ZONE_TAG)
		if not zs.is_empty() or not _of_zone.has(id):
			_of_zone[id] = zs
	for z in ZONES:
		var area: String = ZONES[z].area
		var shape := get_node_or_null(NodePath(area)) as CollisionShape3D
		if shape != null:
			_boxes[area] = [_cube(shape)]
		elif _of_zone.has(area):
			_areas[area] = true
	goto_zone("main", true)


func goto_zone(to: String, instant := false) -> void:
	if not ZONES.has(to) or to == zone:
		return
	zone = to
	_hot.clear()
	_hover_locked = false
	for z in ZONES:
		var area: String = ZONES[z].area
		if ZONES[z].parent != zone or not _boxes.has(area):
			continue
		var obj: String = area if _areas.has(area) else ""
		_hot.append({"boxes": _boxes[area], "zone": z, "obj": obj, "look": _looks(obj)})
	for id in _of_zone:
		if _of_zone[id].has(zone) and not _areas.has(id):
			_hot.append({"boxes": _boxes[id], "zone": "", "obj": id, "look": _looks(id)})
	var m: Marker3D = markers.get_node(ZONES[zone].marker)
	if instant:
		cam.zone_pos = m.global_position
		cam.zone_rot = m.global_basis
		cam.global_transform = m.global_transform
	else:
		cam.set_zone(m.global_position, m.global_basis)
	zone_changed.emit(zone)


func back() -> void:
	var up: String = ZONES[zone].parent
	if up != "":
		goto_zone(up)


func _process(_delta: float) -> void:
	var m := get_viewport().get_mouse_position()
	_back = not blocked and ZONES[zone].parent != "" and _in_band(m)

	var hot: Dictionary
	if _back or blocked:
		hot = {}
		_hover_locked = false
	elif _hover_locked and not _lock_broken(m):
		hot = _hover_hot
	else:
		hot = _pick(m)
		_hover_locked = not hot.is_empty()
		_hover_mouse = m
	_hover_hot = hot

	var obj: String = hot.get("obj", "")
	var zn: String = hot.get("zone", "")
	if obj != hovered or zn != hovered_zone:
		hovered = obj
		hovered_zone = zn
		object_hovered.emit(hovered)
	cam.set_hover(hot.get("look", false), _at)

	Input.set_default_cursor_shape(
		Input.CURSOR_POINTING_HAND if (_back or not hot.is_empty()) else Input.CURSOR_ARROW
	)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if blocked:
			return
		if _back:
			back()
		elif hovered_zone != "" and not locked.get(hovered_zone, false):
			goto_zone(hovered_zone)
		elif hovered != "":
			object_clicked.emit(hovered)


func _looks(id: String) -> bool:
	return id != "" and not _nolook.has(id)


func _tags(node: Node, prefix: String) -> Array:
	var out := []
	for g in node.get_groups():
		var s := String(g)
		if s.begins_with(prefix):
			out.append(s.substr(prefix.length()))
	return out


func _tag(node: Node, prefix: String) -> String:
	var found := _tags(node, prefix)
	return found[0] if not found.is_empty() else ""


func _in_band(m: Vector2) -> bool:
	var w := get_viewport().get_visible_rect().size.x
	return m.x < w * BACK_BAND or m.x > w * (1.0 - BACK_BAND)


func _lock_broken(m: Vector2) -> bool:
	var vp := get_viewport().get_visible_rect().size
	return m.distance_to(_hover_mouse) > minf(vp.x, vp.y) * HOVER_LOCK_FRAC


func _pick(m: Vector2) -> Dictionary:
	var from := cam.project_ray_origin(m)
	var dir := cam.project_ray_normal(m)
	var best := INF
	var found := {}
	for hot in _hot:
		for box in hot.boxes:
			var hit = (box as AABB).intersects_ray(from, dir)
			if hit == null:
				continue
			var d: float = from.distance_to(hit)
			if d < best:
				best = d
				found = hot
				_at = (box as AABB).get_center()
	return found


func _corners(t: Transform3D, at: Vector3, size: Vector3) -> AABB:
	var out := AABB(t * at, Vector3.ZERO)
	for c in 8:
		out = out.expand(t * (at + size * Vector3(c & 1, (c >> 1) & 1, (c >> 2) & 1)))
	return out


func _cube(node: CollisionShape3D) -> AABB:
	var size: Vector3 = (node.shape as BoxShape3D).size
	return _corners(node.global_transform, size * -0.5, size)


func _box(node: VisualInstance3D) -> AABB:
	var b := node.get_aabb()
	var out := _corners(node.global_transform, b.position, b.size).grow(PAD)
	var pos := out.position
	var size := out.size
	for a in 3:
		if size[a] < MIN_BOX:
			pos[a] -= (MIN_BOX - size[a]) * 0.5
			size[a] = MIN_BOX
	return AABB(pos, size)
