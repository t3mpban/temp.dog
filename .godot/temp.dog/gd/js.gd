class_name Js

const SOURCE := "../../scripts/script.json"

static var busy := false

static var _data := {}


static func textbox(ref: String, vars := {}) -> void:
	_check("dialogue", ref)
	if vars.is_empty():
		print('textbox("%s")' % ref)
	else:
		print('textbox("%s", %s)' % [ref, _vars(vars)])


static func choice(ref: String, only := []) -> String:
	_check("choices", ref)
	var opts := _options(ref, only)
	if opts.size() == _options(ref, []).size():
		print('choice("%s")' % ref)
	else:
		print('choice("%s", %s)' % [ref, _vars_list(only)])
	if opts.size() < 2:
		push_warning('choice: "%s" needs 2-4 options' % ref)
	for i in opts.size():
		print("  [%d] %s" % [i + 1, opts[i].text])
	busy = true
	var picked := await _key(opts.size())
	busy = false
	print('  -> "%s"' % opts[picked].id)
	return opts[picked].id


static func achievement(id: String, value := -1) -> void:
	_check("achievements", id)
	if value < 0:
		print('achievement("%s")' % id)
	else:
		print('achievement("%s", %d)' % [id, value])


static func tooltip(text: String) -> void:
	print("tooltip(null)" if text == "" else 'tooltip("%s")' % text)


static func sound(name: String, fade := "") -> void:
	if fade == "":
		print('sound("%s")' % name)
	else:
		print('sound("%s", "%s")' % [name, fade])


static func ids(section: String) -> Array:
	return _load().get(section, {}).keys()


static func goal(id: String) -> int:
	return _load().get("achievements", {}).get(id, 1)


static func _key(n: int) -> int:
	var loop := Engine.get_main_loop() as SceneTree
	while true:
		await loop.process_frame
		for i in n:
			if Input.is_key_pressed(KEY_1 + i):
				while Input.is_key_pressed(KEY_1 + i):
					await loop.process_frame
				return i
	return 0


static func _options(ref: String, only: Array) -> Array:
	var opts: Array = _load().get("choices", {}).get(ref, [])
	if only.is_empty():
		return opts
	return opts.filter(func(o): return only.has(o.id))


static func _vars(vars: Dictionary) -> String:
	var parts := []
	for k in vars:
		parts.append('%s: "%s"' % [k, vars[k]])
	return "{ " + ", ".join(parts) + " }"


static func _vars_list(only: Array) -> String:
	return '["' + '", "'.join(only) + '"]'


static func _check(section: String, ref: String) -> void:
	var data := _load()
	if data.is_empty():
		return
	if not data.get(section, {}).has(ref):
		push_warning('%s: unknown id "%s"' % [section, ref])


static func _load() -> Dictionary:
	if not _data.is_empty():
		return _data
	var path := ProjectSettings.globalize_path("res://") + SOURCE
	var text := FileAccess.get_file_as_string(path)
	if text == "":
		push_warning("js: could not read " + path)
		return _data
	var json = JSON.parse_string(text)
	if typeof(json) != TYPE_DICTIONARY:
		push_warning("js: malformed " + path)
		return _data
	_data = {"dialogue": {}, "choices": {}, "achievements": {}}
	for entry in json.get("dialogue", []):
		_data.dialogue[entry.id] = true
	for entry in json.get("achievements", []):
		_data.achievements[entry.id] = entry.get("goal", 1) if entry.type == "progress" else 1
	for entry in json.get("choices", []):
		_data.choices[entry.id] = entry.options.map(
			func(o): return {"id": o.id, "text": _en(o.text)}
		)
	return _data


static func _en(strings: Array) -> String:
	for s in strings:
		if s.lang == "en":
			return s.text
	return ""
