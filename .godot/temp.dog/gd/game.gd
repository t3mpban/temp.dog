extends Node3D

const END := "free-the-end"
const WEB_ONLY := ["hello-world", "honey-im-home", "interstellar", "multilingual"]
const TOPICS := ["password", "guitar", "remote"]
const ANIM_DIR := "res://anim"
const TV_FPS := 4.0
const PLAY_HOLD := 2.0

@onready var zones := get_parent()

var pc_on := false
var tv_on := false
var tv_audio := false
var coin := false
var ram_stolen := false
var guitar_learned := false
var chair_clicks := 0
var shelf_reads := 0
var rug_reads := 0
var plays := {"before": 0, "after": 0}
var knowledge := {}
var done := {}

var _roles := {}
var _frames := []
var _frame := 0.0
var _tick := 1.0
var _sky_key := ""


func _ready() -> void:
	zones.object_clicked.connect(_on_clicked)
	zones.object_hovered.connect(_on_hovered)
	zones.zone_changed.connect(_on_zone)
	_frames = _load_frames()
	_role("cmd").ach.connect(award)
	_set_tv(false)


func _process(delta: float) -> void:
	_tick += delta
	if _tick >= 1.0:
		_tick = 0.0
		_role("clock").text = Uk.face()
		_sky()
	if not tv_on or _frames.is_empty():
		return
	_frame = fmod(_frame + delta * TV_FPS, float(_frames.size()))
	_role("tvframes").material_override.albedo_texture = _frames[int(_frame)]


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_F1:
		for id in WEB_ONLY:
			award(id)


func award(id: String, value := -1) -> void:
	var next: int = value if value >= 0 else Js.goal(id)
	if next <= int(done.get(id, 0)):
		return
	done[id] = next
	Js.achievement(id, value)
	if id != END:
		award(END, mini(_beaten(), Js.goal(END) - 1))


func _on_clicked(id: String) -> void:
	zones.blocked = true
	await _act(id)
	zones.blocked = false


func _on_hovered(id: String) -> void:
	Js.tooltip(id)
	if tv_on and (id == "tv") != tv_audio:
		tv_audio = id == "tv"
		Js.sound("tv", "in" if tv_audio else "out")


func _on_zone(zone: String) -> void:
	_role("cmd").captured = zone == "pc-screen"


func _act(id: String) -> void:
	match id:
		"pc":
			await _pc()
		"monitor":
			_monitor()
		"monitor2":
			Js.textbox("monitor2-on" if pc_on else "monitor2-off")
		"tv":
			_tv()
		"chair":
			chair_clicks = mini(chair_clicks + 1, 8)
			Js.textbox("chair-%d" % chair_clicks)
			award("chair", chair_clicks)
		"shelf":
			shelf_reads = mini(shelf_reads + 1, 3)
			Js.textbox("shelf-%d" % shelf_reads)
		"rug":
			_rug()
		"marketableplush":
			await _plush()
		"guitar":
			await _guitar()
		"bed":
			_bed()
		"clock":
			Js.textbox("clock", {"time": Uk.words()})
		"window":
			Js.textbox("window-" + Uk.band())
		"mouse":
			Js.textbox("mouse")
			award("mouse-ception")
		_:
			Js.textbox(id)


func _pc() -> void:
	Js.textbox("pc-on" if pc_on else "pc-off")
	var pick := await Js.choice("pc-on", ["yes", "no"] if ram_stolen else [])
	match pick:
		"yes":
			pc_on = not pc_on
			Js.textbox("pc-off-yes" if pc_on else "pc-on-yes")
			_role("cmd").power(pc_on)
		"no":
			Js.textbox("pc-on-no" if pc_on else "pc-off-no")
		"ram":
			ram_stolen = true
			Js.textbox("pc-ram")
			award("thief")


func _monitor() -> void:
	if pc_on:
		zones.goto_zone("pc-screen")
	else:
		Js.textbox("monitor-off")


func _tv() -> void:
	if not tv_on:
		Js.textbox("tv-off")
		return
	zones.goto_zone("tv-screen")
	Js.textbox("tv-on")


func _rug() -> void:
	rug_reads = mini(rug_reads + 1, 3)
	Js.textbox("rug-%d" % rug_reads)
	if rug_reads == 1:
		coin = true
		award("money")
	elif rug_reads == 3:
		award("carpet")


func _bed() -> void:
	if _beaten() < Js.goal(END):
		Js.textbox("bed-busy-%d" % (randi() % 4 + 1))
		return
	award(END, Js.goal(END))
	print('location.href = "/the-end"')


func _plush() -> void:
	Js.textbox("plush-open-%d" % (randi() % 5 + 1))
	Js.textbox("plush-interact")
	if await Js.choice("plush-interact") != "go":
		return
	var left := _topics()
	if left.is_empty():
		Js.textbox("plush-empty")
		_learn("empty")
		return
	Js.textbox("plush-topics")
	var pick: String = left[0]
	if left.size() > 1:
		pick = await Js.choice("plush-topics", left)
	_ask(pick)


func _ask(topic: String) -> void:
	if topic == "donate" and not coin:
		Js.textbox("plush-donate")
		return
	Js.textbox("plush-" + ("donate-coin" if topic == "donate" else topic))
	_learn(topic)
	match topic:
		"guitar":
			guitar_learned = true
			award("fast-learner")
		"remote":
			_set_tv(true)
			award("tv-on")
		"donate":
			award("philanthropist")


func _learn(key: String) -> void:
	knowledge[key] = true
	award("marketable-plush", knowledge.size())


func _topics() -> Array:
	return (TOPICS + ["donate"]).filter(func(t): return not knowledge.has(t))


func _guitar() -> void:
	var stage := "after" if guitar_learned else "before"
	Js.textbox("guitar-" + stage)
	if await Js.choice("guitar-play") != "yes":
		return
	plays[stage] = mini(plays[stage] + 1, 3 if guitar_learned else 2)
	_hold_guitar(false)
	Js.sound("wear.ogg")
	Js.textbox("guitar-%s-play-%d" % [stage, plays[stage]])
	await get_tree().create_timer(PLAY_HOLD).timeout
	_hold_guitar(true)


func _hold_guitar(shown: bool) -> void:
	for node in get_tree().get_nodes_in_group("obj:guitar"):
		node.visible = shown


func _beaten() -> int:
	var n := 0
	for id in Js.ids("achievements"):
		if id != END and int(done.get(id, 0)) >= Js.goal(id):
			n += 1
	return n


func _set_tv(on: bool) -> void:
	tv_on = on
	_role("tvframes").visible = on


func _sky() -> void:
	var key := "day" if Uk.is_day() else "night"
	if key == _sky_key:
		return
	_sky_key = key
	for node in get_tree().get_nodes_in_group("role:sky"):
		node.material_override = node.get_meta(key)


func _load_frames() -> Array:
	var names := Array(DirAccess.get_files_at(ANIM_DIR)).filter(
		func(f): return f.ends_with(".png")
	)
	names.sort()
	return names.map(func(f): return load(ANIM_DIR + "/" + f))


func _role(name: String) -> Node:
	if not _roles.has(name):
		_roles[name] = get_tree().get_first_node_in_group("role:" + name)
	return _roles[name]
