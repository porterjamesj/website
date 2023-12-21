---
title: Douglas Adams and Declarative Programming
date: 2013-10-17
slug: douglas-adams-and-declarative-programming
summary: some thoughts on The Hitchhikers\'s Guide to the Galaxy
guid: 'tag:jamesporter.me,2013-10-17:/2013/10/17/douglas-adams-and-declarative-programming.html'
url: /2013/10/17/douglas-adams-and-declarative-programming.html
---

This summer I did mostly two things:

1. Program, and
2. Read all five *Hitchhiker's Guide to the Galaxy* books.

For a long time various friends have been telling me that they're
great and I should read them, but I somehow managed to never get
around to it until recently. It turns out they were right, as friends
often are; the books are great and I thoroughly enjoyed them.

One particular passage from the final volume, *Mostly Harmless*, was
very interesting in light of my other chief activity for the last few
months. Adams describes a a roundabout experiment involving herring
sandwiches in which scientists discover a variety of robot emotions,
and how these discoveries are applied by the software engineers
of the day (emphasis mine):

> The scientists at the Institute thus discovered the driving force
> behind all change, development and innovation in life, which was this:
> herring sandwiches. They published a paper to this effect, which was
> widely criticised as being extremely stupid. They checked their
> figures and realised that what they had actually discovered was
> "boredom", or rather, the practical function of boredom. In a fever of
> excitement they then went on to discover other emotions, Like
> "irritability", "depression", "reluctance", "ickiness" and so on. The
> next big breakthrough came when they stopped using herring sandwiches,
> whereupon a whole welter of new emotions became suddenly available to
> them for study, such as "relief", "joy", "friskiness", "appetite",
> "satisfaction", and most important of all, the desire for "happiness".
> This was the biggest breakthrough of all.
>
> **Vast wodges of complex computer code governing robot behaviour in all
> possible contingencies could be replaced very simply. All that robots
> needed was the capacity to be either bored or happy, and a few
> conditions that needed to be satisfied in order to bring those states
> about. They would then work the rest out for themselves.**

This description piqued my interest because it evoked some of the
declarative approaches to programming that I was exposed to at Hacker
School over the summer. [Carin Meier](https://twitter.com/carinmeier)
gave an awesome talk about controlling Parrot Drones and Roombas by
programming beliefs and goals[^1],
[Lindsey Kuper](http://composition.al/) brought us copies
of
[*The Reasoned Schemer*](https://mitpress.mit.edu/books/reasoned-schemer),
her and
[others](https://github.com/zachallaun/ICFP-2013-contest/graphs/contributors)
used Clojure's logic programming library to generate programs for the
[2013 ICFP contest](https://research.microsoft.com/en-us/events/icfpcontest2013/).

Ford Prefect, a character in the book, also takes advantage of this approach
to software in order to avoid being reported by an overzealous security robot
and break into the headquarters of his former employer, the publisher of the
eponymous *Hitchhiker's Guide*:

> The robot which Ford had got trapped under his towel was not, at the
> moment a happy robot. It was happy when it could move about. It was
> happy when it could see other things. It was particularly happy when
> it could see other things moving about, particularly if the other
> things were moving about doing things they shouldn't do because it
> could then, with considerable delight, report them.
>
> Ford would soon fix that.
>
> He squatted over the robot and held it between his knees. The towel
> was still covering all of its sensory mechanisms, but Ford had now got
> its logic circuits exposed. The robot was whirring grungily and
> pettishly, but it could only fidget, it couldn't actually move. Using
> the prising tool, Ford eased a small chip out from its socket. As soon
> as it came out, the robot went quiet and just sat there in a coma.
>
> The chip Ford had taken out was the one which contained the
> instructions for all the conditions that had to be fulfilled in order
> for the robot to feel happy. The robot would be happy when a tiny
> electrical charge from a point just to the left of the chip reached
> another point just to the right of the chip. The chip determined
> whether the charge got there or not.
>
> Ford pulled out a small length of wire that had been threaded into the
> towel. He dug one end of it into the top left hole of the chip socket
> and the other into the bottom right hole.
>
> That was all it took. Now the robot would be happy whatever
> happened. Ford quickly stood up and whisked the towel away. The robot
> rose ecstatically into the air, pursuing a kind of wriggly path.
>
> It turned and saw Ford.
> "Mr. Prefect, sir! I'm so happy to see you!"
> "Good to see you, little fella," said Ford.

One wonders if Adams himself ever did any programming in this style.
It's clear from other passages that the man knew his way around a
computer, but I'd love to know if these parts of the book were
inspired by exposure to Prolog or some such thing.

[^1]: some call this model of programming "agent-based" more info can be found
      [here](http://www.neo.com/2013/03/25/friendly-drones-with-carin-meier-and-jim-weirich) and [here](http://gigasquidsoftware.com/wordpress/?p=645)
