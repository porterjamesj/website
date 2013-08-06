Title: Emacs Lisp: Closures Exposed
Date: 2013-06-14
Slug: emacs-lisp-closures-exposed
Summary: Some interesting features of an old language

I recently learned about some interesting wrinkles in Emacs Lisp that
make it useful for learning about closures. First let's talk about
closures in more reasonable languages.

What do the the following code snippets do?

Python:

	:::python
	def fun1():
		x = 12
		return lambda y: x*y

	fun1()(3)

Javascript:

	:::javascript
	var fun1 = function() {
		var x = 12;
		return function (y) {
			return x*y;
		};
	};

	fun1()(3)

The answer is, they print 36. Each returns outer function returns an
anonymous function that is then called with the value `3` a an
input. But what about the equivalent code in Emacs Lisp?:

	:::scheme
    (funcall (let ((x 12))
		       (lambda (y)
			     (* x y))) 3)

This throws an error: `(void-variable x)`. Huh? What is going on? The
answer is that most modern languages, including Python and JavaScript,
are lexically scoped, whereas Emacs Lisp, being many decades old, is
dynamically scoped. What does this mean? It has to do with the
resolution of free variables. In each code example above, `x` is a
free variable in the innermost function call because it was not passed
as an argument and has no local definition. How is the value of a
free variable resolved then? In lexically scoped languages, the
language looks for definitions of free variables in the immediate
_lexical environment_, whereas in dynamically scoped langauges, the
language looks for definitions of free variables in the immediate
_evaluating environment_.

This explains our differing results above. Python and JavaScript see a
free variable `x` in the anonymous function returned by `fun1`. They
go look for a definition in the enclosing lexical scope (the
definition of `fun1`), see that here x is defined to be 12, and so use
12 as the value for x. Emacs Lisp, on other hand, does something
different. Using `funcall`, we asked it to call the following with
argument `3`:

	:::scheme
    (let ((x 12))
		   (lambda (y)
			 (* x y)))

The `let` statement says that during the evaluation of the following
code, let the value of `x` be 12. The keyword here is
_evaluation_. Emacs Lisp allows `x` to be 12 during the evaluation,
which returns a function of `y`. The evaluation is then over, so Emacs
Lisp promptly forgets the value of `x`! The lambda function returned
has no notion of the fact that `x` is twelve in its lexical
environment; when this function is called by `funcall` it is called in
the global scope, in which there is no definition of `x`, hence
`(void-variable x)`.

This seems weird by modern lights, because most languages we write
code in regularly are lexically scoped. Emacs Lisp gets ever weirder
though. Remember when I said that python and javascript "go look for a
definition in the enclosing lexical scope"? That was sort of a
lie. They don't really go looking through the text of your code trying
to find definitions, what actually happens is that when `fun1`
evaluates, it doesn't just return a bare anonymous function. Instead,
the function is returned along with some information about its lexical
environment. This infrmation is called a _closure_, and usually
consists of the values that any free variables had at the time the
function was definied. When python or javascript needs to know the
value of `x` during evaluation, they go look up its definition in the
closure. You can't actually examine closures in the language itself;
they're specially protected and hidden away in the implementation. But
let's go back to Emacs Lisp for a moment. When we execute

	:::scheme
    (let ((x 12)) (lambda (y) (* x y)))

We get back:

	:::scheme
    (lambda (y) (* x y))

which is a function definition, pretty much what we expected. Notice
that this expression evluated on its own (which is effectively what we
were doing when we did the `funcall` above) has no way of figuring out
what `x` is (i.e. no closure containing a definition of `x`). Where
Emacs Lisp gets weird is that it is possible to have lexical scoping,
but its an optional feature that you have to turn on. Let's try it:

	:::scheme
	(setq lexical-binding t)

	(let ((x 12))
		   (lambda (y)
		     (* x y)))

Now the second expression evaluates to:

	:::scheme
	(closure ((x . 12) t) (y) (* x y))

Aha! A closure! The first part of the closure is a list of pairs that
describe the lexical environment. We can see that `x` is bound
to 12. The remainder of the closure is the argument list and function
body. Because lexical scope was tacked onto Elisp decades after its
creation, it doesn't hide closures away from you the way more modern
languages do; they are right there, available to be inspected as data
structures in the language itself, which is really pretty bizarre. If
we funcall this with 3 as an argument, we get 36, just like we did in
python or javascript. Internally, these languages are doing the same
thing, we as programmers are just not allowed to see it. Emacs Lisp is
adorably trusting; however, which means we can do stupidly silly
things. The closure is just a list, so we can use it as we would any
other:

	:::scheme
    (setq c (let ((x 12))
              (lambda (y)
		        (* x y))))

The closure is now bound to the symbol `c`, and we can funcall it:

	:::scheme
    (funcall c 3)
    ;; => 36

We can also modify it, e.g.:

	:::scheme
    (setcdr (caadr cl) 5)

We set the `cdr` of the `car` of the `car` of the `cdr` of `c`
to 5. This changes `c` to:

	:::scheme
    (closure ((x . 5) t) (y) (* x y))

And now:

	:::scheme
    (funcall c 3)
	;; => 15

I personally find this totally hilarious, and I hope its at least
somewhat illuminating with respect to what a closure is as well.
