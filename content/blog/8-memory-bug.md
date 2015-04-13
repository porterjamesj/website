Title: The Case of the Mysterious Memory Consumption
Date: 2015-04-12
Slug: mysterious-memory-consumption
Summary: The story of how I tracked down a tricky bug at work

A few weeks ago at work I found myself in a scene as old as the
software industry—it was Tuesday, we had a big deadline and
accompanying demo on Wednesday, and we had recently discovered a
critical bug in our application that no one could figure out. The
application in question is an HTTP API whose primary function is to
stream data to clients from various object store backends with
S3-compatible APIs using [Flask](http://flask.pocoo.org/) and
[Boto](https://boto.readthedocs.org/en/latest/). The core of it is the
moral equivalent of the following:


```python
@app.route("/data/<id>")
def download(id):
    # authenticate user, figure out which S3 backend this data is stored in, etc.
    conn = boto.connect_s3(
        # s3 connection details
    )
    buck = conn.get_bucket(bucket_where_id_is_stored)
    obj = buck.get_key(id)
    return Response(obj, 200)
```

Of course this elides a bunch of details and complexity but it gets
the big picture across. We get a request to download some data,
connect to an S3 server and get a Boto
[Key](https://boto.readthedocs.org/en/2.6.0/ref/s3.html#boto.s3.key.Key),
and then return a streaming Flask
[Response](http://flask.pocoo.org/docs/0.10/api/#flask.Response) that
iterates over the contents of that key. One peculiarity of this system
compared to typical uses of S3 is that the objects being streamed are
often quite large (think hundreds of gigabytes).

This API had been in development for several
months and extensively tested over the last few weeks, during which
time no major performance issues were noticed, but Murphy's Law never
fails, so of course it was the day before the demo when we started to
notice memory usage on our application servers skyrocket.

The servers were exhausting their available memory and needing to be
rebooted left and right, the people testing the API were complaining
about it being unreachable—all things considered it was looking pretty
grim. I set about spinning up more servers and frantically restarting
Apache every so often while trying to figure out what was happening
and fix it before the demo the next day.

----

Issues like this don't come out of nowhere, and the only thing that
had changed recently was that we had started testing our high-speed
download client, which used
[HTTP `Range` requests](https://en.wikipedia.org/wiki/Byte_serving) to
download a file in parallel. We figured that *had* to have something
to do with it, and since we hadn't been using the API's `Range`
support until recently, I spent a long time hunting around in the code
involved in streaming partial responses trying to figure out what
could be going wrong there.



<video width="800" height="500" controls>
  <source src="{filename}/misc/memory.webm" type="video/webm">
</video>
