Title: The Case of the Mysterious Memory Consumption
Date: 2015-12-07
Slug: mysterious-memory-consumption
Summary: The story of how I tracked down a tricky bug

This is the story of a vexing bug I solved at a previous job which
taught me a valuable debugging lesson. The application in question was
an HTTP API whose primary function was to stream data to clients from
various object store backends with S3-compatible APIs using
[Flask](http://flask.pocoo.org/) and
[Boto](https://boto.readthedocs.org/en/latest/). The core of it was
the moral equivalent of the following:

```python
@app.route("/data/<id>")  # `app` is a Flask application object
def download(id):
    # authenticate user, figure out which S3
    # backend and bucket this data is stored in, etc.
    conn = boto.connect_s3(
        # s3 connection details
    )
    buck = conn.get_bucket(bucket_where_id_is_stored)
    obj = buck.get_key(id)
    return Response(obj, 200)
```

This of course elides huge amounts of detail but it gets the big
picture across. We get a request to download some data, connect to the
correct S3 server and get the correct Boto
[`Key`](https://boto.readthedocs.org/en/2.6.0/ref/s3.html#boto.s3.key.Key),
and then return a streaming Flask
[`Response`](http://flask.pocoo.org/docs/0.10/api/#flask.Response)
that iterates over the contents of that key. One peculiarity of this
system compared to typical uses of S3 is that the objects being
streamed are often quite large (think tens to hundreds of
gigabytes). An additional detail relevant to the story is that the
real API supported using the
[HTTP `Range` header](https://en.wikipedia.org/wiki/Byte_serving) to
stream only a portion of a requested object.

At some point we noticed memory usage on the Apache servers that ran
this code sky-rocketing, to the point that they would exhaust all
available memory, crash, and need to be restarted quite frequently.

----

Issues like this don't come out of nowhere, and the only thing that
had changed recently was that we had started testing a command line
download client written against this API, which used
[HTTP `Range` requests](https://en.wikipedia.org/wiki/Byte_serving) to
download a chunks of a single object in parallel. We figured that
*had* to have something to do with it, and indeed we initially
couldn't reproduce the bug except via our parallel `Range` request-ing
download client. I spent a long time a wild goose chase through the
`Range` request handling code in the API before we got our first real clue.

By judicious insertion of calls to
[pdb](https://docs.python.org/2/library/pdb.html) (my go to Python
debugging technique), we were eventually able to pinpoint a single
request made by the download client that triggered the bug in the
API. When starting to download an object, the client would first
connect to the server and make a `GET` request in order to
gather some information (e.g. file name, size) from the response
headers. It would then close the connection before streaming any of
the response body (this was effectively a `HEAD` request).

Moreover, the bug was triggered only *after* this request had
completed. If we delayed the client's closing of the connection by
inserting a pdb call, the memory usage on the server would remain
constant until the connection was closed. This was very frustrating
because it seemed to imply that our code couldn't be at fault[^1], and
it left us with no obvious place to insert pdb calls on the server to
debug further.

Before we move on, I've put together a
[repo that reproduces this problem](https://github.com/porterjamesj/s3-bug-demo)
that you can try out on your own machine if you like.

I've also made a short, poorly-produced demonstration video:

<video width="800" height="500" controls>
  <source src="{filename}/misc/memory.webm" type="video/webm">
</video>


The lower shell is a running `top` tracking the demo Flask
webserver. In the shell above it I make some requests using `curl` to
download a 1GB test object so you can observe their effects on memory
usage by the server. Note that downloading the entire test object does
not impact the server's memory usage, but downloading only the first
10 bytes and then closing the connection (via piping the output of
curl to `head -c 10`) causes memory usage to balloon to approximately a
gigabyte.

[^1]: In some sense, this turned out to be true—read on.
