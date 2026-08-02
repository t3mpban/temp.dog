extends Camera3D

const BEZ := Vector4(0.87, 0.0, 0.13, 1.0)
const TRANS_TIME := 1.2

const SHAKE_SPEED := 0.2
const SHAKE_ROT := 0.4
const SHAKE_POS := 0.01

const CURSOR_ROT := 3.0
const CURSOR_CLAMP := 1.0
const CURSOR_EASE := 3.0

const HOVER_BLEND := 0.3
const HOVER_EASE := 4.0

var zone_pos := Vector3.ZERO
var zone_rot := Basis.IDENTITY

var _from_pos := Vector3.ZERO
var _from_rot := Basis.IDENTITY
var _t := 1.0

var _cursor := Vector2.ZERO
var _hover_at := Vector3.ZERO
var _hover_to := Vector3.ZERO
var _hover_w := 0.0
var _hover := false

var _noise := FastNoiseLite.new()
var _time := 0.0


func _ready() -> void:
	_noise.noise_type = FastNoiseLite.TYPE_PERLIN
	_noise.frequency = 1.0
	_from_pos = zone_pos
	_from_rot = zone_rot


func set_zone(pos: Vector3, rot: Basis) -> void:
	var e := ease_bez(_t)
	_from_pos = _base_pos(e)
	_from_rot = _base_basis(e)
	zone_pos = pos
	zone_rot = rot
	_t = 0.0


func set_hover(on: bool, at: Vector3) -> void:
	_hover = on
	if on:
		_hover_to = at


func _process(delta: float) -> void:
	_time += delta
	if _t < 1.0:
		_t = minf(_t + delta / TRANS_TIME, 1.0)

	var viewport := get_viewport()
	var vp := viewport.get_visible_rect().size
	var m := viewport.get_mouse_position()
	var target := Vector2(m.x / vp.x * 2.0 - 1.0, m.y / vp.y * 2.0 - 1.0)
	target.x = clampf(target.x, -CURSOR_CLAMP, CURSOR_CLAMP)
	target.y = clampf(target.y, -CURSOR_CLAMP, CURSOR_CLAMP)
	_cursor = _cursor.lerp(target, minf(delta * CURSOR_EASE, 1.0))

	_hover_w = lerpf(_hover_w, HOVER_BLEND if _hover else 0.0, minf(delta * HOVER_EASE, 1.0))
	if _hover_w < 0.005:
		_hover_at = _hover_to
	else:
		_hover_at = _hover_at.lerp(_hover_to, minf(delta * HOVER_EASE, 1.0))

	var e := ease_bez(_t)
	var base_pos := _base_pos(e)
	var basis_now := _base_basis(e)
	if _hover_w > 0.001:
		var dir := (_hover_at - base_pos).normalized()
		if dir.length_squared() > 0.5 and absf(dir.dot(Vector3.UP)) < 0.999:
			var look := Basis.looking_at(dir)
			basis_now = Basis(basis_now.get_rotation_quaternion().slerp(look.get_rotation_quaternion(), _hover_w))

	var shake := Vector3(
		_noise.get_noise_2d(_time * SHAKE_SPEED, 0.0),
		_noise.get_noise_2d(0.0, _time * SHAKE_SPEED),
		_noise.get_noise_2d(_time * SHAKE_SPEED, 100.0)
	)

	var cursor_rot := Vector3(-_cursor.y, -_cursor.x, 0.0) * deg_to_rad(CURSOR_ROT)
	global_position = base_pos + basis_now * shake * SHAKE_POS
	global_basis = (
		basis_now * Basis.from_euler(cursor_rot) * Basis.from_euler(shake * deg_to_rad(SHAKE_ROT))
	)


func _base_pos(e: float) -> Vector3:
	return _from_pos.lerp(zone_pos, e)


func _base_basis(e: float) -> Basis:
	return Basis(_from_rot.get_rotation_quaternion().slerp(zone_rot.get_rotation_quaternion(), e))


static func ease_bez(t: float) -> float:
	if t <= 0.0 or t >= 1.0:
		return clampf(t, 0.0, 1.0)
	var u := t
	for i in 5:
		var d := _bez_dx(u)
		if absf(d) < 0.000001:
			break
		u = clampf(u - (_bez(u, BEZ.x, BEZ.z) - t) / d, 0.0, 1.0)
	return _bez(u, BEZ.y, BEZ.w)


static func _bez(u: float, a: float, b: float) -> float:
	var v := 1.0 - u
	return 3.0 * v * v * u * a + 3.0 * v * u * u * b + u * u * u


static func _bez_dx(u: float) -> float:
	var v := 1.0 - u
	return 3.0 * v * v * BEZ.x + 6.0 * v * u * (BEZ.z - BEZ.x) + 3.0 * u * u * (1.0 - BEZ.z)
