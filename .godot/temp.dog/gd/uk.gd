class_name Uk

const ONES := [
	"",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"ten",
	"eleven",
	"twelve",
	"thirteen",
	"fourteen",
	"fifteen",
	"sixteen",
	"seventeen",
	"eighteen",
	"nineteen",
	"twenty",
]

const BANDS := [
	[4, "early"],
	[6, "morning"],
	[12, "afternoon"],
	[20, "evening"],
]


static func now() -> Dictionary:
	var t := int(Time.get_unix_time_from_system())
	return Time.get_datetime_dict_from_unix_time(t + (3600 if _bst(t) else 0))


static func hour() -> int:
	return now().hour


static func face() -> String:
	var t := now()
	return "%02d:%02d" % [t.hour, t.minute]


static func band() -> String:
	var h := hour()
	var out := "night"
	for b in BANDS:
		if h >= int(b[0]):
			out = String(b[1])
	return out


static func is_day() -> bool:
	return band() in ["morning", "afternoon"]


static func words() -> String:
	var t := now()
	var m: int = t.minute
	var h: int = t.hour % 12
	if h == 0:
		h = 12
	var next := h % 12 + 1
	if m == 0:
		return _num(h) + " o'clock"
	if m == 15:
		return "quarter past " + _num(h)
	if m == 30:
		return "half past " + _num(h)
	if m == 45:
		return "quarter to " + _num(next)
	if m < 30:
		return _num(m) + " past " + _num(h)
	return _num(60 - m) + " to " + _num(next)


static func _num(n: int) -> String:
	return ONES[n] if n <= 20 else "twenty-" + ONES[n - 20]


static func _bst(t: int) -> bool:
	var year: int = Time.get_datetime_dict_from_unix_time(t).year
	return t >= _switch(year, 3) and t < _switch(year, 10)


static func _switch(year: int, month: int) -> int:
	for day in range(31, 24, -1):
		var t := int(
			Time.get_unix_time_from_datetime_dict(
				{"year": year, "month": month, "day": day, "hour": 1, "minute": 0, "second": 0}
			)
		)
		if Time.get_datetime_dict_from_unix_time(t).weekday == Time.WEEKDAY_SUNDAY:
			return t
	return 0
