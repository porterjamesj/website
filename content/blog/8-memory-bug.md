Title: The Case of the Mysterious Memory Consumption
Date: 2015-12-07
Slug: mysterious-memory-consumption
Summary: The story of a tricky bug
Status: draft

This is the story of a vexing bug I solved at a previous job which
taught me a valuable debugging lesson. The application in question was
an HTTP API whose primary function was to proxy data stored in S3 to
clients. It used [Flask](http://flask.pocoo.org/) and
[Boto](https://boto.readthedocs.org/en/latest/) to achieve this. The
core of it was the moral equivalent of the following:

```python
@app.route("/data/<id>")  # `app` is a Flask application object
def download(id):
    # authenticate user,
    # figure out what bucket data is stored in, bookkeeping, etc.
    conn = boto.connect_s3(
        # s3 connection details
    )
    buck = conn.get_bucket(bucket_where_id_is_stored)
    headers = {}
    if request.headers.get("Range"):
        headers["Range"] = request.headers["Range"]
    obj = buck.get_key(id, headers=headers)
    return Response(obj, 200)
```

This of course elides huge amounts of detail but it gets the big
picture across. We get a request to download some data, connect to
S3 and get the correct Boto
[`Key`](https://boto.readthedocs.org/en/2.6.0/ref/s3.html#boto.s3.key.Key),
and then return a streaming Flask
[`Response`](http://flask.pocoo.org/docs/0.10/api/#flask.Response)
that iterates over the contents of that key. One peculiarity of this
system compared to typical uses of S3 was that the objects being
streamed were often quite large (think tens to hundreds of
gigabytes). An additional detail relevant to the story is that, as
illustrated above, the API supported using the
[HTTP `Range` header](https://en.wikipedia.org/wiki/Byte_serving) to
stream only a portion of a requested object.

At some point we noticed memory usage on the boxes that ran this code
sky-rocketing, to the point that they would frequently exhaust all available
memory, crash, and need to be restarted.

The only thing that had changed recently was that we had started
testing a command line download client written against this API, which
used `Range` requests to download small chunks of a single object in
parallel. We figured that *had* to have something to do with it, and
indeed we initially couldn't reproduce the bug except via our parallel
`Range` request-ing client. I spent a long while on a wild goose chase
through the `Range` request handling code in the API before we got our
first real clue.

By judicious insertion of calls to
[pdb](https://docs.python.org/2/library/pdb.html) (my go-to Python
debugging technique), we were eventually able to pinpoint a single
request made by the download client that triggered the bug in the
API. When starting to download an object, the client would, before
making any `Range` requests, first connect to the server and make an
unadorned `GET` request in order to gather some information (e.g. file
name, size) from the response headers. It would then close the
connection before streaming any of the response body (this was
effectively `HEAD`). It was this preliminary request that triggered
the bug—`Range` support had been a red herring.

Moreover, the bug was triggered only *after* the request had
completed. If we delayed the client's closing of the connection by
inserting a pdb call, the memory usage on the server would remain
constant until we broke out of pdb and allowed the connection to be
closed. This was very frustrating because it seemed to imply that our
code couldn't be at fault[^1], and it left us with no obvious place to
insert pdb calls in the API code to debug further.

When debuggers fail me, I usually reach for `strace`[^2], and this
time was no different. I `strace`d the API server process while making
requests then disconnecting before they could complete. This revealed
lots of [`recvfrom`](http://linux.die.net/man/2/recvfrom) calls to a
single file descriptor happening after the client closed its
connection. I used `lsof` to examine the server process's open file
descriptors and sure enough the one it was receiving data from was its
open connection to S3. It appeared that the API was continuing to read
data from S3 into memory (to the point of exhausting servers with
multiple gigabytes of memory) after the requests completed.

To review what we know so far:

1. We are proxying data from S3 via an intervening webserver that uses
   Flask and Boto.
2. When a client disconnects from the server prematurely (i.e. without
   actually reading the whole request body), the server continues to
   read (excessive amounts of) data from S3 into memory.

Before we move on to reveal what was actually going on, I'll give you
a chance to try and figure it out for yourself! I've put together a
[repo that reproduces the problem](https://github.com/porterjamesj/s3-bug-demo)
that you can try out on your own machine if you like.

I've also made a short, poorly-produced demonstration video:

<video width="800" height="500" controls>
  <source src="{filename}/misc/memory.webm" type="video/webm">
</video>

One shell in the video is running `top` tracking the demo Flask
webserver, which streams data from a local
[moto](https://github.com/spulec/moto) S3 server. In the other shell I
make some requests using `curl` to download a 1GB test object so you
can observe their effects on memory usage by the server. Note that
downloading the entire test object does not impact the server's memory
usage, but downloading only the first 10 bytes and then closing the
connection (via piping the output of curl to `head -c 10`) causes
memory usage to balloon to approximately 1GB.

If you want to try to figure it out for yourself, go ahead and
download that demo repo and get debugging before reading on (spoilers ahead!).

---

At this point it looked likely the the problem was in one of the
libraries we were using. It took me a long time to accept this since
Flask and Boto are both very widely deployed, battle-tested tools, but
eventually I started digging through the relevant parts of their
source code.

We were using the Flask
[`Response`](http://flask.pocoo.org/docs/0.10/api/#flask.Response)
object to wrap a Boto
[`Key`](https://boto.readthedocs.org/en/2.6.0/ref/s3.html#boto.s3.key.Key),
so I figured looking for anything suspicious in the code for those two
classes was the way to go.

The Flask
[`Response` class](https://github.com/mitsuhiko/flask/blob/0.10.1/flask/wrappers.py#L175-L184)
is a straightforward subclass wrapper of the Werkzeug[^3]
[`Response` class](https://github.com/mitsuhiko/werkzeug/blob/0.10.4/werkzeug/wrappers.py#L1814). There's
quite a bit in that file, but eventually I honed in on the
[`.close` method](https://github.com/mitsuhiko/werkzeug/blob/0.10.4/werkzeug/wrappers.py#L1047-L1057),
reasoning that this might be called when the client disconnects:

```python
def close(self):
    """Close the wrapped response if possible.  You can also use the object
    in a with statement which will automatically close it.
    .. versionadded:: 0.9
       Can now be used in a with statement.
    """
    if hasattr(self.response, 'close'):
        self.response.close()
    for func in self._on_close:
        func()
```

What stood out to me here is `self.response.close()`: if
`self.response` has a `.close` method, the `Response` will call it
when it gets `.close`d. Here `self.response` is simply the first
argument to the `Response` constructor[^4]: the iterator whose data we
are going to stream to the client. In our case this is a Boto `Key`,
so let's look at
[that code](https://github.com/boto/boto/blob/2.38.0/boto/s3/key.py)
next, focusing on the
[`.close` method](https://github.com/boto/boto/blob/2.38.0/boto/s3/key.py#L353-L373):

```python
def close(self, fast=False):
    """
    Close this key.
    :type fast: bool
    :param fast: True if you want the connection to be closed without first
    reading the content. This should only be used in cases where subsequent
    calls don't need to return the content from the open HTTP connection.
    Note: As explained at
    http://docs.python.org/2/library/httplib.html#httplib.HTTPConnection.getresponse,
    callers must read the whole response before sending a new request to the
    server. Calling Key.close(fast=True) and making a subsequent request to
    the server will work because boto will get an httplib exception and
    close/reopen the connection.
    """
    if self.resp and not fast:
        self.resp.read()
    self.resp = None
    self.mode = None
    self.closed = True
```

After reading this, understanding finally dawned on me. `self.resp` is
the
[httplib response object](https://docs.python.org/2/library/httplib.html#httplib.HTTPResponse)
that boto uses to read the `Key`'s data from S3. When `.close` is
called on the `Key`, `self.resp.read` will also be called by
default. This is analogous to calling `.read` on a Python `file`
object: *all of the unread data* will be pulled into
memory. Calling `.close` on the Flask `Response` (which presumably
happens when the client disconnects) causes this to happen, triggering
a memory explosion when the `Key` is a large object.

This theory also explains why a client disconnecting without reading
the entire object first is what triggers the bug. If all the data from
`self.resp` has already been read (in order to write it out to the
client) when `self.resp.read` is called, nothing bad will happen. If,
however, only a small amount of data has been read from a large key,
the results of `self.resp.read()` will be disastrous.

This theory predicts that we should be able to make the bug disappear
by monkey-patching `boto.Key` so that its `.close` method always
behaves as though `fast=True` was passed:

```python
def fast_close(self, fast=True):
    self.resp = None
    self.mode = None
    self.closed = True

from boto.s3.key import Key
Key.close = fast_close
```

Indeed this makes the problem disappear[^5]—you can confirm this for
yourself by adding the above code to `app.py` in the demo repo.

---

So what did we learn from all this? There are several really
interesting things about this bug.

The first is that there's no one party on which we can pin the
blame. The problem arises from reasonable assumptions on everyone's
part. When I wrote the API code, I assumed could pass any old iterator
to the `Response` constructor, as the
[docs](http://flask.pocoo.org/docs/0.10/patterns/streaming/)
suggest. Flask/Werkzeug assume that calling `.close` on the response
iterator is (a) a good idea and (b) not too "expensive" in any sense
of the word. In most cases these are reasonable assumptions. Consider
a `file` object: calling `.close` on it is a good idea, since it
avoids a resource leak, and is not very costly. This assumption breaks
down in the case of a Boto `Key`, however, since Boto assumes that the
caller of a `Key`'s `close` method has read the documentation, which
clearly states that calling `close` results in the rest of the `Key`'s
data being read (a potentially very expensive operation).

All of these implicit assumptions being violated illustrate one of the
weaknesses of the "duck-typing" style of interface-driven programming
popular in Python. A Boto `Key` "quacks like a duck", or in this case
"`close`s like a file object", but the fact that it can quack/`close`
tells us nothing about what it really means or costs to perform that
operation. More sophisticated approaches (Java/Go interfaces,
typeclasses, etc.) don't really solve this problem either, but at
least they give you a place to document constraints on the behavior of
implementations so it's clear when an implementation is out of
line. In our case, if Python had a place where the "file-like object"
interface was declared and it was documented there that the `close`
method should have `O(1)` space complexity, then the `boto.Key`
implementation would very clearly be at fault. As it stands though,
"file-like object" is just a loose set of conventions that that
community agrees upon (or in this case, doesn't).

It also occurs to me that it's possible this bug exists in codebases
whose maintainers aren't even aware of it. Since S3 is primarily used
for "small" objects that easily fit in memory, this bug could easily
go completely unnoticed, wasting memory and CPU time whenever a
request is close prematurely. The only reason it was so obvious here
is due to the large size of the `Key`s being streamed.

Lastly and most importantly, this bug illustrates that even if you use
proven, high quality libraries, you will eventually run into problems
that require you to dive into and debug their code. This doesn't mean
that you should renounce libraries or only agree to use them after
vetting every line of them—after all, modern software systems are
largely about standing on the shoulders of giants. In most projects
you'll only write a tiny fraction of the lines of code you use[^6]. It
does mean, however, that you should own your chosen libraries as a
part of your complete system, and be willing analyze, debug, and fix
library code just as you would your own when it causes problems. So
choose libraries with care and don't be afraid to dive into their code
when the need arises—you might just learn something.



[^1]: In some sense, this turned out to be true—read on.
[^2]: `strace` is also a great debugging tool, you can read all about it on [Julia's blog](http://jvns.ca/blog/categories/strace/).
[^3]: [Werkzeug](http://werkzeug.pocoo.org/) is the underlying WSGI library that Flask uses under the hood.
[^4]: This is set in the [`BaseResponse` constructor](https://github.com/mitsuhiko/werkzeug/blob/0.10.4/werkzeug/wrappers.py#L784).
[^5]: A less hacky solution would involve wrapping `Key` in a class with a smarter `.close` method.
[^6]: Think about a web application written using Django, which runs in Python, is deployed using Apache, on top of Linux, etc.
