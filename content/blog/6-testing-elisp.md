Title: Testing Emacs Packages: surprisingly non-awful
Date: 2014-05-15
Slug: testing-elisp
Summary: I wrote some tests for my emacs package

Last summer I found myself dissatisfied with the existing solutions
for managing Python [virtualenvs](https://github.com/pypa/virtualenv)
from inside Emacs, so I wrote my own
[package](https://github.com/porterjamesj/virtualenvwrapper.el) for
doing so. This was partially an exercise for me to learn more about
extending Emacs and partially an attempt to improve my own Python
programming workflow. Since that time
[the old Emacs virtualenv tool](https://github.com/aculich/virtualenv.el)
has been deprecated and mine has become a reasonably popular
replacement. I figured if other people are actually using it, I should
probably start taking things a bit more seriously and write some tests
so I don't accidentally break everyone's workflow with a careless
update. My previous brushes with Emacs lisp development had led me to
believe the experience was going to be extremely painful but happily this
turned out not to be the case.

There are a variety of fancy Elisp testing frameworks, but I ended up
going with the one built in to Emacs,
[ert](https://www.gnu.org/software/emacs/manual/html_node/ert/index.html),
along with [Cask](http://cask.github.io/) and
[ert-runner](https://github.com/rejeep/ert-runner.el) to easily run
tests from the command line in a headless Emacs instance. Here I'll
describe what the experience was like and how I used some of the nicer
parts of Emacs lisp to make it more pleasant.

----

The first thing I wanted to do was to simply test that activating a
virtualenv correctly makes all the changes it should. The
`ert-deftest` macro is used to define tests, so I wrote:

    :::scheme
    (ert-deftest venv-workon-works ()
     (venv-deactivate)
     (venv-workon "science")
     ;; we store the name correctly
     (should (equal venv-current-name "science"))
     ;; we change the path for python mode
     (should (s-contains? "science" python-shell-virtualenv-path))
     ;; we set PATH for shell and subprocesses
     (should (s-contains? "science" (getenv "PATH")))
     ;; we set VIRTUAL_ENV for jedi and whoever else needs it
     (should (s-contains? "science" (getenv "VIRTUAL_ENV")))
     ;; we add our dir to exec-path
     (should (s-contains? "science" (car exec-path)))))

Note the use of the `should` macro to state expectations—if the
argument to any invocation of `should` doesn't evaluate to a non-`nil`
value without throwing an error, the test will fail.

The above test works, but only because I already have a virtualenv
called `science`. It would probably fail if you tried to run it on
your machine, since you probably don't. The next thing I needed was
some sort of test fixtures mechanism to create a temporary virtualenv
for each test and then delete it when the test was done. I was
surprised to find that ert has no such fixtures mechanism built-in,
but only until I read the manual, which suggested just writing a macro
to do setup and teardown. Oh of course; this is lisp; we can do
that!  It's easy to forget that a lot of languages need things like
test fixtures to paper over the lack of real metaprogramming
capabilities. I wrote a `with-temp-env` macro to use in my tests:

    :::scheme
    (defmacro with-temp-env (name &rest forms)
      (let ((venv-location temporary-file-directory))
        (venv-mkvirtualenv ,name)
        ,@forms
        (venv-rmvirtualenv ,name)))

The macro takes the name of a temporary virtualenv to create and some
forms to execute in that virtualenv. It then `let`-binds
`venv-location` to be the value of `temporary-file-directory`, which
is a variable that gets set on Emacs startup to be a platform specific
location in which it's OK to put temporary files. Finally, it makes a
new temporary virtualenv of the correct name (by splicing it in with
`,name`), executes the forms (by splicing them into the `let` body
with `,@forms`), and destroys the virtualenv when done. Not too
complicated and it seems to work fine.

But there's a problem here! What if an error is thrown somewhere
during the execution of `forms`? The temporary virtualenv will never
be cleaned up, since `venv-rmvirtualenv` is never reached.  I realized
I needed the Emacs equivalent of a `finally` clause in more mainstream
languages. Turns out this is not too terrible aside from a confusing
name—the `unwind-protect` macro takes a form to execute and a
"cleanup" from, and guarantees that the cleanup form will be run
regardless of whether errors are thrown in the main form. I used this
to adjust my `with-temp-env` macro to the following:

    :::scheme
    (defmacro with-temp-env (name &rest forms)
      (let ((venv-location temporary-file-directory))
        `(unwind-protect
             (progn
               (venv-mkvirtualenv ,name)
               ,@forms)
           (venv-rmvirtualenv ,name))))

I did have to wrap the call to `venv-mkvirtualenv` and the form
splicing in a `progn` in order to use `unwind-protect`, since it
requires a single form to execute as it's first argument, but overall
not too shabby. This version is robust to errors during the execution
of the `forms`. I was able to change my `venv-workon-works` test to
the following:

    :::scheme
    (ert-deftest venv-workon-works ()
      (with-temp-env
       "emacs-venvwrapper-test"
       (venv-deactivate)
       (venv-workon venv-tmp-env)
       ;; we store the name correctly
       (should (equal venv-current-name venv-tmp-env))
       ;; we change the path for python mode
       (should (s-contains? venv-tmp-env python-shell-virtualenv-path))
       ;; we set PATH for shell and subprocesses
       (should (s-contains? venv-tmp-env (getenv "PATH")))
       ;; we set VIRTUAL_ENV for jedi and whoever else needs it
       (should (s-contains? venv-tmp-env (getenv "VIRTUAL_ENV")))
       ;; we add our dir to exec-path
       (should (s-contains? venv-tmp-env (car exec-path)))))

which will work reliably on systems besides my own. I was also able to
use the `with-tmp-env` macro and `unwind-protect` in my other tests,
e.g.:

    :::scheme
    (ert-deftest venv-cdvirtualenv-works ()
      (with-temp-env
       venv-tmp-env
       (let ((old-wd default-directory))
         (unwind-protect
             (progn
               (venv-cdvirtualenv)
               (should (s-contains? venv-tmp-env default-directory)))
           (cd old-wd)))))

which tests that the `venv-cd-virtualenv` command works correctly.

----

The one thing I was missing at this point was a good test runner, like
Python's `nosetests`.  It's very convenient to be able to type one
command and have your tests collected and run with nicely reported
output at the end. This is a bit more complicated in the Emacs world
due to the need to spin up a headless Emacs instance, but again was
not nearly as bad as I was expecting.

I found [ert-runner](https://github.com/rejeep/ert-runner.el), which
is a [Cask](http://cask.github.io/) extension for running ert tests.
Cask is a project management tool for Emacs packages, somewhat like
Bundler in the Ruby world or Leiningen for Clojure. I was somewhat
miffed to have to get this set up, but it wasn't that bad, just a
matter of adding a short `Cask` file to the project's root directory,
and, as a bonus you can now install all the dependancies for
development with `cask install --dev`. `ert-runner` will automatically
detect all ert tests under the `test` directory of a project root and
run them in a clean Emacs instance. So now I can type:

    $ cask exec ert-runner

and get some relatively nice test output:

     Loading /Users/james/projects/virtualenvwrapper.el/virtualenvwrapper.el (source)...
     Running 8 tests (2014-05-15 13:16:57-0500)


     Deleted virtualenv: emacs-venvwrapper-test
        passed  1/8  venv-cdvirtualenv-works

     Deleted virtualenv: copy-of-tmp-env
     Deleted virtualenv: emacs-venvwrapper-test
        passed  2/8  venv-cpvirtualenv-works

     Deleted virtualenv: emacs-venvwrapper-test
        passed  3/8  venv-deactivate-works

     Deleted virtualenv: emacs-venvwrapper-test
        passed  4/8  venv-list-virtualenvs-works

     Deleted virtualenv: emacs-venvwrapper-test
        passed  5/8  venv-mkvirtualenv-works

     Deleted virtualenv: emacs-venvwrapper-test
        passed  6/8  venv-rmvirtualenv-works
        passed  7/8  venv-workon-errors-for-nonexistance

     Deleted virtualenv: emacs-venvwrapper-test
        passed  8/8  venv-workon-works

     Ran 8 tests, 8 results as expected (2014-05-15 13:17:06-0500)

Cool! The moral of the story is, don't be afraid of testing your
Emacs lisp code, it isn't that bad!
