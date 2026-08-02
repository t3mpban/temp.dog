![[main.gif]]

---

# Schedule

- [x] Do UI achievements + multiple choice
- [ ] Do camera logic
- [ ] Bulk of game logic in Godot
- [ ] Convert to Three.JS, ensuring cache
- [ ] Do /the-end page
- [ ] Polish

---

# Colors

Every color has to be from [this palette](https://coolors.co/6f4e37-c19a6b-e0b98e-fed8b1-ffefd5): a warm, coffee/beige theme.

`coffee-bean: #6f4e37`
`camel: #c19a6b`
`tan: #e0b98e`
`soft-apricot: #fed8b1`
`papaya-whip: #ffefd5`

---

# Animations

Use `cubic-bezier(0.87, 0, 0.13, 1)` when an object is staying in frame and animating.
Use `cubic-bezier(0.87, 0, .13, 1);` when an object is coming in to frame.
Use `cubic-bezier(0, 0, 0.13, 1)` when an object is going out of frame.

---

# Look

Assets should follow a parallax rule, where, if on top of another object, use a subtle drop shadow; otherwise, stay flat.

Example: `bg`, `mg`, and `fg` -> `bg:background`, `mg:settings, loading, and small-text`, `fg:dropdown-menus`.

Drop shadow color should be the darker color on which the element is on top of

Use something similar to `box-shadow: -3px 3px 6px rgba(111, 78, 55, 0.2);`

---

# Formatting

Always round numbers to .1 +/unless it doesn’t make sense to (like the ease anim)

Use prettier formatting

---

# Other

Always use a lightweight approach, using as few lines as possible, for max compatibility.

---

# Dialogue

All dialogue in the game, when interacting with items:
{} = var
"" = text
| = multiple choice question.
(default) = starting text after interacting
<small>text -> with arrows</small> = flow of dialogue

## PC

Steal the ram option disappears after selecting. PC is off by default

<small>PC is off (default)</small>
"Turn the PC on?"
Yes | No | Steal the ram
<small>PC is off -> Yes</small>
"You turned the PC on"
"It's quieter than you thought."
<small>PC is off -> No</small>
"You feel weirdly powerful and in control"
"But I assure you, you're not."
<small>PC is on (default)</small>
"Turn the PC off?"
Yes | No | Steal the ram
<small>PC is on -> Yes</small>
"You turned the PC off"
<small>PC is on -> No</small>
"You decided you like the ambient noise of the fans spinning and wanted to keep the PC on"
<small>Steal the ram</small>
"..."
"No. Stealing is wrong."
"Shame on you."
"I know ram prices are high but come on..."

## Mouse pad

<small>default</small>
"It's a mouse pad"
"made out of glass"
"so its a glass pad."

## Mouse

<small>default</small>
"You notice the fact this mouse moves based on where your mouse is"
"but there's a small chance you have a track pad or using touch pad."
"..."
"This is why we can't have nice things."

## Keyboard

<small>default</small>
"It's a keyboard"
"Made out of magnets"
"It's a magnetic keyboard"
"You wonder why such a thing exists"
"Maybe it's something to do with global warming?"

## Clock

Make sure to get the current UK time, not user time.
<small>default</small>
"The time is {time in words, e.g. quarter past four}"
"in this timezone..."

## Monitor

When the PC is on, `cmd` (3D text object) will behave like the python script.
<small>PC off (default)</small>
"The computer is turned off, and so is the monitor."
<small>PC on (default)</small>
![[pc-example.py]]

## Monitor 2

<small>PC off (default)</small>
"You'd think a second monitor positioned in such a way would be meaningless..."
<small>PC on (default)</small>
"Even with the PC on, the second monitor is useless."
"..."
"It makes you feel better about yourself."

## Chair

After each click, update chair int then check then do text box, as chair = 0 by default. Double check this logic.

<small>chair = 1 (default)</small>
"It's a chair"
<small>chair = 2</small>
"Seriously, it's a chair"
<small>chair = 3</small>
"Do you not believe me?"
<small>chair = 4</small>
"You-"
"why are you clicking on the chair"
<small>chair = 5</small>
"there's no achievement for this btw"
<small>chair = 6</small>
"you're wasting your time"
<small>chair = 7</small>
"..."
<small>chair >= 8</small>
"ok fine, leave me alone."

## Bed

Only let the player sleep once they've finished all achievements not including free the end. randomize these prompts
<small>random default</small>
"Your job isn't done yet."
<small>random default</small>
"You can't sleep now, you have a job to do."
<small>random default</small>
"No, you must finish what you started."
<small>random default</small>
"You can sleep when your finished."

## Marketable Plush

randomize opening prompts.
<small>random default</small>
"You feel like it's watching you..."
<small>random default</small>
"You feel it's holding back..."
<small>random default</small>
"You feel an ominous presence..."
<small>random default</small>
"You feel like it could speak..."
<small>random default</small>
"You feel an overwhelming amount of pressure..."
<small>default -> default</small>
"Interact with it?"
What could go wrong? | I'm scared.
<small>default -> default -> default</small>
"..."
What's the password | How to play guitar | Where's the TV Remote | Donate
<small>default -> default -> default -> What's the password</small>
"You ask the \[Marketable Plush] what the password is"
"..."
"As you wait for a response, you hear the shelf under the TV become a bit louder"
"Which is strange because shelves are usually silent"
"..."
"You have a feeling that \[Marketable Plush] is onto something"
"Or your on something..."
<small>default -> default -> default -> How to play guitar</small>
"You ask the \[Marketable Plush] how to play guitar"
"..."
"As you wait for a response, you feel as if the answer already resides inside you"
"and a melody starts to form inside your head!"
"..."
"You now know how to play guitar, all thanks to \[Marketable Plush]"
<small>default -> default -> default -> Where's the TV Remote</small>
"You ask the \[Marketable Plush] where the TV remote is"
"..."
"As you wait for a response, you feel as if the answer is staring right at you..."
"So without thinking, you squeeze \[Marketable Plush] and the TV turns on!"
"How awesome is that!"
"Now you can watch TV, all thanks to \[Marketable Plush]"
"..."
"Though you should've asked for permission before squeezing him"
<small>default -> default -> default -> Donate (without coin)</small>
"You try to give the \[Marketable Plush] your money"
"but then realize you have no money on you..."
"..."
"So instead, you ask the \[Marketable Plush] how it's day has been"
"As you wait for a response, you feel a bit stupid..."
"Unless... that's how it's day has been"
"Stupid."
"You learn that \[Marketable Plush] has had a stupid day"
<small>default -> default -> default -> Donate (with coin)</small>
"You try give the \[Marketable Plush] your money"
"..."
"As you wait for a response, you feel a sense of gratitude..."
"Despite the fact you could just take your money back, very easily"
"You decide not to."
"Thank you for donating to \[Marketable Plush]"
<small>default (when empty dialogue)</small>
"You feel stressed out knowing you read all of the dialogue that \[Marketable Plush] has to offer..."
"Or have you..?"

## Guitar

when the guitar is picked up, hide it, and play wear.ogg.

<small>default before learning guitar</small>
"You don't remember how to play"
"Try to play anyways?"
Why not? | No thanks.
<small>default before learning guitar -> default (first time)</small>
"You start to strum the guitar-"
"and..."
"..."
"yikes..."
"that was-"
"we don't have to tell anyone about it..."
<small>default before learning guitar -> default (second time and onwards)</small>
"..."
"No, I won't let you."
<small>default after learning guitar</small>
"You remember what the marketable plush taught you"
"Give it a try?"
Why not? | No thanks.
<small>default after learning guitar -> default (first time)</small>
"You start to absolutely shred."
"Your fingers are just perfectly hitting every riff perfectly"
"You're so good that your playing percussion, bass and piano, all on the guitar"
"..."
"If only you could hear what I'm hearing right now"
"This is the greatest song in the world"
<small>default after learning guitar -> default (second time)</small>
"Once again, you start to absolutely shred."
"Despite you not remembering the last song you played"
"You decide to play a tribute"
"..."
"And it's almost even better"
"..."
"If only you could hear what I'm hearing right now"
"You are the greatest guitarist in this world"
"Once again, thanks to \[Marketable Plush] "
<small>default after learning guitar -> default (third time and onwards)</small>
"..."
"You decide to save your stamina..."

## Window

Make sure to get the current UK time, not user time.

<small>04:00-5:59</small>
"It's getting bright outside, given it's the early morning over here."
<small>06:00-11:59</small>
"It's bright outside, given it's the morning over here."
<small>12:00-19:59</small>
"It's pretty bright outside, given it's the afternoon over here."
<small>20:00-23:59</small>
"It's getting dark outside, given it's night time over here."
<small>00:00-3:59</small>
"It's dark outside, given it's midnight over here."

## Picture

<small>default</small>
"Knowing this art, is art of art, within a website that, if you will, is considered a work of art... It fills you with determination."

## TV

When TV is on, loop the video frames, and only play the audio when hovering over the TV, smoothly fading in/out.

<small>tv off</small>
"The TV is off."
"There doesn't seem to be an obvious remote in sight"
"hm..."
<small>tv on</small>
"It's a looping video of Temp dancing"
"wait, that's Temp?"
"I thought he was a dog..."

## Shelf (table)

<small>default (first time)</small>
"You see a small piece of paper, peeking from a comically sized Harry Potter book"
"You carefully snag the paper out and read it."
"It says oolsbop = pjomsspd"
"..."
"wait..."
"You flip it upside down and it says password = dogs100"
"..."
"You feel relieved that you didn't need to solve a puzzle."
<small>default (second time)</small>
"So many books here... and yet he hasn't read a day in his life"
"Apart from maybe cereal boxes... and visual novels..."
<small>default (third time)</small>
"If you like reading so much, why don't you pick up one of these books?"

## Couch

<small>default</small>
"It's surprisingly comfy, given it has no backrest."

## Rug

<small>default (first time)</small>
"You check under the carpet... and find a shiny quarter!"
"You also find out that the carpet is a lot lighter and softer."
"Interesting..."
<small>default (second time)</small>
"You check under the carpet again... and find nothing"
"Whilst you're down there, you admire the light and soft carpet underneath."
"You feel as if that could make for a cool metaphor..."
<small>default (third time)</small>
"Beneath the weight of now and the future, a younger version of your world stayed still like a photograph,"
"Its fibers cleaner, its colors brighter, and its contrast stronger than any combination of words could withhold,"
"Some people don't have a rug to place, nor lift, and thus never remember their roots,"
"But unless you see the light soon, it's never too late to place the rug, and snapshot your life for another day,"
"So you too can see how far you've come, from then, to now, till the future,"
"It might just inspire you."
"..."
"Just maybe."

---

# Ending

This will be shown on /the-end, with different styling.

<small>if the user hasnt beaten the game yet</small>
"when you actually beat the game, you'll get to see this. otherwise, SCRAM!!"
<small>otherwise</small>
"I see the player you mean."
"It has reached such a level of unemployment that it can read my thoughts."
"It reads my thoughts through pixels, transmitted across years of innovation and technology,"
"as though humans were created for this very purpose and moment in time."
"But that doesn’t matter."
"It knows it wasted its time, and yet, it played well. It did not give up."
"For this very reason, I like this player."
"I like how this player is so determined."
"I like how this player is so dedicated to its craft."
"I like how this player never stops until it finishes what it started."
"And I'll miss how this player is now, later when they grow tall,"
"when obscurities such as money, finance, school, jobs, families, and the heat death of the universe consume someone I once knew."
"And soon you too will miss yourself."
"The world."
"And everything in between."
"Yet it will always feel like you are already too late."
"..."
"Fin."

---

# Multiple Choice

When the user encounters a multiple choice, I wan't it in the form of buttons, stacked on top of each other.

They' re positioned in the middle of the top of the text-box and the top of the view-port.

---

# Achievements

## Hello, world!

thanks for visiting my website, enjoy!

## gambling (out of 5)

i'm not addicted, your addicted...

## interstellar

scroll to the bottom of the achievements page...

## carpet

<3

## money

get that bag cuh

## log on

log into temps computer

## mouse-ception

click on the mouse, with your mouse.

## honey, i'm home!

visit the website twice

## chair achievement (out of 8)

don't click on the chair 8 times, otherwise you won't get this achievement.

## Marketable Plush (out of 5)

obtain all knowledge from marketable plush

## tv on

kendrick lamar would be not be happy

## fast learner

learn how to play guitar

## philanthropist

unleash your inner mr beast and donate

## multilingual

no way he just put in the NARUTO reference in there

## thief

five-finger discount

## free the end (out of 15)

finish the game and go to bed, your quest here is done.

---

# Zones

Defined in a dict, which zone you're in will limit what is press-able and determine where the camera should animate to.

```gdscript
var zone = { "main", "setup", "pc-screen", "bed", "tv", "tv-screen"}
```

Each zone has a `Vector3 cameraPos` and `Vector3 cameraRot`.

Each object has a zone that it belongs to, and is considered clickable/hover-able if that zone is active.

---

# Camera

The camera will "shake", slowly, smoothed and eased but randomly, to give a handheld look. very subtle. keep in mind to have seperate values for the offsetRot this handheld effect has, and the cameraRot from the zones.

On top of this, handheld shake effect, the users cursor position will smoothly offset the camera, with clamped values. this will also, focus the camera to `lookAt` an object when hovered over it.

Camera smoothly animates zone to zone, using `cubic-bezier(0.87, 0, 0.13, 1)`

---

# Additional notes

## PC

When the PC is on, and then the monitor is pressed on, the keyboard is "captured", and inputs will effect what happens on the pc, otherwise, the keyboard should be ignored (on a game level).

---

# Smoke tests

Ensure elements such as tooltips, textboxes, multiple-choice buttons, etc, do not overlap when they shouldn't.
