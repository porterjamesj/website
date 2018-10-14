Title: Creating a magical videobooth for a wedding
Date: 2018-10-14
Slug: wedding-videobooth
Summary: Some technical and aesthetic notes about building a surprise for a the wedding of some friends
Status: draft

*This post was written jointly with
[Rachel Hwang](http://rahwang.strikingly.com/), who worked on this
project with me.*

Our friends [Emily](https://www.instagram.com/emilytishay) and
[John](http://www.daz.zone/) got married recently. A few months
beforehand, we decided to make them a surprise in the form of an
interactive computer art installation to be deployed at their
wedding. The guests used it to create some amazing things:

<video width="800" height="500" autoplay loop
src="/assets/videobooth/josh_emily_heart_short.mp4">
</video>

<video width="800" height="500" autoplay loop
src="/assets/videobooth/riva_dance_short.mp4">
</video>

<video width="800" height="500" autoplay loop
src="/assets/videobooth/nick_star_short.mp4">
</video>

The rest of this post is about what we did to make it, some of the
technical and aesthetic problems we ran into along the way, and how we
solved them.


## Getting started

We started off by thinking about what the important characteristics of
the final product would be, and brainstorming some ideas. We decided
it would be nice to come up with something that, in addition to being
a fun interactive toy for guests at the wedding, would also produce
artifacts that could be compiled into a memory for Emily and John, a
"guestbook" of sorts.

We settled on the idea of guests moving colored lights through the air
like wands to draw interesting visual effects on a screen in front of
them, by means of a computer vision algorithm tracking the lights and
rendering effects based on their positions. You'd walk into the booth,
type a message to Emily and John to be included with your video, and
then have 30 seconds to record a video of yourself making something
beautiful, funny, or interesting using the light wands.

## Settling on a development environment

Now that we had a rough idea, we had to actually start coding up some
prototypes. This is harder than it sounds! Both of us struggle with
getting over the initial "activation energy" hump in starting projects
like this, but find it much easier to keep going once we've started.

To help with this, we ended up choosing [Glitch](https://glitch.com/)
as our development environment, which was an amazing choice. Glitch
makes the initial phases of working on a web project with someone else
*incredibly easy*. Collaboration? Just type in the shared editor and
everyone else's view updates in real-time. Deployment? Already done,
just go to `my-project-name.glitch.me` and see the code you just typed
running live. We didn't believe the hype about Glitch before this
project, but we're totally sold now[^1].

We also chose Glitch because it's web-based. Because the web is such a
flexible, powerful development platform, and because we're both
familiar with it, we were more confident in our ability to do some of
the ancillary but important parts of the project (user interface for
typing messages, capturing and saving videos) than if we had chosen
something like [Processing](https://processing.org/).


## Tracking lights

As a prerequisite for doing any of this, we needed a way to track the
positions of colored objects in a video stream.


[^1]: That said, Glitch isn't perfect. We certainly ran into some
difficulties with it later on, as you'll see if you keep reading.
