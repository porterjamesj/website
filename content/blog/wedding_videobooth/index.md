---
title: Creating a magical videobooth for a wedding
date: 2019-08-30
slug: wedding-videobooth
summary: Some technical and aesthetic notes about building a surprise for the wedding of some friends
guid: 'tag:jamesporter.me,2019-08-30:/2019/08/30/wedding-videobooth.html'
url: /wedding-videobooth
aliases:
  - '2019/08/30/wedding-videobooth.html'
rss: true
---

*This project was a collaboration with my friend [Rachel
Hwang](http://rahwang.strikingly.com/).*

Our friends Emily and [John](http://www.daz.zone/) got married last
year, and we decided to make them a surprise in the form of an
interactive computer art installation for their wedding. The guests
used it to create some amazing things:

{{< inlinevideo "videos/josh_emily_heart_short.mp4" >}}

{{< inlinevideo "videos/riva_dance_short.mp4" >}}

{{< inlinevideo "videos/nick_star_short.mp4" >}}

This post is about what we did to make it, some of the technical and
aesthetic problems we ran into along the way, and how we solved them.


## Getting started

We started by thinking about the important characteristics of the
final product and brainstorming some ideas. Our goal was to make
something that, in addition to being a fun interactive toy for guests
at the wedding, would also produce digital artifacts that could be compiled
into a "video guestbook" of sorts for Emily and John.

We settled on the idea of guests moving colored lights through the air
like wands to draw interesting visual effects on a screen. You'd walk
into the booth and then have 30 seconds to record a video of yourself
making something beautiful, funny, or interesting using the light
wands. The drawing would work via a computer vision algorithm tracking
the lights and rendering effects based on their positions.

## Color tracking

To get started, we needed a way to track the positions of colored
objects (called "blobs" in computer vision terminology) in a video
stream. We found [tracking.js](https://trackingjs.com/), a library of
JavaScript computer vision algorithms. After a bit of trial and error
we managed to get a very basic demo working:

{{< inlinevideo "videos/video.mp4" >}}

This was pretty much just the tracking.js [color tracking
example](https://trackingjs.com/examples/color_camera.html) with the
parameters tweaked so it tracks orange blobs rather than the default
of cyan/magenta/yellow blobs, but it was a start.

## Making it beautiful

Now we needed to draw something more appealing than a bounding box
around the blobs. We decided to use [p5.js](https://p5js.org/) for
drawing, since we were both familiar with it. We added p5 to our
codebase and tweaked the color tracking code to use the `canvas` and
`video` elements generated by p5 rather than creating it's own, and to
be driven by p5's render loop. We started off by drawing a basic
flower pattern using ellipses. We don't have video of this stage
unfortunately, but here are some photos:

![James with flower](images/james_with_yellow_flower.png)
![Rachel with flower](images/rachel_with_yellow_flower.png)

Again, not the most beautiful thing, but better than a bounding box!
It's also a proof of concept that we could integrate p5 with
tracking.js and start working towards something better.

In searching for inspiration, Golan Levin's
[Yellowtail](http://flong.com/projects/yellowtail/), which is one of
the examples included with Processing, caught our eye. We were able to
find [a Yellowtail implementation using
p5](https://n1ckfg.github.io/yellowtails/p5js/) and the [source code
for it](https://github.com/n1ckfg/yellowtails). We decided to try and
integrate this code into our project, adapting the callbacks for
things like clicks and mouse movement to instead by triggered by the
tracked blobs. This proved to be pretty challenging and lead to a lot
of pitfalls and visually interesting bugs, for example:

![James demoing bug](images/james_flower_glitch.png)

Eventually, we managed to get it working:

![James Yellowtail image](images/james_first_yellowtail.png)

This was finally starting to feel a bit like what we had in our mind's
eye when we started this project.

## Hardware choices

One of the big hurdles remaining was determing exactly what colored
objects the wedding guests would draw with. Until now, we'd been
testing with ceiling lights and various shiny objects in our
apartments, but that wasn't going to cut it for the wedding. We wanted
whatever we settled on to have a few characteristics:

1. Minimal false positives, i.e. someone's clothes or body won't be
   mistaken for it, resulting in spurious drawing.
2. Works well in a variety of light conditions. This was important
   since we weren't sure what the ambient light would be like
   at the wedding venue.
3. Can be easily "turned on and off" by changing it's color/light
   emission somehow. This makes drawing/writing a lot easier,
   since never being able to "turn off" the color would be like
   drawing with a pencil you couldn't pick up off the page.
4. Comes in multiple colors, allowing for multiple distinct colored
   lines or effects.

These requirements suggested using light-producing objects, like
glowsticks, LEDs, or lightbulbs, rather than something like a ball
painted in a bright color. A light-producing object works more
consistently in different ambient light conditions, since it doesn't
need to reflect light from it's environment to look colored. An LED or
lightbulb can just be powered on and off, where as something that
doesn't light itself up has to be occluded somehow in order to stop
drawing, which is much trickier.

After a few false starts with glowsticks and small LEDs, we found that
colored lightbulbs worked quite well:

{{< inlinevideo "videos/james_first_heart.mp4" >}}

Getting to this point was really exciting! It felt like we were
getting close to something we'd be happy with displaying at the
wedding. As they say though, the last 10% of the work often takes 90%
of the time.

## From one color to three

So far we'd only been testing with a single color of lightbulb at a
time, detecting it by configuring tracking.js to look for white
blobs. This works well regardless of the bulb color, since a colored
bulb is bright enough that it just looks white to a webcam.

However, we wanted guests to be able to draw with multiple bulbs of
different colors at the same time, so just finding white blobs
wouldn't work for the final product, since it would prevent us from
distinguishing e.g. a red bulb from a blue one. Our next challenge was
figuring out how to do this.

We had red, green, and blue bulbs. Our plan for telling the three
colors apart involved the subtle "corona" of light that surrounds
colored bulbs in the webcam. Looking at the videos above, you can see
that the while the body of the bulb looks white, the background pixels
surrounding it look pretty red. We took advantage of this in our
initial algorithm for telling the three bulbs apart:

1. Configure tracking.js to find all white blobs in each frame of
   video.
2. For each blob, add up the R, G, and B values of all the pixels in
   it, ignoring the white pixels (so we're only considering the
   bulb's surroundings, and not the bulb itself).
3. Label the green bulb as the blob with the largest total green
   value, the red bulb as the one with the largest total red value,
   etc.

This did not work very well:

{{< inlinevideo "videos/james_blue_green_not_working.mp4" >}}

The problem was that the bulbs were too bright, so they illuminated
each other, which made them harder to tell apart. The brightness of
the bulbs also caused other problems:

{{< inlinevideo "videos/james_face_confusion.mp4" >}}

The face is so illuminated that the algorithm thinks it's a bulb.

This seemed like a big challenge at first, and we struggled for a
while to come up with tweaks we could make to the algorithm, or some
sort of clever transformation of the pixel data we could use to tell
the colors apart.

Eventually, we took a step back and realized we had been too focused
on solving the problem with software. Rather than forcing our program
to deal with the too-bright bulbs, we could just make them dimmer. The
solution we eventually settled on was dirt simple: cover the bulbs
with socks!

{{< inlinevideo "videos/james_socks_on_bulbs.mp4" >}}

Much better! The socks make the bulbs dim enough that they don't
illuminate each other and their surroundings enough to confuse our
algorithm.

Unfortunately, this didn't solve all our problems. The colors of the
bulbs didn't line up as neatly as we'd hoped with the actual red,
green, and blue values the webcam measured. The simple strategy of
identifying, e.g. the greenest blob as the green bulb was pretty
unreliable—sometimes the blue bulb actually had the highest total
green value. Similar problems happened with all three colors.

What we ended up doing instead was manually measuring the typical
color profiles of in each bulb and hard-coding these ranges into our
code. So the algorithm for identifying, e.g. the green bulb now looked
like:

1. Configure tracking.js to find white blobs.
2. For each blob:
    1. Remove the white pixels and sum up the R, G, and B
       values.
    3. For each color, check if it's total value falls within
       the hard-coded typical range for the green bulb.
    4. If all three colors are within those typical ranges, identify
       this blob as the green bulb.

We also had to filter based on shape to avoid choosing other objects
that were just being illuminated by the bulbs (faces, curtains, etc.),
rather than the bulbs themselves. We removed from consideration any
blob whose width was too different from it's height, since the bulbs
tended to look pretty square from any angle, whereas illuminated
faces, curtains, etc. tended to have one side longer than the other.

One problem we still had was momentary fluctuations in the bulbs'
color profiles. If something else in the scene, like a shirt or a
face, had a color profile that matched one of the bulbs for even a
single frame, the algorithm would get confused about the green bulb's
location, resulting in weird, jittery drawing paths, and lines jumping
across the screen.

To solve this problem, we ended up implementing "blob persistence" as
described in [this Dan Shiffman
video](https://www.youtube.com/watch?v=r0lvsMPGEoY&t=0s&index=7&list=PLRqwX-V7Uu6aG2RJHErXKSWFDXU4qo_ro)[^1],
which was surprisingly straightforward. This let us keep track of the
"history" of a blob, so that our bulb identification algorithm could
consider not just what a blob looks like in this frame of video, but
what it looked like in previous frames also.

We then used this to tweak our code so it used a running average of
the red, green, and blue totals for each blob over the last 50 frames,
rather than only considering the current frame. This meant that if a
bulb's color fluctuated a bit for a frame or two, it wouldn't throw
everything off, since the running average wouldn't be affected
much. This made things a lot less jittery.  We were now able to track
all three colors pretty reliably:

{{< inlinevideo "videos/james_all_three.mp4" >}}

## Handing ambient light problems using statistics

Our algorithm was still very sensitive to ambient light conditions. As
the environment got darker or lighter, the color values that the
webcam measured for each bulb changed substantially. This meant that
whenever the lighting changed, the algorithm would stop working, since
the "typical" color profiles that we'd hard-coded for each bulb were
only typical in very specific light conditions. In order to get things
working again, we would have to figure out the new typical color
ranges by trial and error, and manually change the code accordingly.

There was no way to know what the light conditions at the wedding
venue would be like in advance, so if we didn't come up with a better
system, we'd have to do this tweaking while setting the booth up. We
were worried that we simply wouldn't have time for this, given all the
hectic nature of weddings and our other responsibilities as
groomspeople.

What we needed was a way for our algorithm to adapt to
different light conditions automatically, without us having to spend
time manually adjusting it.

We decided to try adding a way to "calibrate" the algorithm at the
beginning:

1. While setting the booth up, we'd hold up the blue bulb and click on
   it to tell the system "this blob is the blue bulb, use it to
   calibrate the detection algorithm".
2. We'd move the bulb around a bit while the software would record the
   maximum and minimum observed total values of red, green, and blue.
3. Repeat for the other two bulbs.
4. While the booth was running, any detected blob whose total color
   values fell within the recorded ranges for a bulb would be
   identified as that bulb.

This seemed like it could work, but it also felt brittle and
ad-hoc. We took a step back and realized that the right way to think
about the problem was in terms of probability. It isn't the case that
a blob goes from a 100% chance of being the green bulb to a 0% chance
when it's value for a particular color strays slightly outside the
sampled range. Rather, a blob has some probability of being the green
bulb that slides smoothly from 0% to 100% based on the overall
similarity of it's color profile to that measured for the green bulb.

We're far from experts on statistics, but figured there had to be a
statistical method that would let us compute probability of a blob
being a particular bulb based on the overall similarity of the blob's
measured color values to the sampled data for the bulb.

We eventually realized that what we were wanted to do, in statistical
terms, was determine the probability that two samples were drawn from
the same underlying population. In our case, the one sample is the RGB
profile measured during calibration of a bulb, and the other sample is
the RGB profile of an unidentified blob being processed by our
algorithm. If the two samples were drawn from the same population,
then the unidentified blob is probably the bulb! It turns out there is
a statistical test that does basically this: the two-sample
[Kolmogorov–Smirnov
test](https://en.wikipedia.org/wiki/Kolmogorov%E2%80%93Smirnov_test),
or "K-S test" for short[^2].

At this point, we were excited about the idea because it seemed like
such an elegant, principled solution to the problem, but skeptical,
since in programming it so often turns out that the elegant,
principled solution doesn't work in practice, due to performance
issues, the particulars of your problem not fitting into an algorithm
in the way you thought they would, etc.

We were able to find a JavaScript implementation of the K-S test in
the [Jerzy library](https://github.com/pieterprovoost/jerzy), which we
hacked into our project. Now in order to test if a blob was e.g. the
green bulb, rather than checking if the measured red, green, and blue
values for the blob fell within a range, we instead performed three
K-S tests (one for each color) between the sampled values from the
previous 50 frames of the blob and the values measured for the green
bulb[^3]. Using the K-S test instead of just minimum and maximum
values for each color gave us a dramatic improvement in results. The
algorithm reliably distinguished the three bulbs from each other and
other objects in the video and could be quickly calibrated to adapt to
different light conditions.

## Performance optimizations

However, this success came at the cost of performance. Computing three
K-S tests is a bit computationally intensive to do every frame. We
optimized the K-S test code we copy-pasted using algorithmic
improvements (it had a lot of [accidentally
quadratic](https://accidentallyquadratic.tumblr.com/) code that we
were able to make linear) and caching, which made things manageable
until we tried to scale up our video player. Until now we'd been
testing with a small (640 by 480 pixels) video feed. However, in the
final product, we wanted the video to be full screen on a large
monitor. When we tried this, the performance of all our computer
vision code plummeted, as did the framerate of the rendered video.

Digging in with the browser profiler revealed that the majority of the
time was spent inside tracking.js, so making further optimizations to
our code wouldn't do much. Instead, we'd have to somehow reduce the
work that tracking.js was doing. Not knowing where else to turn, we
started searching for things like "tracking js improve
performance". Surprisingly, this worked! It let us to [this
comment](https://github.com/eduardolundgren/tracking.js/issues/96)
from tracking.js creator Eduardo Lundgren, which suggests downscaling
high-res input video before passing it to tracking.js to be processed,
and then taking the output positions, bounding boxes, etc., and
scaling them back up to the original video dimensions before rendering
them. We implemented this pretty quickly, and it worked really well!
Although it had its fair share of amusing bugs along the way,
e.g. bounding boxes flying off the screen due to math errors:

{{< inlinevideo "videos/james_funny_bug.mp4" >}}

## The final product

After frantically rushing to finish all of the above before the
wedding and deploying it in a mad rush during the cocktail hour, the
booth was ready for the dinner and dancing afterwards. Here are a few
of our favorite things the guests made:

Writing in English and Chinese:

{{< inlinevideo "videos/ilona_leslie_writing.mp4" >}}

{{< inlinevideo "videos/james_shanti.mp4" >}}

Drawings of all sorts:

{{< inlinevideo "videos/nick_paige_cat.mp4" >}}

{{< inlinevideo "videos/josh_emily_lightbulbs.mp4" >}}

Including a map of some of the major lines of the New York City subway
system:

{{< inlinevideo "videos/rob_alicia_subway.mp4" >}}

or even a math puzzle:

{{< inlinevideo "videos/tim_rob_alicia_math_puzzle.mp4" >}}

It was a lot of work and stressful at times, but we're really happy
with how this project turned out. We're glad we could give everyone at
the wedding a way to be creative in expressing their love and well
wishes, while making what we hope will be a cherished memory for our
friends. We love you John and Emily! Thanks for giving us the
opportunity to make this.

If you're curious, you can see the code for this project
[here](https://glitch.com/edit/#!/jemily-wedding-photobooth) (although
it's pretty gnarly due to the tight deadline!).


[^1]: Many of Dan's [computer vision
      tutorials](https://www.youtube.com/playlist?list=PLRqwX-V7Uu6aG2RJHErXKSWFDXU4qo_ro)
      were really helpful for understanding what we were doing
      throughout this whole project.
[^2]: Technically, the test gives you something called a "D statistic"
      which isn't the probability that the two samples are from the
      same population, but the closer it is to zero the more likely it
      is that they are, which is good enough for our purposes.
[^3]: The tranditional Kolmogorov-Smirnov test is one-dimentional, so
      it only makes sense for one color at a time, there's no way to
      make it take into account all three. We did find a
      [paper](https://www.sciencedirect.com/science/article/pii/S0167715297000205?via%3Dihub)
      that describes a multidimensional version, but we decided
      implementing statistics research was way too much effort for
      this project.
