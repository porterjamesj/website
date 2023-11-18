---
title: How to succeed at parsing without really trying
slug: how-to-succeed-at-parsing
date: 2013-11-27
summary: cheating by using Julia metaprogramming
guid: 'tag:jamesporter.me,2013-11-27:/2013/11/27/how-to-succeed-at-parsing.html'
url: /2013/11/27/how-to-succeed-at-parsing.html
---

For one of the final biology courses of my undergraduate years, I'm
taking [a class](https://sites.google.com/a/fieldmuseum.org/rtol/) on
phylogenetic methods, which has been really interesting. For my final
project I'm implementing one such method,
[which tests for correlated evolution of discrete characters along a phylogeny](http://www.jstor.org/stable/2585328),
using my new favorite programming language, Julia. This post is about
a silly hack in which I used Julia's
[homoiconicity](http://docs.julialang.org/en/latest/manual/metaprogramming/)
to make parsing the data this method works on really, really easy.

----

As with most software projects, this one involves some amount of drudgery that
must be be undertaken before anything interesting to do with the
actual problem at hand can happen. In this case the drudgery takes the
form of parsing
[Newick strings](https://en.wikipedia.org/wiki/Newick_format), which
are the standard in the field for serializing phylogenetic trees.
Why not use a format for which parsers are ubiquitous, you might ask?
Well, Newick strings were developed in 1984, long before XML or JSON
were even glints in their respective standards committees' eyes.
Everyone still uses it today, so for better or worse, we are stuck
with it.

Of course many languages (at least those used for scientific
computing) already have Newick parsers. This includes Julia, in the
form of Ben Ward's
[Phylogenetics.jl](https://github.com/Ward9250/Phylogenetics.jl). However,
it's a port of an existing R package and I'm not particularly a fan of
the API, so I decided to write my own. Newick is a pretty
darn simple format so this would not have been particularly difficult
in any case, but after squinting at some examples for a bit I noticed
a way it could be made drop dead simple.

A typical Newick string looks something like this:

    (A:0.1,B:0.2,(C:0.3,D:0.4):0.5);

Each set of nested parentheses is a clade (a group of organisms all
descended from a single common ancestor), the numbers following the
colons represent branch lengths, and the letters are the names of the
tips. So this string might represent the tree[^1]:

![Newick example](https://upload.wikimedia.org/wikipedia/commons/3/3f/NewickExample.svg)

The silly hack I'm about to tell you about stems from the observation that
after some quick text munging, a Newick string is actually a valid Julia
expression whose structure mirrors the structure of the tree we want to
represent. This means that we can trick the Julia parser into doing most of
the work for us. First let's declare a type to represent a node on a phylogeny.

```julia
type PhyloNode
    label::String
    children::Vector{PhyloNode}
    length::Float64
end
```

Simple enough; a node has a label (name), a branch length, and some
children, which are also `PhyloNode`s. Now we're going to turn our
example Newick string into a tree of `PhyloNode`s by asking Julia to
parse it and manipulating the resulting
[`Expr` data structure](http://docs.julialang.org/en/latest/manual/metaprogramming/).
Imagine the example string above is in a variable called `example`. As
a preliminary, let's chomp off the trailing semicolon and replace all
the colons with plus signs (the reasons for this will become clear in a moment).

```julia
example = rstrip(example,';')
example = replace(example,":","+")
parsed_example = parse(example)
```

Let's take a look at `parsed_example` using the `dump` function:

```julia
julia> dump(parsed_example)
Expr
  head: Symbol tuple
  args: Array(Any,(3,))
    1: Expr
      head: Symbol call
      args: Array(Any,(3,))
        1: Symbol +
        2: Symbol A
        3: Float64 0.1
      typ: Any
    2: Expr
      head: Symbol call
      args: Array(Any,(3,))
        1: Symbol +
        2: Symbol B
        3: Float64 0.2
      typ: Any
    3: Expr
      head: Symbol call
      args: Array(Any,(3,))
        1: Symbol +
        2: Expr
          head: Symbol tuple
          args: Array(Any,(2,))
          typ: Any
        3: Float64 0.5
      typ: Any
  typ: Any
```

This is Julia's post-parsing internal representation of the example string. Notice
how its structure reflects the tree we are trying to build. Do you see why we
replaced each `:` with a `+`? Since `+` is an infix operator, the parser
has associated each node with it's branch length by making them both
arguments of a call to the `+` function! Really any infix operator would have
done here, I just chose `+` arbitrarily. OK, now let's write a function that will
take this parsed expression and build the tree we want!

```julia
function parsenewick(newick::Expr)
    if newick.head == :tuple
        # this is a node without a length
        children = [parsenewick(child)
                    for child in newick.args]
        name = ""
        length = -1
    elseif newick.head == :call && newick.args[1] == :+
        # + indicates node with length
        length = newick.args[3]
        if typeof(newick.args[2]) == Expr
            # internal node
            name = ""
            children = [parsenewick(child)
                        for child in newick.args[2].args]
        elseif typeof(newick.args[2]) == Symbol
            # tip
            name = string(newick.args[2])
            children = PhyloNode[]
        end
    end
    PhyloNode(name,children,length)
end
```

We recursively descend the expression, generating the appropriate node. A call to
`+` indicates a node with a length, a tuple indicates a node without a branch length
(note that I'm using a length of -1 to represent this). Let's try it out:

```julia
julia> parsenewick(parsed_example)
PhyloNode("",[PhyloNode("A",[],0.1),PhyloNode("B",[],0.2),PhyloNode("",[PhyloNode("C",[],0.3),PhyloNode("D",[],0.4)],0.5)],-1)
```

It works! That was easy. We now have a parser for 90% of the Newick strings in
the wild in about 20 lines of code.

----

Of course this is not nearly a complete parser. Most notably it will fail if we have
internal nodes with names, which are represented as:

    (A:0.1,B:0.2,(C:0.3,D:0.4)E:0.5)F;

This is a more complete representation of the tree in the image above,
as it includes the names `E` and `F` for the internal node and the
root node respectively. Again though, Julia does most of the work for
us. A parse of this string returns an `Expr` with `E` being multiplied
by the `C`/`D` clade (this is a language feature intended to support
expressions like `2x`, which work the same way they do in math
notation). We can just extract the name of the clade out of the
multiplication. A more complete parser implementing this idea can be
found [here](https://gist.github.com/porterjamesj/7672080), although
it still fails on some inputs, such as nodes without names. In any
case this isn't really meant to be a robust implementation, just an
illustration of Julia's metaprogramming features that I thought was
particularly entertaining, hopefully you found it so as well.

[^1]: Astute readers will note that the tree pictured has names for internal nodes
      that aren't represented in the string. More on this later.
