when there is one option (like for marketable plush), show it.

log on should be achieved when turning on the pc. reword the desc of this achievement to title: "log on", desc: "turn on temp's computer"

for secret.txt, you will only be able to see it after you 100% the game. same end condition as being able to access /the-end.

could you also, for secret.txt, do the same next continue thing, like in the other txt files.

also small question: how big is this website, can i decrease the size, and how long would it take to load on different interent speeds? since it's instant for me, but i assume that's since im on localhost + 5gbps wifi.

remove faq.txt

scrap the dialoge text you have for the-end, it should be scrolling text. holding space, enter or lmb will speed it up. bg = coffee-bean, text = papaya-whip. thats it. since this is a pretty unique website, you might want to make this a seperate all in html file, instead of importing all the css, js, etc, when you only need the script.json and the cache to see if the user has finished the game or not.

---

# new logic for casino.py:

renamed secretgame.py, since it was too confusing

the user doesn't need to log in after doing it once, until the pc is turned off and on again.

change the achievement from out of 5, to a single achievement title: "stonks", desc: "make over $50 profit in the casino"

funny thing about this game is that you start with $100, for that very save. you cannot get more money if you get bankrupt. you have to fully reset if you go bankrupt.

```
[temp@temp ~]$ casino.py
game requires elevated privileges
[sudo] password for temp: dogs100

...

(1/3)
Welcome to my casino! Each dice roll costs $20. You must choose, odd, even or the specific number.

Press any key to continue...
```

```
(2/3)
If you guess odd/even correctly, you'll double your money. If you guess a number correctly, you'll times your money by that amount.

Press any key to continue...
```

```
(3/3)
If you guess odd/even incorrectly, you'll half your money. If you guess a number incorrectly, you'll divide your money by that amount.

Press any key to continue...
```

```
You currently have ${money}

Roll the dice? (Y/N):
```

```
You currently have ${money-20}

Type odd, even, or a number between 1-6:
```

```
You guessed {odd|even|1|2|3|4|5|6} and the dice was {1|2|3|4|5|6}.
```

```
You lost.

You currently have ${money}

Play again? (Y/N):
```

```
You won!

You currently have ${money}

Play again? (Y/N):
```

```
...

You're ${20-money} short...

[temp@temp ~]$
```
