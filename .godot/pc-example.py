import getpass
import os
import re
import sys
import time
import termios
import tty

UNLOCKED = True
SUDO_PASSWORD = "dogs100"
PROMPT = "[temp@temp ~]$ "

GREY = "\033[90m"
GREEN = "\033[92m"
RESET = "\033[0m"

MAX_LINES = 10
CHAR_DELAY = 0.01
screen_lines = []

BOOT_LOG = """[    0.000000] Command line: BOOT SEQ START
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

MAX_WIDTH = max(len(line) for line in BOOT_LOG.splitlines())

WELCOME_BANNER = """Temp Linux [Version 26w31a]
Copyright (c) t3mp 2026. All rights reserved.

Welcome back, Temp!

Available commands: help, ls, <filename>, clr, ping
"""

HELP_TEXT = """ls lists all files
<filename> opens a file, e.g. dog
clr clears the screen
ping pongs
help prints this again!
"""

LS_FILES = [
    "dog.png",
    "faq.txt",
    "idklol.mp4",
    "secret.txt",
    "secretgame.py",
    "theanswertolifetheuniverseandeverything.txt",
    "whatisthis.txt",
    "whoami.txt"
]

WHOAMI_PAGES = [
    "(1/6)\nHi, my name is Temp! An awfully creative individual that, when paired with unlimited free time, can pretty much do anything I set my mind to (nerfed by ADHD tho, lol).",
    "(2/6)\nRecently, I quit video editing to pursue my dreams of game development and web design, and despite it being really scary at times, I've never felt better.",
    "(3/6)\nAs a kid who grew up on the internet, I found myself making games, music, art, videos, websites, and so much more, simply because I found it so enjoyable and fun to me.",
    "(4/6)\nSo, after finishing the hell that was high school, despite getting really good grades, I decided to follow my dreams, and that leads us to today.",
    "(5/6)\nLook, you may not know much about me now, but I promise you, and myself, that you will know me in the future. Then I can die peacefully, knowing I left my mark on the internet.",
    "(6/6)\nAnd before I sign off, I just want to thank you for stopping by my silly little website. You are awesome. Never forget where you've come from, and where you're going.\n\n- temp 29/07/26",
]

WHATISTHIS_PAGES = [
    "What is this website for? (1/4)\n\nThis website was initially made for lurkers who like clicking on random links. I eventually decided to make a really awesome 3D WebGL game as my portfolio, as I think actions speak louder than words. Immean, what sane being creates an entire website with lore for their personal website. If this can't land me a job then nothing will.",
    "How did you make it? (2/4)\n\nThis website is purely made of HTML, CSS, and ThreeJS, and took about a month to complete. I've honestly never used ThreeJS before so I designed the website in Godot first, then \"converted\" it into ThreeJS, for better performance/compatibility. It was really fun to make, and I highly encourage others to make their own website!",
    "What else will you add? (3/4)\n\nI consider this website finished, though my /hireme page might be updated occasionally.",
    "I found a bug/glitch in your website! (4/4)\n\nPlease email me at hi@temp.dog (or reach out on Discord) and let me know!",
]

SECRET_TEXT = """hey, it's me, temp. i've been coding this for like... hours and like im so tired rn but like hah im glad u enjoy my game, thank you so much for your time!

feel free to reach out to me to say hi, im really curious to meet someone like you...

also, yes this is a reference to nso, yes the credits was a reference to minecraft, and yes there are a lot more references scattered around this place heh

but fr tho ur awesome tysm for playing !! <3
"""

KNOWN_EXTENSIONS = [".txt", ".py", ".png", ".mp4"]
FILE_BASES = [os.path.splitext(f)[0] for f in LS_FILES]
COMPLETIONS = ["help", "ls", "ping", "clr", "rm -rf /"] + FILE_BASES

TIMESTAMP_RE = re.compile(r"^(\[\s*\d+\.\d+\])")
TIMESTAMP_VALUE_RE = re.compile(r"^\[\s*(\d+\.\d+)\]")
OK_RE = re.compile(r"(\[\s*OK\s*\])\s*$")
ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


def visible_len(text):
    return len(ANSI_RE.sub("", text))


def wrap_to_width(text, width):
    lines = []
    current = ""
    for word in text.split(" "):
        while visible_len(word) > width:
            if current:
                lines.append(current)
                current = ""
            lines.append(word[:width])
            word = word[width:]
        candidate = word if not current else current + " " + word
        if current and visible_len(candidate) > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    lines.append(current)
    return lines


def _raw_clear():
    sys.stdout.write("\033c")
    sys.stdout.flush()


def clear_screen():
    screen_lines.clear()
    _raw_clear()


def _commit_line(text):
    screen_lines.append(text)
    if len(screen_lines) > MAX_LINES:
        screen_lines.pop(0)
        _raw_clear()
        for line in screen_lines:
            sys.stdout.write(line + "\n")
        sys.stdout.flush()


def write_line(text=""):
    for sub_line in wrap_to_width(text, MAX_WIDTH):
        sys.stdout.write(sub_line + "\n")
        sys.stdout.flush()
        _commit_line(sub_line)


def type_line_no_newline(text, char_delay=CHAR_DELAY):
    words = text.split(" ")
    for i, word in enumerate(words):
        sys.stdout.write(word)
        sys.stdout.flush()
        if word:
            time.sleep(len(word) * char_delay)
        if i < len(words) - 1:
            sys.stdout.write(" ")
            sys.stdout.flush()


def type_line(text="", char_delay=CHAR_DELAY):
    for sub_line in wrap_to_width(text, MAX_WIDTH):
        type_line_no_newline(sub_line, char_delay)
        sys.stdout.write("\n")
        sys.stdout.flush()
        _commit_line(sub_line)


def type_out(text, char_delay=CHAR_DELAY):
    for line in text.split("\n"):
        type_line(line, char_delay)


def wait_for_any_key():
    if not sys.stdin.isatty():
        input()
        return
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)


def paginate(pages):
    total = len(pages)
    for i, page in enumerate(pages):
        for line in page.split("\n"):
            type_line(line)
        type_line()
        if i < total - 1:
            type_line_no_newline("Press any key to continue...")
            wait_for_any_key()
            sys.stdout.write("\r\033[K")
            sys.stdout.flush()


def colorize_boot_line(line):
    line = TIMESTAMP_RE.sub(lambda m: GREY + m.group(1) + RESET, line)
    line = OK_RE.sub(lambda m: GREEN + m.group(1) + RESET, line)
    return line


def format_ls():
    parts = []
    for filename in LS_FILES:
        name, ext = os.path.splitext(filename)
        parts.append(f"{name}{GREY}{ext}{RESET}")
    return " ".join(parts)


def slow_print(text="", delay=1.0):
    time.sleep(delay)
    type_line(text)


def run_secretgame():
    slow_print("...")
    type_line()
    slow_print("game requires elevated privileges")
    type_line()

    for attempt in range(3):
        password = getpass.getpass("[sudo] password for temp: ")
        _commit_line("[sudo] password for temp: ")
        if password == SUDO_PASSWORD:
            type_line()
            slow_print("This is the best game ever.")
            type_line()
            ready = input("Are you ready? (Y/N): ")
            _commit_line("Are you ready? (Y/N): " + ready)
            type_line()
            slow_print("...")
            type_line()
            slow_print("I'm too lazy to code y/n logic anyways lol")
            type_line()
            slow_print("So in this game, say a number between 1 and 1 googolplex and if you guess right you win")
            type_line()
            number = input("enter your number: ")
            _commit_line("enter your number: " + number)
            type_line()
            slow_print("...wow you won u should play the lottery!!")
            type_line()
            slow_print("haha just kidding uhh you lost")
            type_line()
            slow_print("Thank u so much for playing my game! yahoo")
            type_line()
            return

        type_line("Sorry, try again.")

    type_line("sudo: 3 incorrect password attempts")
    type_line()


def open_whoami():
    paginate(WHOAMI_PAGES)


def open_whatisthis():
    paginate(WHATISTHIS_PAGES)


def open_faq():
    type_line()


def open_dog():
    type_line("[opens dog.png in browser]")
    type_line()


def open_idklol():
    type_line("[opens idklol.mp4 in browser]")
    type_line()


def open_secret():
    if UNLOCKED:
        type_out(SECRET_TEXT)
    else:
        type_line("bash: secret.txt: Permission denied")
        type_line()


def open_answer():
    type_line("42")
    type_line()


FILES = {
    "whoami": open_whoami,
    "whatisthis": open_whatisthis,
    "faq": open_faq,
    "secretgame": run_secretgame,
    "dog": open_dog,
    "idklol": open_idklol,
    "secret": open_secret,
    "theanswertolifetheuniverseandeverything": open_answer,
}


def resolve_base(command):
    for ext in KNOWN_EXTENSIONS:
        if command.endswith(ext) and command != ext:
            return command[: -len(ext)]
    return command


def handle_command(command):
    if command == "help":
        type_out(HELP_TEXT)
    elif command == "ls":
        write_line(format_ls())
        type_line()
    elif command == "ping":
        type_line("pong")
        type_line()
    elif command == "clr":
        clear_screen()
    elif command == "rm -rf /":
        type_line("[the page goes blank]")
        sys.exit(0)
    else:
        handler = FILES.get(resolve_base(command))
        if handler:
            handler()
        else:
            type_line(f"bash: {command}: command not found")
            type_line()


def get_suggestion(buffer):
    if not buffer:
        return None
    candidates = sorted(c for c in COMPLETIONS if c.startswith(buffer) and c != buffer)
    return candidates[0] if candidates else None


def max_buffer_len(prompt):
    return max(0, MAX_WIDTH - len(prompt))


def redraw_line(prompt, buffer):
    suggestion = get_suggestion(buffer)
    sys.stdout.write("\r\033[K" + prompt + buffer)
    if suggestion:
        remainder = suggestion[len(buffer):]
        remainder = remainder[: max(0, max_buffer_len(prompt) - len(buffer))]
        if remainder:
            sys.stdout.write(GREY + remainder + RESET)
            sys.stdout.write(f"\033[{len(remainder)}D")
    sys.stdout.flush()


def read_command(prompt):
    if not sys.stdin.isatty():
        return input(prompt).strip()

    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    buffer = ""
    try:
        tty.setraw(fd)
        redraw_line(prompt, buffer)
        while True:
            ch = sys.stdin.read(1)
            if ch in ("\r", "\n"):
                break
            if ch == "\x03":
                raise KeyboardInterrupt
            if ch == "\x04" and not buffer:
                raise EOFError
            if ch in ("\x7f", "\x08"):
                buffer = buffer[:-1]
            elif ch == "\t":
                suggestion = get_suggestion(buffer)
                if suggestion:
                    buffer = suggestion[: max_buffer_len(prompt)]
            elif ch == "\x1b":
                sys.stdin.read(1)
                sys.stdin.read(1)
            elif ch.isprintable() and len(buffer) < max_buffer_len(prompt):
                buffer += ch
            redraw_line(prompt, buffer)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)

    sys.stdout.write("\n")
    sys.stdout.flush()
    return buffer.strip()


def main():
    prev_ts = 0.0
    for line in BOOT_LOG.splitlines():
        match = TIMESTAMP_VALUE_RE.match(line)
        ts = float(match.group(1)) if match else prev_ts
        time.sleep(max(0.0, ts - prev_ts))
        write_line(colorize_boot_line(line))
        prev_ts = ts

    clear_screen()
    type_out(WELCOME_BANNER)

    while True:
        try:
            command = read_command(PROMPT)
        except (EOFError, KeyboardInterrupt):
            type_line()
            return

        _commit_line(PROMPT + command)

        if not command:
            continue

        handle_command(command)


if __name__ == "__main__":
    main()
