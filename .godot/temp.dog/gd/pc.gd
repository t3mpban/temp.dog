extends Label3D

signal ach(id: String, value: int)
signal _line_done
signal _any_key

const MAX_LINES := 12
const CHAR_DELAY := 0.01
const PROMPT := "[temp@temp ~]$ "
const PASSWORD := "dogs100"

const BOOT_LOG := """[    0.000000] Command line: BOOT SEQ START
[    0.001842] CPU: AMD Ryzen 9 5950X 16-Core Processor detected
[    0.002104] CPU: 16 cores / 32 threads @ 3.4GHz base
[    0.014557] Memory: 64GB DDR4 available
[    0.021309] pci 0000:0a:00.0: NVIDIA GeForce RTX 4060 Ti detected
[    0.032881] nvidia: loading module...                          [  OK  ]
[    0.089213] Initializing cgroup subsys cpuset                  [  OK  ]
[    0.102456] Mounting /boot...                                  [  OK  ]
[    0.118732] Mounting /home...                                  [  OK  ]
[    0.203119] Starting Wayland compositor: Hyprland              [  OK  ]
[    0.240881] Starting PipeWire audio server                     [  OK  ]
[    0.251203] Starting WirePlumber session manager               [  OK  ]
[    0.302447] Loading Waybar                                     [  OK  ]
[    0.318992] Network Manager: eth0 up                           [  OK  ]
[    0.401337] Reached target Graphical Interface.                [  OK  ]
[    0.512004] Starting temp.dog message...                       [  OK  ]"""

const WELCOME := """Temp Linux [Version 26w31a]
Copyright (c) t3mp 2026. All rights reserved.

Welcome back, Temp!

Available commands: help, ls, <filename>, clr, ping
"""

const HELP := """ls lists all files
<filename> opens a file, e.g. dog
clr clears the screen
ping pongs
help prints this again!
"""

const LS_FILES := [
	"dog.png",
	"faq.txt",
	"idklol.mp4",
	"secret.txt",
	"secretgame.py",
	"theanswertolifetheuniverseandeverything.txt",
	"whatisthis.txt",
	"whoami.txt",
]

const WHOAMI_PAGES := [
	"(1/6)\nHi, my name is Temp! An awfully creative individual that, when paired with unlimited free time, can pretty much do anything I set my mind to (nerfed by ADHD tho, lol).",
	"(2/6)\nRecently, I quit video editing to pursue my dreams of game development and web design, and despite it being really scary at times, I've never felt better.",
	"(3/6)\nAs a kid who grew up on the internet, I found myself making games, music, art, videos, websites, and so much more, simply because I found it so enjoyable and fun to me.",
	"(4/6)\nSo, after finishing the hell that was high school, despite getting really good grades, I decided to follow my dreams, and that leads us to today.",
	"(5/6)\nLook, you may not know much about me now, but I promise you, and myself, that you will know me in the future. Then I can die peacefully, knowing I left my mark on the internet.",
	"(6/6)\nAnd before I sign off, I just want to thank you for stopping by my silly little website. You are awesome. Never forget where you've come from, and where you're going.\n\n- temp 29/07/26",
]

const WHATISTHIS_PAGES := [
	"What is this website for? (1/4)\n\nThis website was initially made for lurkers who like clicking on random links. I eventually decided to make a really awesome 3D WebGL game as my portfolio, as I think actions speak louder than words. Immean, what sane being creates an entire website with lore for their personal website. If this can't land me a job then nothing will.",
	"How did you make it? (2/4)\n\nThis website is purely made of HTML, CSS, and ThreeJS, and took about a month to complete. I've honestly never used ThreeJS before so I designed the website in Godot first, then \"converted\" it into ThreeJS, for better performance/compatibility. It was really fun to make, and I highly encourage others to make their own website!",
	"What else will you add? (3/4)\n\nI consider this website finished, though my /hireme page might be updated occasionally.",
	"I found a bug/glitch in your website! (4/4)\n\nPlease email me at hi@temp.dog (or reach out on Discord) and let me know!",
]

const SECRET_TEXT := """hey, it's me, temp. i've been coding this for like... hours and like im so tired rn but like hah im glad u enjoy my game, thank you so much for your time!

feel free to reach out to me to say hi, im really curious to meet someone like you...

also, yes this is a reference to nso, yes the credits was a reference to minecraft, and yes there are a lot more references scattered around this place heh

but fr tho ur awesome tysm for playing !! <3
"""

const EXTENSIONS := [".txt", ".py", ".png", ".mp4"]
const EXTRA_COMMANDS := ["help", "ls", "ping", "clr", "rm -rf /"]

enum { BUSY, ASK, PAGE }

var captured := false

var _on := false
var _mode := BUSY
var _out := []
var _line := ""
var _buffer := ""
var _prompt := ""
var _hidden := false
var _complete := false
var _entered := ""
var _gambles := 0


func _ready() -> void:
	_clear()


func power(on: bool) -> void:
	_on = on
	_clear()
	if on:
		_run()
	else:
		_mode = BUSY
		_line_done.emit()
		_any_key.emit()


func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not captured or not _on or not key.pressed:
		return
	get_viewport().set_input_as_handled()
	if _mode == PAGE:
		_any_key.emit()
		return
	if _mode != ASK:
		return
	match key.keycode:
		KEY_ENTER, KEY_KP_ENTER:
			_entered = _buffer
			_commit(_prompt + ("" if _hidden else _buffer))
			_line = ""
			_line_done.emit()
			return
		KEY_BACKSPACE:
			_buffer = _buffer.substr(0, maxi(0, _buffer.length() - 1))
		KEY_TAB:
			var hint := _suggest()
			if hint != "":
				_buffer = _clip(_prompt, hint)
		_:
			if key.unicode >= 32 and _fits(_prompt + _buffer + char(key.unicode)):
				_buffer += char(key.unicode)
	_paint()


func _run() -> void:
	var prev := 0.0
	for line in BOOT_LOG.split("\n"):
		var stamp := line.substr(1, line.find("]") - 1).strip_edges().to_float()
		await _wait(stamp - prev)
		if not _on:
			return
		_write(line)
		prev = stamp
	_clear()
	await _type_out(WELCOME)
	while _on:
		var command := (await _read(PROMPT, false, true)).strip_edges()
		if not _on:
			return
		if command != "":
			await _handle(command)


func _handle(command: String) -> void:
	match command:
		"help":
			await _type_out(HELP)
		"ls":
			_write(" ".join(LS_FILES))
			await _type("")
		"ping":
			await _type("pong")
			await _type("")
		"clr":
			_clear()
		"rm -rf /":
			await _type("[the page goes blank]")
			_on = false
		_:
			await _open(_base(command), command)


func _open(base: String, command: String) -> void:
	match base:
		"whoami":
			await _paginate(WHOAMI_PAGES)
		"whatisthis":
			await _paginate(WHATISTHIS_PAGES)
		"faq":
			await _type("")
		"secretgame":
			await _secretgame()
		"dog":
			await _type("[opens dog.png in browser]")
			await _type("")
		"idklol":
			await _type("[opens idklol.mp4 in browser]")
			await _type("")
		"secret":
			await _type_out(SECRET_TEXT)
		"theanswertolifetheuniverseandeverything":
			await _type("42")
			await _type("")
		_:
			await _type("bash: %s: command not found" % command)
			await _type("")


func _secretgame() -> void:
	await _slow("...")
	await _type("")
	await _slow("game requires elevated privileges")
	await _type("")
	for _attempt in 3:
		var entry := await _read("[sudo] password for temp: ", true, false)
		if not _on:
			return
		if entry == PASSWORD:
			ach.emit("log-on", -1)
			await _play()
			return
		await _type("Sorry, try again.")
	await _type("sudo: 3 incorrect password attempts")
	await _type("")


func _play() -> void:
	await _type("")
	await _slow("This is the best game ever.")
	await _type("")
	await _read("Are you ready? (Y/N): ", false, false)
	await _type("")
	await _slow("...")
	await _type("")
	await _slow("I'm too lazy to code y/n logic anyways lol")
	await _type("")
	await _slow("So in this game, say a number between 1 and 1 googolplex and if you guess right you win")
	await _type("")
	await _read("enter your number: ", false, false)
	await _type("")
	await _slow("...wow you won u should play the lottery!!")
	await _type("")
	await _slow("haha just kidding uhh you lost")
	await _type("")
	await _slow("Thank u so much for playing my game! yahoo")
	await _type("")
	_gambles += 1
	ach.emit("gambling", _gambles)


func _paginate(pages: Array) -> void:
	for i in pages.size():
		for line in String(pages[i]).split("\n"):
			await _type(line)
		await _type("")
		if not _on or i == pages.size() - 1:
			return
		_line = "Press any key to continue..."
		_paint()
		_mode = PAGE
		await _any_key
		_mode = BUSY
		_line = ""
		_paint()


func _read(prompt: String, hidden: bool, complete: bool) -> String:
	if not _on:
		return ""
	_prompt = prompt
	_hidden = hidden
	_complete = complete
	_buffer = ""
	_entered = ""
	_mode = ASK
	_paint()
	await _line_done
	_mode = BUSY
	return _entered


func _type_out(body: String) -> void:
	for line in body.split("\n"):
		await _type(line)


func _type(body: String) -> void:
	if not _on:
		return
	for part in _wrap(body):
		for word in String(part).split(" "):
			_line += word
			_paint()
			await _wait(word.length() * CHAR_DELAY)
			if not _on:
				return
			_line += " "
		_line = _line.substr(0, maxi(0, _line.length() - 1))
		_commit(_line)
		_line = ""
		_paint()


func _slow(body: String) -> void:
	await _wait(1.0)
	if _on:
		await _type(body)


func _write(body: String) -> void:
	for part in _wrap(body):
		_commit(String(part))
	_paint()


func _commit(line: String) -> void:
	_out.append(line)
	while _out.size() > MAX_LINES:
		_out.pop_front()


func _clear() -> void:
	_out.clear()
	_line = ""
	_buffer = ""
	_paint()


func _paint() -> void:
	if not _on:
		text = ""
		return
	var shown := _out.duplicate()
	if _mode == ASK:
		var typed := "*".repeat(_buffer.length()) if _hidden else _buffer
		var hint := _suggest() if _complete else ""
		if hint != "":
			typed += _clip(_prompt + typed, hint.substr(_buffer.length()))
		shown.append(_prompt + typed)
	elif _line != "":
		shown.append(_line)
	while shown.size() > MAX_LINES:
		shown.pop_front()
	text = "\n".join(shown)


func _fits(line: String) -> bool:
	return font.get_string_size(line, HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x <= width


func _clip(head: String, tail: String) -> String:
	var out := tail
	while out != "" and not _fits(head + out):
		out = out.substr(0, out.length() - 1)
	return out


func _suggest() -> String:
	if _buffer == "":
		return ""
	var best := ""
	for option in _commands():
		if option.begins_with(_buffer) and option != _buffer and (best == "" or option < best):
			best = option
	return best


func _commands() -> Array:
	return EXTRA_COMMANDS + LS_FILES.map(_base)


func _base(name: String) -> String:
	for ext in EXTENSIONS:
		if name.ends_with(ext) and name != ext:
			return name.substr(0, name.length() - ext.length())
	return name


func _wrap(body: String) -> Array:
	var lines := []
	var current := ""
	for raw in body.split(" "):
		var word := raw
		while not _fits(word):
			var head := _clip("", word)
			if head == "":
				head = word.substr(0, 1)
			if current != "":
				lines.append(current)
				current = ""
			lines.append(head)
			word = word.substr(head.length())
		var candidate := word if current == "" else current + " " + word
		if current != "" and not _fits(candidate):
			lines.append(current)
			current = word
		else:
			current = candidate
	lines.append(current)
	return lines


func _wait(seconds: float) -> void:
	if seconds > 0.0:
		await get_tree().create_timer(seconds).timeout
	else:
		await get_tree().process_frame
