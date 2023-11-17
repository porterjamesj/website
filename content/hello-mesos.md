---
title: Hello Mesos
date: 2014-11-15
slug: hello-mesos
summary: The tiniest Apache Mesos framework
guid: 'tag:jamesporter.me,2014-11-15:/2014/11/15/hello-mesos.html'
aliases:
  - '/2014/11/15/hello-mesos.html'
---


There's always some new piece of software to be excited about and
right now it's [Apache Mesos](http://mesos.apache.org/). Mesos is a
cluster management system intended to make wrangling large numbers of
machines less of a headache. Unfortunately finding a more detailed
explanation of how it actually works can be challenging.  The
official site says:

> Apache Mesos abstracts CPU, memory, storage, and other compute
> resources away from machines (physical or virtual), enabling
> fault-tolerant and elastic distributed systems to easily be built
> and run effectively.

Wow that sounds great! But how do I use it?

The [Mesosphere](http://mesosphere.com/) website has a lot of language
like:

> Grow to tens of thousands of nodes effortlessly while dynamically
> allocating resources with ease.

Again, sounds really cool! But I still have no idea how to actually
program against it.

Mesos has a lot of hype right now, so most descriptions of it tend to
be vague and full of buzzwords and hyperbole[^1]. It's difficult to
find any good examples showing how it actually works. Here I'll detail
my quest to do just that, and explain the code for my
[Hello World Mesos framework](https://gist.github.com/porterjamesj/93e0ba46f0fa6faf660d),
which is hopefully one such example.

----

With a bit more googling, it's not too difficult to find 10,000 foot
view explanations of the mechanics of Mesos. The
[architecture guide](http://mesos.apache.org/documentation/latest/mesos-architecture/)
on the official site is
OK. [This talk](https://www.youtube.com/watch?v=gVGZHzRjvo0) from
David Greenberg is a really good explanation of the basic
concepts. The
[Mesos Paper](http://people.csail.mit.edu/matei/papers/2011/nsdi_mesos.pdf)
is also quite readable and does a good job justifying the system's
design.

The core abstraction of Mesos is a *framework*, which consists of a
*scheduler* and an *executor*. A scheduler coordinates distributing
some work, and a executor does some part of that work. Many familiar
systems fit into this pattern. Consider Hadoop (the `JobTracker` is a
scheduler and a `TaskTracker` is an executor), traditional HPC cluster
management systems like TORQUE (`pbs_sched` is an scheduler, `pbs_mom`
is an executor), or a web application deployment system (the deploy
server is a scheduler, the application itself is an executor).

The goal of Mesos is to abstract the machines in a cluster away from
all these frameworks that have to run on it. The way this works is
that the cluster is entirely managed by Mesos—all machines in the
cluster are configured as Mesos slaves[^2], which register with a
Mesos master. The Mesos master makes *resource offers* (which are
basically descriptions of an available Mesos slave) to the framework
schedulers, which can claim those offers for their executors. Mesos
then handles actually launching executors on slaves, communicating
executor status back to the framework scheduler, etc. What's cool
about this is that once you have it set up, you can reallocate
resources among the various frameworks running in your cluster by
simply tweaking the settings that determine how Mesos allocates
resource offers between frameworks, rather than having to manually
reconfigure your machines.

What's left unsaid in all of the above, however, is how to actually
write a Mesos framework. Googling for "mesos hello world" yields
[this](https://gist.github.com/guenter/7471695), which is pretty neat,
but I don't know Scala, I've heard Mesos has a Python API, and I
really like using Python when I'm learning how to do something
new. Looking for Python examples yields
[this](https://github.com/ceteri/exelixi), but for some reason its
author includes extraneous discussion of genetic programming, monoids,
HDFS, route planning, and a bazillion other things that only serve to
obscure the main point.

I just wanted a simple hello world example in Python, which is exactly
what I'll walk you through now. All of this code that follows assumes
Mesos version 0.20.0:

```python
import logging
import uuid
import time

from mesos.interface import Scheduler
from mesos.native import MesosSchedulerDriver
from mesos.interface import mesos_pb2

logging.basicConfig(level=logging.INFO)

def new_task(offer):
    task = mesos_pb2.TaskInfo()
    id = uuid.uuid4()
    task.task_id.value = str(id)
    task.slave_id.value = offer.slave_id.value
    task.name = "task {}".format(str(id))

    cpus = task.resources.add()
    cpus.name = "cpus"
    cpus.type = mesos_pb2.Value.SCALAR
    cpus.scalar.value = 1

    mem = task.resources.add()
    mem.name = "mem"
    mem.type = mesos_pb2.Value.SCALAR
    mem.scalar.value = 1

    return task


class HelloWorldScheduler(Scheduler):

    def registered(self, driver, framework_id, master_info):
        logging.info("Registered with framework id: {}".format(framework_id))

    def resourceOffers(self, driver, offers):
        logging.info("Recieved resource offers: {}".format([o.id.value for o in offers]))
        # whenever we get an offer, we accept it and use it to launch a task that
        # just echos hello world to stdout
        for offer in offers:
            task = new_task(offer)
            task.command.value = "echo hello world"
            time.sleep(2)
            logging.info("Launching task {task} "
                         "using offer {offer}.".format(task=task.task_id.value,
                                                       offer=offer.id.value))
            tasks = [task]
            driver.launchTasks(offer.id, tasks)

if __name__ == '__main__':
    # make us a framework
    framework = mesos_pb2.FrameworkInfo()
    framework.user = ""  # Have Mesos fill in the current user.
    framework.name = "hello-world"
    driver = MesosSchedulerDriver(
        HelloWorldScheduler(),
        framework,
        "zk://localhost:2181/mesos"  # assumes running on the master
    )
    driver.run()
```


Let's step through it one piece at a time. We start with a fairly
typical slew of standard library imports

```python
import logging
import uuid
import time
```

before importing the relevant parts of the `mesos` library:

    :::python
    from mesos.interface import Scheduler
    from mesos.native import MesosSchedulerDriver
    from mesos.interface import mesos_pb2

Unfortunately `mesos` is not pip-installable at the moment. The best
way to use it is to `easy_install` pre-built eggs for your platform,
which can be obtained from the
[Mesosphere downloads page](https://mesosphere.com/downloads/).

There are two classes involved here. We subclass the `Scheduler` class
and implement callbacks containing the logic of our framework. These
callbacks are invoked when messages are received from the Mesos
master. The `MesosSchedulerDriver` handles all communication with the
master—the scheduler delegates to the driver when it has something to
communicate. `mesos_pb2` contains
[protobuf](http://en.wikipedia.org/wiki/Protocol_Buffers) definitions
that we'll need (Mesos uses protobufs for network communication).

Next we set up some quick logging

    :::python
    logging.basicConfig(level=logging.INFO)

and declare our scheduler class.

    :::python
    class HelloWorldScheduler(Scheduler):

We're going to write a scheduler called `HelloWorldScheduler`. This
scheduler is very simple: whenever it gets a resource offer from the
Mesos master, it uses the offer to launch an executor that runs `echo
hello world`. Inheriting from `mesos.interface.Scheduler` gives us
stub implementations of the Mesos API methods we aren't going to
override. You can see a complete list of these methods with their
descriptions
[here](https://github.com/apache/mesos/blob/master/src/python/interface/src/mesos/interface/__init__.py). The
first one is `registered`:

    :::python
    def registered(self, driver, framework_id, master_info):
        logging.info("Registered with framework id: {}".format(framework_id))


`registered` is a method that gets invoked with when this framework
registers with the Mesos master. We get passed our the id we've been
assigned (`framework_id`) and a protobuf containing information about
the master we're registered with (`master_info`). We're just logging
that this happened, but you could imagine setting up stateful
resources (e.g. database connections) here.

Next we implement `resourceOffers`, which is a method that gets
invoked when the scheduler receives resource offers from the Mesos
master.

    :::python
    def resourceOffers(self, driver, offers):
        logging.info("Recieved resource offers: {}".format([o.id.value for o in offers]))
        # whenever we get an offer, we accept it and use it to launch a task that
        # just echos hello world to stdout
        for offer in offers:
            task = new_task(offer)
            task.command.value = "echo hello world"
            time.sleep(2)
            logging.info("Launching task {task} "
                         "using offer {offer}.".format(task=task.task_id.value,
                                                       offer=offer.id.value))
            tasks = [task]
            driver.launchTasks(offer.id, tasks)

This is the meat of the scheduler. Let's step through it a few lines
at a time:

    :::python
    def resourceOffers(self, driver, offers):

`resourceOffers` is passed the `driver` that our scheduler is being
run by, as well as `offers` (which is a list of protobufs, each of
which contains information about an offer). Remember that the
scheduler class only contains our framework specific logic and
delegates all communication with Mesos to the driver. This is why we
are passed the driver in this method—we'll need to tell the Mesos
master what we want to do with these offers[^3].

    :::python
    for offer in offers:
        task = new_task(offer)

We iterate over the offers received, creating a new task for
each. Let's look at the implementation of `new_task`:

    :::python
    def new_task(offer):
        task = mesos_pb2.TaskInfo()
        id = uuid.uuid4()
        task.task_id.value = str(id)
        task.slave_id.value = offer.slave_id.value
        task.name = "task {}".format(str(id))

        cpus = task.resources.add()
        cpus.name = "cpus"
        cpus.type = mesos_pb2.Value.SCALAR
        cpus.scalar.value = 1

        mem = task.resources.add()
        mem.name = "mem"
        mem.type = mesos_pb2.Value.SCALAR
        mem.scalar.value = 1

        return task

We instantiate a new `TaskInfo` protobuf[^4] and fill it in with some
basic details (a unique id, the id of the slave we want to use, and a
name). We then request 1 CPU and 1 megabyte of memory. We aren't
actually checking to make sure the offer contains these resources, but
it probably does (it's quite a modest request), and we could make
sure if we wanted to by inspecting the `offer.resources` list. We then
return the protobuf. OK, let's jump back to `resourceOffers`:

    :::python
    task.command.value = "echo hello world"

now that we've created a generic task protobuf, we fill in its
`command` field with what we actually want the task to do, in this
case simply `echo hello world`.

    :::python
    time.sleep(2)
    logging.info("Launching task {task} "
                 "using offer {offer}.".format(task=task.task_id.value,
                                               offer=offer.id.value))
    tasks = [task]
    driver.launchTasks(offer.id, tasks)

We then sleep for 2 seconds (which is there just so it's easier to
watch the framework run in real time), log the fact of being about to
launch the task, and do so by calling `driver.launchTasks` with the id
of the offer we want to use and the list of tasks we want to launch on
it[^5].

Anyway, that's the entirety of our scheduler class! Now we just need
to start up a driver and connect to the Mesos master.

    :::python
    if __name__ == '__main__':
        framework = mesos_pb2.FrameworkInfo()
        framework.user = ""  # Have Mesos fill in the current user.
        framework.name = "hello-world"
        driver = MesosSchedulerDriver(
            HelloWorldScheduler(),
            framework,
            "zk://localhost:2181/mesos"  # assumes running on the master
        )
        driver.run()

The `MesosSchedulerDriver` takes three parameters: an instance of
something that implements the `Scheduler` interface (in our case a
`HelloWorldScheduler`), a `FrameworkInfo` protobuf (which has things
like the id and name of this framework), and a string containing the
Zookeeper address URI of the Mesos cluster we want the framework to
register with[^6]. Note that in this code, we assume that the
Zookeeper instance is running on the same machine that the framework
is being started on (in general this doesn't have to be the case). The
driver we instantiate here is the object that gets passed to the
scheduler's callbacks to allow it to communicate with Mesos.

After instantiating the driver, we then call `driver.run()` to start the framework.

I ran this code using `python hello_mesos.py` on a small Mesos cluster
with a single master and a single slave. What results is:

    :::text
    I1116 15:54:31.813361 27339 sched.cpp:139] Version: 0.20.0
    2014-11-16 15:54:31,813:27339(0x7fe781a9d700):ZOO_INFO@log_env@712: Client environment:zookeeper.version=zookeeper C client 3.4.5
    2014-11-16 15:54:31,815:27339(0x7fe781a9d700):ZOO_INFO@log_env@716: Client environment:host.name=mesos-master.novalocal
    2014-11-16 15:54:31,816:27339(0x7fe781a9d700):ZOO_INFO@log_env@723: Client environment:os.name=Linux
    2014-11-16 15:54:31,816:27339(0x7fe781a9d700):ZOO_INFO@log_env@724: Client environment:os.arch=3.13.0-32-generic
    2014-11-16 15:54:31,817:27339(0x7fe781a9d700):ZOO_INFO@log_env@725: Client environment:os.version=#57-Ubuntu SMP Tue Jul 15 03:51:08 UTC 2014
    2014-11-16 15:54:31,818:27339(0x7fe781a9d700):ZOO_INFO@log_env@733: Client environment:user.name=ubuntu
    2014-11-16 15:54:31,819:27339(0x7fe781a9d700):ZOO_INFO@log_env@741: Client environment:user.home=/home/ubuntu
    2014-11-16 15:54:31,820:27339(0x7fe781a9d700):ZOO_INFO@log_env@753: Client environment:user.dir=/home/ubuntu
    2014-11-16 15:54:31,820:27339(0x7fe781a9d700):ZOO_INFO@zookeeper_init@786: Initiating client connection, host=localhost:2181 sessionTimeout=10000 watcher=0x7fe782eefa90 sessionId=0 sessionPasswd=<null> context=0x7fe774000930 flags=0
    2014-11-16 15:54:31,823:27339(0x7fe76ffff700):ZOO_INFO@check_events@1703: initiated connection to server [127.0.0.1:2181]
    2014-11-16 15:54:31,826:27339(0x7fe76ffff700):ZOO_INFO@check_events@1750: session establishment complete on server [127.0.0.1:2181], sessionId=0x149b22cdfe600a8, negotiated timeout=10000
    I1116 15:54:31.826449 27350 group.cpp:313] Group process (group(1)@172.16.1.34:59733) connected to ZooKeeper
    I1116 15:54:31.826498 27350 group.cpp:787] Syncing group operations: queue size (joins, cancels, datas) = (0, 0, 0)
    I1116 15:54:31.826529 27350 group.cpp:385] Trying to create path '/mesos' in ZooKeeper
    I1116 15:54:31.830415 27350 detector.cpp:138] Detected a new leader: (id='0')
    I1116 15:54:31.831310 27350 group.cpp:658] Trying to get '/mesos/info_0000000000' in ZooKeeper
    I1116 15:54:31.833284 27350 detector.cpp:426] A new leading master (UPID=master@172.16.1.34:5050) is detected
    I1116 15:54:31.834072 27350 sched.cpp:235] New master detected at master@172.16.1.34:5050
    I1116 15:54:31.835058 27350 sched.cpp:243] No credentials provided. Attempting to register without authentication
    I1116 15:54:31.838003 27349 sched.cpp:409] Framework registered with 20141115-003844-570495148-5050-6532-0067
    INFO:root:Registered with framework id: value: "20141115-003844-570495148-5050-6532-0067"

    INFO:root:Recieved resource offers: [u'20141115-003844-570495148-5050-6532-387']
    INFO:root:Got a resource offer.
    INFO:root:Launching task bcebedef-6e37-450d-99ca-84206a5385de using offer 20141115-003844-570495148-5050-6532-387.
    INFO:root:Recieved resource offers: [u'20141115-003844-570495148-5050-6532-388']
    INFO:root:Got a resource offer.
    INFO:root:Launching task 197bcdd0-91e0-4647-a271-00356c6e1133 using offer 20141115-003844-570495148-5050-6532-388.
    INFO:root:Recieved resource offers: [u'20141115-003844-570495148-5050-6532-389']
    INFO:root:Got a resource offer.
    INFO:root:Launching task 376f65f6-f7c2-4e0a-8307-a7c489348a4e using offer 20141115-003844-570495148-5050-6532-389.
    . . .

The log messages go on forever as the scheduler continuously receives
a single resource offer (corresponding to the single slave) and
launches `echo hello world` on it.

We can see that the task is running successfully by `ssh`ing into the
slave and checking the `stdout` of one of the tasks (all of which are
saved in logfiles):

    ubuntu@mesos-slave:~$ cat /tmp/mesos/slaves/20141115-003844-570495148-5050-6532-0/frameworks/20141115-003844-570495148-5050-6532-0067/executors/bcebedef-6e37-450d-99ca-84206a5385de/runs/latest/stdout
    Registered executor on mesos-slave.novalocal
    Starting task bcebedef-6e37-450d-99ca-84206a5385de
    Forked command at 13319
    sh -c 'echo hello world'
    hello world
    Command exited with status 0 (pid: 13319)

Ta-da! A Mesos framework in 60 lines of code.

Hopefully this helps to clarify somewhat how the system works for
others who were confused.

[^1]: This isn't helped by that fact that people deploying a Mesos
      cluster don't usually have to program directly against it
      themselves, but rather just use frameworks already written by
      other people—knowing the details of what's going on underneath
      is an afterthought.

[^2]: I feel uncomfortable using the master/slave terminology and
      [agree with the Django team](https://github.com/django/django/pull/2692)
      that it's bad, but it's the official Mesos terminology, so in
      order to avoid confusion I defer and reluctantly describe things
      this way.

[^3]: As far as where the driver comes from in the first place, we'll
      get there, be patient.


[^4]: By the way, you can read all of the Mesos protobuf definitions
      [here](https://github.com/apache/mesos/blob/master/include/mesos/mesos.proto).
      This can be pretty useful for figuring out what your options are
      when communicating using them, as well as just how the system
      works in general. Some of the comments are very handy, it's a
      shame they're buried here rather than displayed prominently in
      the documentation.

[^5]: One confusing bit here is the seemingly useless creation of a
      reference (`tasks`) to the list containing the single task we
      want to launch. It would seems simpler to just do
      `driver.launchTasks(offer.id, [tasks])`. I am not sure why this
      happens, but when I do that, the driver's Python-C++ interface
      crashes
      [here](https://github.com/apache/mesos/blob/0.20.1/src/python/native/src/mesos/native/mesos_scheduler_driver_impl.cpp#L462-L463). I
      suspect some sort of GC issue.

[^6]: Mesos uses Zookeeper for state tracking and leader
      election.
