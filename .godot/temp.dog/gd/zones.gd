extends Node3D

signal zone_changed(zone: String)
signal object_hovered(id: String)
signal object_clicked(id: String)

const BACK_BAND := 0.15
const MIN_BOX := 0.15
const PAD := 0.03

const ZONE_TAG := "zone:"
const OBJ_TAG := "obj:"

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
var locked := {"pc-screen": true, "tv-screen": true}

@onready var cam: Camera3D = $camera
@onready var markers: Node3D = $markers

var _boxes := {}
var _of_zone := {}
var _areas := {}
var _hot := []
var _at := Vector3.ZERO
var _back := false


func _ready() -> void:
	for node in get_children():
		if node is not VisualInstance3D:
			continue
		var id := ""
		var z := ""
		for g in node.get_groups():
			var s := String(g)
			if s.begins_with(OBJ_TAG):
				id = s.substr(OBJ_TAG.length())
			elif s.begins_with(ZONE_TAG):
				z = s.substr(ZONE_TAG.length())
		if id == "":
			continue
		if not _boxes.has(id):
			_boxes[id] = []
			_of_zone[id] = z
		_boxes[id].append(_box(node))
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
	for z in ZONES:
		var area: String = ZONES[z].area
		if ZONES[z].parent != zone or not _boxes.has(area):
			continue
		_hot.append({"boxes": _boxes[area], "zone": z, "obj": area if _areas.has(area) else ""})
	for id in _of_zone:
		if _of_zone[id] == zone and not _areas.has(id):
			_hot.append({"boxes": _boxes[id], "zone": "", "obj": id})
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
	_back = ZONES[zone].parent != "" and _in_band(m)

	var hot: Dictionary = {} if _back else _pick(m)
	var obj: String = hot.get("obj", "")
	var zn: String = hot.get("zone", "")
	if obj != hovered or zn != hovered_zone:
		hovered = obj
		hovered_zone = zn
		object_hovered.emit(hovered)
	cam.set_hover(obj != "", _at)

	Input.set_default_cursor_shape(
		Input.CURSOR_POINTING_HAND if (_back or not hot.is_empty()) else Input.CURSOR_ARROW
	)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if _back:
			back()
		elif hovered_zone != "" and not locked.get(hovered_zone, false):
			goto_zone(hovered_zone)
		elif hovered != "":
			object_clicked.emit(hovered)


func _in_band(m: Vector2) -> bool:
	var w := get_viewport().get_visible_rect().size.x
	return m.x < w * BACK_BAND or m.x > w * (1.0 - BACK_BAND)


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
