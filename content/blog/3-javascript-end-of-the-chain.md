Title: JavaScript: End of the Chain
Date: 2013-08-06
Slug: javascript-end-of-the-chain
Summary: How does property lookup bottom out?

Since coming to Hacker School I've learned JavaScript. One of the
first things you're told about the language is that it uses prototypal
inheritance, which is actually a lot simpler than classical
inheritance and is pretty easily understood through a few
examples. This made sense to me, but I was never quite clear on
exactly how the prototype chain bottomed out. I rooted around the
Chrome REPL and the blogosphere for a while trying to find a good
answer and came up short. Eventually I ended up digging into
[the spec](http://www.ecma-international.org/publications/standards/Ecma-262.htm)
(a surprisingly readable document) in order to figure it out. What I
learned was either maddening or enlightening or perhaps both. Before
jumping into it, let's review basic prototypal inheritance. Imagine we
have a constructor function for a `Person`, which has on its protoype
a `sayName` method:

    :::javascript
    var Person = function(name,age) {
      this.name = name;
      this.age = age;
    };

    Person.prototype.sayName = function () {
      console.log("Hi, I'm " + this.name + "!");
    };


Any new objects created with `Person` as their constructor will have
access to the `sayName` method via the prototype chain. To see this,
let's create a sample person.

    :::javascript
    > var james = new Person("James",21);
    > james.sayName();
    "Hi, I'm James!"

OK, what actually happened there? When we say `var james = new
Person("James",21)`, we create a new object, `james`. The `Person`
function is then run with `james` as its context (so `this` refers to
`james`), and `Person.prototype` is assigned to
`james.__proto__`. This last bit is what's critical for understanding
the prototype chain and how property lookup works. Every object has a
`__proto__`[^1], which can be thought of as a pointer to the prototype
of the object's constructor.  When the JavaScript runtime goes to do a
property lookup, it first checks if the object itself has a property
with the requested name. If the property is not found, whatever is
pointed to by the object's `__proto__` is checked for the property. If
it's still not found there, the process repeats
(i.e. `object.__proto__.__proto__` is checked), and again, and again, until
the prototype chain bottoms out. In our example above, the process can be
visualized as something like the following:

![prototype chain example](/static/img/prototypes/prototype_chain_example.jpg)

First, `james` itself is checked for a property `sayName`. No such
property is found, so `james.__proto__` (i.e. `Person.prototype`) is
checked. At this point, `sayName` is found and the lookup is
done. But what about when the property _isn't_ found on
`Person.prototype`? What happens when a lookup fails? Something like:

    :::javascript
    > james.nope
    undefined

It's clear that `Person.prototype.__proto__` will be checked, but what
does `Person.prototype.__proto__` point to? These questions bothered me
even after I understood the gist of prototypal inheritance. I fooled
around in the Chrome REPL for a while trying to figure it out,
playing with `Function`, `Object`, etc. Eventually I discovered
the following:

    :::javascript
    > Function instanceof Object
    true
    > Object instanceof Function
    true
    > Function instanceof Function
    true
    > Object instanceof Function
    true

[Wat](/static/img/prototypes/wat1.jpg). This made just about zero
sense.  I was quite confused and so I spent a morning digging through
the spec and figuring out what was what. Let's walk through what I
learned with the goal of understanding two things:

1. What exactly is happening when we ask for `james.nope` and get back `undefined`?
2. How are `Object` and `Function` instances of themselves and each other?

----

First we need to talk about what
`Function` and `Object` actually are. The spec says:

> **15.2.2 The Object Constructor**
>
> When **`Object`** is called as part of a **`new`** expression, it is a constructor
> that may create an object.

As well as:

> The production ObjectLiteral : **`{ }`** is evaluated as follows:
>
> 1. Return a new object created as if by the expression **`new Object()`**
>    where **`Object`** is the standard builtin constructor with that name.

Aha, so `Object` is the object constructor. It is a function that is
implicitly invoked when a new object literal is created. The spec says
something similar about `Function`.  It is the function constructor,
and is implcitly invoked when a new function is created. What else
can we learn about these things?

> **15.2.3.1 Object.prototype**
>
> The initial value of **`Object.prototype`** is
> the standard built-in Object prototype object (15.2.4).

Additionally:

> **15.3.3.1 Function.prototype**
>
> The initial value of **`Function.prototype`** is the standard built-in
> Function prototype object (15.3.4).

OK, now we're getting somewhere. Let's make a chart to keep track of this
stuff:

![prototype chart 1](/static/img/prototypes/prototype_chart1.jpg)

`Function` and `Object` are the constructors for functions and objects
respectively, and they each have a prototype, which is sort of a weird
hidden object that's not accessible except through these
constructors. "standard built-in Function prototype object" and
"standard built-in Object prototype object" are a bit of a mouthful so
I'll just refer to these as the "ur-function" and the "ur-object" from
here on out.

Now we're going to read through the spec to fill in the blanks on this
chart and then use it to answer the two questions we posed above.

First let's look at the ur-object. Again quoting from the spec:

> **15.2.4 Properties of the Object Prototype Object**
>
> The value of the [[Prototype]] internal property of the
> Object prototype object is **null** . . .

Wait, what's "the _[[Prototype]]_ internal property"? It turns out
that this is just the "pointer" that the runtime uses to walk up the
prototype chain during property lookup; the thing that some
implementers have chosen to expose as `__proto__`. Knowing this, we
can fill in another part of our chart:

![prototype chart 2](/static/img/prototypes/prototype_chart2.jpg)

Aha! _This_ is where the prototype chain bottoms out! Everytime the
runtime fails to find a property, its because it eventually got all
the way to looking at `Object.prototype.__proto__`, which is `null`.
We still need to figure out how the lookup gets here though. Let's
keep filling in our chart. We know what `Function.prototype` and
`Object.prototype` are, but what about `Function.__proto__` and
`Object.__proto__`? Any guesses? Here's the spec:

> **15.2.3 Properties of the Object Constructor**
>
> The value of the [[Prototype]] internal property of the Object
> constructor is the standard built-in Function prototype object.

also,

> **15.3.3 Properties of the Function Constructor**
>
> . . . The value of the [[Prototype]] internal property of the Function
> constructor is the standard built-in Function prototype object
> (15.3.4).

Which makes our chart look like this:

![prototype_chart3.jpg](/static/img/prototypes/prototype_chart3.jpg)

This makes sense: `Function` and `Object` are both constructor
functions, so their prototypes are the ur-function. But notice that
there's something weird going on here:

    :::javascript
    > Function.prototype === Function.__proto__
    true

WTF?! Yes, this is true, go try it yourself. This also makes sense in a
perverse sort of way. `Function` is the constructor function for all
functions, so its the only thing that is its own constructor, which is
what `Functon.prototype === Function.__proto__` means, afterall[^2].

We're getting closer to understanding, but there's a few more things
to fill in. We still don't know what the ur-function's `__proto__` is;
let's check the spec:

> The value of the [[Prototype]] internal property of the Function
> prototype object is the standard built-in Object prototype object
> (15.2.4).

This leaves only the `prototype`s of the ur-function and ur-object
undefined. It turns out the spec has nothing to say about these, so they
are just that: `undefined`. This completes our chart:

![prototype_chart4.jpg](/static/img/prototypes/prototype_chart4.jpg)

Phew, that was exhausting. OK, now let's use this chart to figure out
how the prototype chain bottoms out by revisiting our initial example
of a `Person`. What's actually happening when we ask for
`james.nope` and get back `undefined`? First we check if `james` has a `nope`
property. Nope. Then we look at `james.__proto__`, which is
`Person.prototype`. Nope. Now we look as `james.__proto__.__proto__`,
which is `Person.prototype.__proto__`.  `Person.prototype` is just an
object like any other. It was constructed by the object constructor,
so its `prototype` is `Object.prototype`, the ur-object. Let's be sure
this is the case:

    :::javascript
    > james.__proto__.__proto__ === Object.prototype
    true

Cool. `Object.prototype` doesn't have a `nope` property, so we move on
to look at `james.__proto__.__proto__.__proto__`, which is the
ur-object's `__proto__`, which is `null`. Here the chain bottoms out
and we return `undefined`.

If the above accurately describes what happens, we should be able to
prevent the bottom out by assigning to `Object.prototype` (the
ur-object).

    :::javascript
    > Object.prototype.yep = "Here I am!"
    > james.yep
    "Me too!"

Yes!

OK, so now we understand how property lookup bottoms out, but what about
our other goal? Wherefore this madness?:

    :::javascript
    > Function instanceof Object
    true
    > Object instanceof Function
    true
    > Function instanceof Function
    true
    > Object instanceof Function
    true

First let's be sure we understand exactly what `instanceof` does.
[According to MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof):

> The `instanceof` operator tests whether an object has in its prototype
> chain the `prototype` property of a constructor.

OK, got it. Now let's look at each of the four cases above in turn.

First `Function instanceof Object`. I've highlighted `Function`'s prototype
chain in orange and `Object`'s `prototype` property in blue:

![Function instanceof Object](/static/img/prototypes/function_instanceof_object.jpg)

We see that the `Function`'s prototype chain terminates with
`Object.prototype`, which causes `Function instanceof Object` to be
true. This makes sense, since JavaScript functions are objects (they
can have properties assigned to them, etc.).

Now let's look at a similar diagram for `Object instanceof Function`:

![Object instanceof Function](/static/img/prototypes/object_instanceof_function.jpg)

`Object.__proto__` is the ur-function, `Function.prototype`, which means
`Object instanceof Function` is true. This makes sense too, since `Object` is
a function, namely the constructor function for objects.

Similar logic applies to `Function instanceof Function`:

![Function instance of Function](/static/img/prototypes/function_instanceof_function.jpg)

This leaves us with `Object instanceof Object`:

![Object instance of Object](/static/img/prototypes/object_instanceof_object.jpg)

`Object` is a constructor function, and all functions are objects, hence
`Object instanceof Function` is true.

So there you have it: a bunch of decisions that seem to make sense
when considered individually lead to behaviors that are bizarre and
confusing without careful examination. Hopefully this exploration
helped you better understand how prototypes, property lookup, and
object construction work, it certainly helped me.

----

Postscript: The content of this post was distilled from a presentation
I gave at [Hacker School](https://www.hackerschool.com/) which I
jokingly titled
[WAT II: Revenge of JavaScript](/static/misc/prototype_slides.pdf) in
homage to Gary Bernhardt's WAT talk. If you find this sort of
spelunking interesting, you should consider
[applying](https://www.hackerschool.com/apply).



[^1]: Note that `__proto__` is not part of the spec. The spec refers
      to an "internal _[[Prototype]]_ property", which some
      implementers have chosen to expose via `__proto__` because it
      useful for learning and debugging. I use it here because the latest
      versions of all the major web browsers and node have adopted this
      convention, but be aware that `__proto__` is _not_ in any
      way portable or to be relied upon in real code.

[^2]: i.e. `x` is `y`'s constructor if `y.__proto__ === x.prototype`, since
      one of the things that happens during construction is that the new object's
      `__proto__` is set to its constructors `prototype`.
