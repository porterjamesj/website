;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var util = require('./util.js');
var m = require("mori");
var vec = m.vector;
var set = m.set;

/*
 * negamaxInner - use negamax algorithm and alpha/beta pruning to
 * determine the value of `board` from the perspective of
 * `player`. values are as follows:
 *
 * -1: player will lose
 * 0: game will draw
 * 1: player has a path to victory
 *
 * Note that this implementation assumes that `player's` opponent
 * has just played, so `player` will be the next to make a move
 */
var negamaxInner = function (player, board, alpha, beta) {
  var valid = util.validMoves(board);
  var other = -player;
  var count = m.count(valid);
  if (util.isWin(m.get(board,other))) {
    return -1;
  } else if (util.isWin(m.get(board,player))) {
    return 1;
  } else if (count===0) {
    // the game is a tie
    return 0;
  } else {
    // more moves to make, recurse
    var maxVal = -Infinity;
    var maybePruned = m.some(function (move) {
      var newBoard = util.makeMove(player,board,move);
      var x = -negamaxInner(other, newBoard, -beta, -alpha);
      if (x>maxVal) { maxVal = x; }
      if (x>alpha) { alpha = x; }
      if (alpha>=beta) { return alpha; }
      // if we can't alpha/beta prune, we have to keep looking
      // return null to indicate this to some
      return null;
    },valid);
  }
  // we alpha/beta pruning occurred, we want to return that value
  // if it didn't, we just return the max value we saw
  return maybePruned ? maybePruned: maxVal;
};


// interface to negamax that hides the a/B pruning
var negamax = exports.negamax = function (player,board) {
  return negamaxInner(player, board, -Infinity, Infinity);
};


// some heuristics to make the first move
// as fast as the rest
function heuristics (plays) {
  var numPlays = m.count(plays);
  if (numPlays===0) {
    // play the corner if the board is empty
    return vec(0,0);
  } else if (numPlays===1) {
    if (m.get(plays,vec(1,1))) {
      // play the corner if the center is taken
      return vec(0,0);
    } else {
      // play the center
      return vec(1,1);
    }
  } else {
    return null;
  }
};


// use negamax and some heuristics to choose a move
exports.chooseMove = function (player,board) {
  var plays = m.union(m.get(board,player),m.get(board,-player));
  var heuristic = heuristics(plays);
  if (heuristic != null) {
    return util.makeMove(player,board,heuristic);
  } else{
    // first check if we have a win
    var wins = util.findWins(player,board);
    if (!m.is_empty(wins)) {
      return util.makeMove(player,board,m.first(wins));
    }
    // otherwise use negamax
    var valid = m.seq(util.validMoves(board));
    var ok = undefined;
    for(var i = 0; i < m.count(valid); i++) {
      var play = util.makeMove(player,board,m.nth(valid,i));
      // the value of a play is the negation of its
      // value from my opponents point of view
      var val = -negamax(-player,play);
      if (val==1) {
        // this is a move we can win from; take it
        return play;
      } else if (val==0) {
        // we can draw from here, so its ok, but keep looking
        ok = play;
      }
    }
    return ok;
  }
};

},{"./util.js":4,"mori":5}],2:[function(require,module,exports){
var ui = require("./ui.js");
var React = require("react");

React.renderComponent(ui.Game(),
                      document.getElementById('content'));

},{"./ui.js":3,"react":123}],3:[function(require,module,exports){
var ai = require("./ai.js");
var util = require("./util.js");
var React = require("react");
var m = require("mori");
var vec = m.vector;

const NUM_ROWS = 3;
const NUM_COLS = 3;
const humanPlayer = m.get(util.players,"X");
const aiPlayer = m.get(util.players,"O");

// convenience wrapper for having mori's map return an array
var amap = function (f,coll) {
  return m.into_array(m.map(f,coll));
};

// draw the correct symbol for a player
var symbolFor = function (player) {
  return player===1?"X":"O";
};

// generate a random game opening (the randomness is in who goes first)
var randOpening = function () {
  return Math.random()>0.5?
    {board:util.makeBoard([],[])} : {board:util.makeBoard([],[vec(1,0)])};
};

/*
 * To draw the table for a board of size dim, we map over the range
 * (0,dim) twice, returning a tr at the first level and a td at the
 * the second level, resutling in a dim x dim sized table . By using
 * the information in the board, we can determine what the td should
 * look like.
 */
var makeTable = function (board, dim) {
  var self = this;
  var range = m.range(0,dim); // the size of the board is determined by this
  return React.DOM.table({}, amap(function (i) {
    return React.DOM.tr({}, amap(function (j) {
      var maybeTakenSpace = m.some(function (pair){
        var player = m.get(pair,0);
        var plays = m.get(pair,1);
        if (m.get(plays,vec(i,j))) {
          // in this case, player has played here
          return React.DOM.td({className:symbolFor(player)},
                              symbolFor(player));
        } else {
          // no one has played here
          return null;
        }
      },board);
      return maybeTakenSpace != null ? maybeTakenSpace :
        React.DOM.td({onClick:self.handleClick.bind(this,i,j)},' ');
    },range));
  },range));
};


/* The game component consists of the table for the board
 * and a brief message describing the game state.
 */
var Game = exports.Game = React.createClass({
  getInitialState: function () {
    return randOpening();
  },
  render: function () {
    var board = this.state.board;
    // draw 3 by 3 board
    var table = makeTable.call(this,board,3);

    // check if the game is over
    var over = util.isOver(board);
    var message;
    if (over === null) {
      message = "Click to make a move.";
    } else if (over===0) {
      message = "Draw! Refresh to play again.";
    } else if (over===-1) {
      message = "AI wins! Refresh to play again";
    } else if (over===1) {
      message = "You win! Refresh to play again";
    }

    // Return a div with the board and a message
    return React.DOM.div({},
                         [React.DOM.p({className:"banner"},message),table]);
  },
  handleClick: function (i,j) {
    // the new board after the human player's play
    var humanPlay = util.makeMove(humanPlayer,this.state.board,vec(i,j));
    if(util.isOver(humanPlay) != null) {
      // if that ends the game, just leave the state here
      this.setState({board:humanPlay});
    } else {
      // if not, let the ai respond
      this.setState({board:ai.chooseMove(aiPlayer,humanPlay)});
    }
  }
});

},{"./ai.js":1,"./util.js":4,"mori":5,"react":123}],4:[function(require,module,exports){
var m = require("mori");
var vec = m.vector;
var set = m.set;
var hashmap = m.hash_map;

const ALLMOVES = exports.ALLMOVES = set([
  vec(0,0),
  vec(0,1),
  vec(0,2),
  vec(1,0),
  vec(1,1),
  vec(1,2),
  vec(2,0),
  vec(2,1),
  vec(2,2)
]);

// enum of players
var players = hashmap("X",1,"O",-1);
const X = m.get(players,"X");
const O = m.get(players,"O");
exports.players = players;


// if somebody won, return who
// if it's a draw, return zero
// if the games is not over, return null
exports.isOver = function (board) {
  var valid = validMoves(board);
  if (m.count(valid)===0) {
    return 0; //draw
  } else {
    return m.some(function (pair) {
      var plays = m.get(pair,1);
      return isWin(plays) ? m.get(pair,0) : null;
    },board);
  }
};


// functions for board construction

var emptyBoard = exports.emptyBoard = function () {
  return hashmap(X,set(),O,set());
};

var makeBoard = exports.makeBoard = function (Xs, Os) {
  return hashmap(X,m.set(Xs),O,m.set(Os));
};

// determine the valid moves on a board
var validMoves = exports.validMoves = function (board) {
  return m.set(m.filter(function(move){
    return !m.has_key(m.get(board,X),move) && !m.has_key(m.get(board,O),move);
  },ALLMOVES));
};

// check if a set of moves constitutes a wi
var isWin = exports.isWin = function(moves) {
  /*
   * Algorithm is to walk over the set of moves,
   * keeping track of how many moves we've seen
   * that are in each column, row, the diagonal, and
   * the antidiagonal. These moves are a win if there
   * are three moves in any of these
   */
  var col = [0,0,0]; // three slots, one for each column
  var row = [0,0,0]; // correspondingly for rows
  var diag = 0, antidiag = 0;
  m.each(moves, function (move) {
    var i = m.nth(move,0);
    var j = m.nth(move,1);
    // add to appropriate column and row
    col[i]++;
    row[j]++;
    // add to diag if we are on it
    if (i===j) { diag++; }
    if (i+j===2) { antidiag++; }
  });
  // now we return true if any of any row, col, or diag had three moves in it
  var all = col.concat(row,diag,antidiag);
  return all.filter(function (n) { return n===3; }).length > 0;
};

// report all moves with which a player can win on this board
var findWins = exports.findWins = function (player,board) {
  var valid = validMoves(board);
  var sofar = m.get(board,player);
  return m.set(m.filter(function (move) {
    return isWin(m.conj(sofar,move));
  },valid));
};

// make a move and return a new board
var makeMove = exports.makeMove = function (player,board,move) {
  return m.assoc(board,player,
                 m.conj(m.get(board,player),move));
};

},{"mori":5}],5:[function(require,module,exports){
(function(definition){if(typeof exports==="object"){module.exports=definition();}else if(typeof define==="function"&&define.amd){define(definition);}else{mori=definition();}})(function(){return function(){
function aa(){return function(a){return a}}function f(a){return function(){return this[a]}}function m(a){return function(){return a}}var n,ba=this;
function p(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";
else if("function"==b&&"undefined"==typeof a.call)return"object";return b}var ca="closure_uid_"+(1E9*Math.random()>>>0),da=0;function r(a,b){var c=a.split("."),d=ba;c[0]in d||!d.execScript||d.execScript("var "+c[0]);for(var e;c.length&&(e=c.shift());)c.length||void 0===b?d=d[e]?d[e]:d[e]={}:d[e]=b};function ea(a){for(var b=0,c=0;c<a.length;++c)b=31*b+a.charCodeAt(c),b%=4294967296;return b};var fa=Array.prototype;function ga(a,b){fa.sort.call(a,b||ha)}function ia(a,b){for(var c=0;c<a.length;c++)a[c]={index:c,value:a[c]};var d=b||ha;ga(a,function(a,b){return d(a.value,b.value)||a.index-b.index});for(c=0;c<a.length;c++)a[c]=a[c].value}function ha(a,b){return a>b?1:a<b?-1:0};function ja(a,b){for(var c in a)b.call(void 0,a[c],c,a)};function ka(a,b){null!=a&&this.append.apply(this,arguments)}ka.prototype.Ha="";ka.prototype.append=function(a,b,c){this.Ha+=a;if(null!=b)for(var d=1;d<arguments.length;d++)this.Ha+=arguments[d];return this};ka.prototype.toString=f("Ha");var la;function t(a){return null!=a&&!1!==a}function na(a){return t(a)?!1:!0}function v(a,b){return a[p(null==b?null:b)]?!0:a._?!0:w?!1:null}function oa(a){return null==a?null:a.constructor}function x(a,b){var c=oa(b),c=t(t(c)?c.$a:c)?c.Za:p(b);return Error(["No protocol method ",a," defined for type ",c,": ",b].join(""))}function pa(a){var b=a.Za;return t(b)?b:""+y(a)}function qa(a){return Array.prototype.slice.call(arguments)}
var sa=function(){function a(a,b){return z.c?z.c(function(a,b){a.push(b);return a},[],b):z.call(null,function(a,b){a.push(b);return a},[],b)}function b(a){return c.a(null,a)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,0,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),ta={},ua={};
function va(a){if(a?a.G:a)return a.G(a);var b;b=va[p(null==a?null:a)];if(!b&&(b=va._,!b))throw x("ICounted.-count",a);return b.call(null,a)}function wa(a){if(a?a.H:a)return a.H(a);var b;b=wa[p(null==a?null:a)];if(!b&&(b=wa._,!b))throw x("IEmptyableCollection.-empty",a);return b.call(null,a)}var xa={};function ya(a,b){if(a?a.F:a)return a.F(a,b);var c;c=ya[p(null==a?null:a)];if(!c&&(c=ya._,!c))throw x("ICollection.-conj",a);return c.call(null,a,b)}
var za={},B=function(){function a(a,b,c){if(a?a.P:a)return a.P(a,b,c);var h;h=B[p(null==a?null:a)];if(!h&&(h=B._,!h))throw x("IIndexed.-nth",a);return h.call(null,a,b,c)}function b(a,b){if(a?a.L:a)return a.L(a,b);var c;c=B[p(null==a?null:a)];if(!c&&(c=B._,!c))throw x("IIndexed.-nth",a);return c.call(null,a,b)}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),
Aa={};function Ba(a){if(a?a.Q:a)return a.Q(a);var b;b=Ba[p(null==a?null:a)];if(!b&&(b=Ba._,!b))throw x("ISeq.-first",a);return b.call(null,a)}function Ca(a){if(a?a.S:a)return a.S(a);var b;b=Ca[p(null==a?null:a)];if(!b&&(b=Ca._,!b))throw x("ISeq.-rest",a);return b.call(null,a)}
var Da={},Ea={},Fa=function(){function a(a,b,c){if(a?a.v:a)return a.v(a,b,c);var h;h=Fa[p(null==a?null:a)];if(!h&&(h=Fa._,!h))throw x("ILookup.-lookup",a);return h.call(null,a,b,c)}function b(a,b){if(a?a.M:a)return a.M(a,b);var c;c=Fa[p(null==a?null:a)];if(!c&&(c=Fa._,!c))throw x("ILookup.-lookup",a);return c.call(null,a,b)}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=
a;return c}(),Ga={};function Ia(a,b){if(a?a.Ua:a)return a.Ua(a,b);var c;c=Ia[p(null==a?null:a)];if(!c&&(c=Ia._,!c))throw x("IAssociative.-contains-key?",a);return c.call(null,a,b)}function Ja(a,b,c){if(a?a.Z:a)return a.Z(a,b,c);var d;d=Ja[p(null==a?null:a)];if(!d&&(d=Ja._,!d))throw x("IAssociative.-assoc",a);return d.call(null,a,b,c)}var Ka={};function La(a,b){if(a?a.Xa:a)return a.Xa(a,b);var c;c=La[p(null==a?null:a)];if(!c&&(c=La._,!c))throw x("IMap.-dissoc",a);return c.call(null,a,b)}var Ma={};
function Na(a){if(a?a.Ka:a)return a.Ka(a);var b;b=Na[p(null==a?null:a)];if(!b&&(b=Na._,!b))throw x("IMapEntry.-key",a);return b.call(null,a)}function Oa(a){if(a?a.La:a)return a.La(a);var b;b=Oa[p(null==a?null:a)];if(!b&&(b=Oa._,!b))throw x("IMapEntry.-val",a);return b.call(null,a)}var Pa={};function Qa(a,b){if(a?a.sb:a)return a.sb(a,b);var c;c=Qa[p(null==a?null:a)];if(!c&&(c=Qa._,!c))throw x("ISet.-disjoin",a);return c.call(null,a,b)}
function Ra(a){if(a?a.ua:a)return a.ua(a);var b;b=Ra[p(null==a?null:a)];if(!b&&(b=Ra._,!b))throw x("IStack.-peek",a);return b.call(null,a)}function Sa(a){if(a?a.va:a)return a.va(a);var b;b=Sa[p(null==a?null:a)];if(!b&&(b=Sa._,!b))throw x("IStack.-pop",a);return b.call(null,a)}var Ta={};function Ua(a,b,c){if(a?a.Oa:a)return a.Oa(a,b,c);var d;d=Ua[p(null==a?null:a)];if(!d&&(d=Ua._,!d))throw x("IVector.-assoc-n",a);return d.call(null,a,b,c)}
function Va(a){if(a?a.eb:a)return a.eb(a);var b;b=Va[p(null==a?null:a)];if(!b&&(b=Va._,!b))throw x("IDeref.-deref",a);return b.call(null,a)}var Wa={};function Xa(a){if(a?a.C:a)return a.C(a);var b;b=Xa[p(null==a?null:a)];if(!b&&(b=Xa._,!b))throw x("IMeta.-meta",a);return b.call(null,a)}var Ya={};function Za(a,b){if(a?a.D:a)return a.D(a,b);var c;c=Za[p(null==a?null:a)];if(!c&&(c=Za._,!c))throw x("IWithMeta.-with-meta",a);return c.call(null,a,b)}
var $a={},ab=function(){function a(a,b,c){if(a?a.J:a)return a.J(a,b,c);var h;h=ab[p(null==a?null:a)];if(!h&&(h=ab._,!h))throw x("IReduce.-reduce",a);return h.call(null,a,b,c)}function b(a,b){if(a?a.N:a)return a.N(a,b);var c;c=ab[p(null==a?null:a)];if(!c&&(c=ab._,!c))throw x("IReduce.-reduce",a);return c.call(null,a,b)}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}();
function bb(a,b,c){if(a?a.Ja:a)return a.Ja(a,b,c);var d;d=bb[p(null==a?null:a)];if(!d&&(d=bb._,!d))throw x("IKVReduce.-kv-reduce",a);return d.call(null,a,b,c)}function cb(a,b){if(a?a.u:a)return a.u(a,b);var c;c=cb[p(null==a?null:a)];if(!c&&(c=cb._,!c))throw x("IEquiv.-equiv",a);return c.call(null,a,b)}function eb(a){if(a?a.B:a)return a.B(a);var b;b=eb[p(null==a?null:a)];if(!b&&(b=eb._,!b))throw x("IHash.-hash",a);return b.call(null,a)}var fb={};
function gb(a){if(a?a.t:a)return a.t(a);var b;b=gb[p(null==a?null:a)];if(!b&&(b=gb._,!b))throw x("ISeqable.-seq",a);return b.call(null,a)}var hb={},ib={},jb={};function kb(a){if(a?a.Ma:a)return a.Ma(a);var b;b=kb[p(null==a?null:a)];if(!b&&(b=kb._,!b))throw x("IReversible.-rseq",a);return b.call(null,a)}function lb(a,b){if(a?a.vb:a)return a.vb(a,b);var c;c=lb[p(null==a?null:a)];if(!c&&(c=lb._,!c))throw x("ISorted.-sorted-seq",a);return c.call(null,a,b)}
function mb(a,b,c){if(a?a.wb:a)return a.wb(a,b,c);var d;d=mb[p(null==a?null:a)];if(!d&&(d=mb._,!d))throw x("ISorted.-sorted-seq-from",a);return d.call(null,a,b,c)}function nb(a,b){if(a?a.ub:a)return a.ub(a,b);var c;c=nb[p(null==a?null:a)];if(!c&&(c=nb._,!c))throw x("ISorted.-entry-key",a);return c.call(null,a,b)}function ob(a){if(a?a.tb:a)return a.tb(a);var b;b=ob[p(null==a?null:a)];if(!b&&(b=ob._,!b))throw x("ISorted.-comparator",a);return b.call(null,a)}
function pb(a,b){if(a?a.Ob:a)return a.Ob(0,b);var c;c=pb[p(null==a?null:a)];if(!c&&(c=pb._,!c))throw x("IWriter.-write",a);return c.call(null,a,b)}function qb(a){if(a?a.Xb:a)return null;var b;b=qb[p(null==a?null:a)];if(!b&&(b=qb._,!b))throw x("IWriter.-flush",a);return b.call(null,a)}var rb={};function sb(a,b,c){if(a?a.w:a)return a.w(a,b,c);var d;d=sb[p(null==a?null:a)];if(!d&&(d=sb._,!d))throw x("IPrintWithWriter.-pr-writer",a);return d.call(null,a,b,c)}
function tb(a,b,c){if(a?a.Nb:a)return a.Nb(a,b,c);var d;d=tb[p(null==a?null:a)];if(!d&&(d=tb._,!d))throw x("IWatchable.-notify-watches",a);return d.call(null,a,b,c)}function ub(a){if(a?a.Ia:a)return a.Ia(a);var b;b=ub[p(null==a?null:a)];if(!b&&(b=ub._,!b))throw x("IEditableCollection.-as-transient",a);return b.call(null,a)}function vb(a,b){if(a?a.pa:a)return a.pa(a,b);var c;c=vb[p(null==a?null:a)];if(!c&&(c=vb._,!c))throw x("ITransientCollection.-conj!",a);return c.call(null,a,b)}
function wb(a){if(a?a.wa:a)return a.wa(a);var b;b=wb[p(null==a?null:a)];if(!b&&(b=wb._,!b))throw x("ITransientCollection.-persistent!",a);return b.call(null,a)}function xb(a,b,c){if(a?a.Da:a)return a.Da(a,b,c);var d;d=xb[p(null==a?null:a)];if(!d&&(d=xb._,!d))throw x("ITransientAssociative.-assoc!",a);return d.call(null,a,b,c)}function yb(a,b){if(a?a.xb:a)return a.xb(a,b);var c;c=yb[p(null==a?null:a)];if(!c&&(c=yb._,!c))throw x("ITransientMap.-dissoc!",a);return c.call(null,a,b)}
function zb(a){if(a?a.Mb:a)return a.Mb(a);var b;b=zb[p(null==a?null:a)];if(!b&&(b=zb._,!b))throw x("ITransientVector.-pop!",a);return b.call(null,a)}function Ab(a,b){if(a?a.Lb:a)return a.Lb(a,b);var c;c=Ab[p(null==a?null:a)];if(!c&&(c=Ab._,!c))throw x("ITransientSet.-disjoin!",a);return c.call(null,a,b)}function Bb(a){if(a?a.Fb:a)return a.Fb();var b;b=Bb[p(null==a?null:a)];if(!b&&(b=Bb._,!b))throw x("IChunk.-drop-first",a);return b.call(null,a)}
function Cb(a){if(a?a.cb:a)return a.cb(a);var b;b=Cb[p(null==a?null:a)];if(!b&&(b=Cb._,!b))throw x("IChunkedSeq.-chunked-first",a);return b.call(null,a)}function Db(a){if(a?a.Va:a)return a.Va(a);var b;b=Db[p(null==a?null:a)];if(!b&&(b=Db._,!b))throw x("IChunkedSeq.-chunked-rest",a);return b.call(null,a)}function Eb(a){this.cc=a;this.p=0;this.h=1073741824}Eb.prototype.Ob=function(a,b){return this.cc.append(b)};Eb.prototype.Xb=m(null);
function Fb(a){var b=new ka,c=new Eb(b);a.w(a,c,Gb([Hb,!0,Ib,!0,Jb,!1,Kb,!1],!0));qb(c);return""+y(b)}function Lb(a,b,c,d,e){this.Aa=a;this.name=b;this.Ba=c;this.ta=d;this.W=e;this.h=2154168321;this.p=4096}n=Lb.prototype;n.w=function(a,b){return pb(b,this.Ba)};n.B=function(a){var b=this.ta;return null!=b?b:this.ta=a=Mb.a?Mb.a(C.b?C.b(a.Aa):C.call(null,a.Aa),C.b?C.b(a.name):C.call(null,a.name)):Mb.call(null,C.b?C.b(a.Aa):C.call(null,a.Aa),C.b?C.b(a.name):C.call(null,a.name))};
n.D=function(a,b){return new Lb(this.Aa,this.name,this.Ba,this.ta,b)};n.C=f("W");n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return Fa.c(c,this,null);case 3:return Fa.c(c,this,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.u=function(a,b){return b instanceof Lb?this.Ba===b.Ba:!1};n.toString=f("Ba");
function D(a){if(null==a)return null;var b;b=a?((b=a.h&8388608)?b:a.Wb)?!0:!1:!1;if(b)return a.t(a);if(a instanceof Array||"string"===typeof a)return 0===a.length?null:new Nb(a,0);if(v(fb,a))return gb(a);if(w)throw Error([y(a),y("is not ISeqable")].join(""));return null}function E(a){if(null==a)return null;var b;b=a?((b=a.h&64)?b:a.Na)?!0:!1:!1;if(b)return a.Q(a);a=D(a);return null==a?null:Ba(a)}
function F(a){if(null!=a){var b;b=a?((b=a.h&64)?b:a.Na)?!0:!1:!1;if(b)return a.S(a);a=D(a);return null!=a?Ca(a):G}return G}function H(a){if(null==a)a=null;else{var b;b=a?((b=a.h&128)?b:a.Ya)?!0:!1:!1;a=b?a.V(a):D(F(a))}return a}
var Ob=function(){function a(a,b){var c=a===b;return c?c:cb(a,b)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=I(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){for(;;)if(t(b.a(a,d)))if(H(e))a=d,d=E(e),e=H(e);else return b.a(d,E(e));else return!1}a.j=2;a.g=function(a){var b=E(a);a=H(a);var d=E(a);a=F(a);return c(b,d,a)};a.e=c;return a}(),b=function(b,e,g){switch(arguments.length){case 1:return!0;case 2:return a.call(this,b,e);default:return c.e(b,
e,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.j=2;b.g=c.g;b.b=m(!0);b.a=a;b.e=c.e;return b}();eb["null"]=m(0);Da["null"]=!0;bb["null"]=function(a,b,c){return c};Pa["null"]=!0;Qa["null"]=m(null);ua["null"]=!0;va["null"]=m(0);Ra["null"]=m(null);Sa["null"]=m(null);cb["null"]=function(a,b){return null==b};Ya["null"]=!0;Za["null"]=m(null);Wa["null"]=!0;Xa["null"]=m(null);wa["null"]=m(null);Ka["null"]=!0;La["null"]=m(null);
Date.prototype.u=function(a,b){var c=b instanceof Date;return c?a.toString()===b.toString():c};eb.number=function(a){return Math.floor(a)%2147483647};cb.number=function(a,b){return a===b};eb["boolean"]=function(a){return!0===a?1:0};Wa["function"]=!0;Xa["function"]=m(null);ta["function"]=!0;eb._=function(a){return a[ca]||(a[ca]=++da)};function Pb(a){this.k=a;this.p=0;this.h=32768}Pb.prototype.eb=f("k");function Qb(a){return a instanceof Pb}
var Rb=function(){function a(a,b,c,d){for(var l=va(a);;)if(d<l){c=b.a?b.a(c,B.a(a,d)):b.call(null,c,B.a(a,d));if(Qb(c))return J.b?J.b(c):J.call(null,c);d+=1}else return c}function b(a,b,c){for(var d=va(a),l=0;;)if(l<d){c=b.a?b.a(c,B.a(a,l)):b.call(null,c,B.a(a,l));if(Qb(c))return J.b?J.b(c):J.call(null,c);l+=1}else return c}function c(a,b){var c=va(a);if(0===c)return b.o?b.o():b.call(null);for(var d=B.a(a,0),l=1;;)if(l<c){d=b.a?b.a(d,B.a(a,l)):b.call(null,d,B.a(a,l));if(Qb(d))return J.b?J.b(d):J.call(null,
d);l+=1}else return d}var d=null,d=function(d,g,h,k){switch(arguments.length){case 2:return c.call(this,d,g);case 3:return b.call(this,d,g,h);case 4:return a.call(this,d,g,h,k)}throw Error("Invalid arity: "+arguments.length);};d.a=c;d.c=b;d.n=a;return d}(),Sb=function(){function a(a,b,c,d){for(var l=a.length;;)if(d<l){c=b.a?b.a(c,a[d]):b.call(null,c,a[d]);if(Qb(c))return J.b?J.b(c):J.call(null,c);d+=1}else return c}function b(a,b,c){for(var d=a.length,l=0;;)if(l<d){c=b.a?b.a(c,a[l]):b.call(null,c,
a[l]);if(Qb(c))return J.b?J.b(c):J.call(null,c);l+=1}else return c}function c(a,b){var c=a.length;if(0===a.length)return b.o?b.o():b.call(null);for(var d=a[0],l=1;;)if(l<c){d=b.a?b.a(d,a[l]):b.call(null,d,a[l]);if(Qb(d))return J.b?J.b(d):J.call(null,d);l+=1}else return d}var d=null,d=function(d,g,h,k){switch(arguments.length){case 2:return c.call(this,d,g);case 3:return b.call(this,d,g,h);case 4:return a.call(this,d,g,h,k)}throw Error("Invalid arity: "+arguments.length);};d.a=c;d.c=b;d.n=a;return d}();
function Tb(a){if(a){var b=a.h&2;a=(b?b:a.Qb)?!0:a.h?!1:v(ua,a)}else a=v(ua,a);return a}function Ub(a){if(a){var b=a.h&16;a=(b?b:a.Jb)?!0:a.h?!1:v(za,a)}else a=v(za,a);return a}function Nb(a,b){this.d=a;this.m=b;this.p=0;this.h=166199550}n=Nb.prototype;n.B=function(a){return Vb.b?Vb.b(a):Vb.call(null,a)};n.V=function(){return this.m+1<this.d.length?new Nb(this.d,this.m+1):null};n.F=function(a,b){return K.a?K.a(b,a):K.call(null,b,a)};n.Ma=function(a){var b=a.G(a);return 0<b?new Wb(a,b-1,null):G};
n.toString=function(){return Fb(this)};n.N=function(a,b){return Sb.n(this.d,b,this.d[this.m],this.m+1)};n.J=function(a,b,c){return Sb.n(this.d,b,c,this.m)};n.t=aa();n.G=function(){return this.d.length-this.m};n.Q=function(){return this.d[this.m]};n.S=function(){return this.m+1<this.d.length?new Nb(this.d,this.m+1):Xb.o?Xb.o():Xb.call(null)};n.u=function(a,b){return Yb.a?Yb.a(a,b):Yb.call(null,a,b)};n.L=function(a,b){var c=b+this.m;return c<this.d.length?this.d[c]:null};
n.P=function(a,b,c){a=b+this.m;return a<this.d.length?this.d[a]:c};n.H=function(){return G};
var Zb=function(){function a(a,b){return b<a.length?new Nb(a,b):null}function b(a){return c.a(a,0)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),I=function(){function a(a,b){return Zb.a(a,b)}function b(a){return Zb.a(a,0)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+
arguments.length);};c.b=b;c.a=a;return c}();function Wb(a,b,c){this.bb=a;this.m=b;this.i=c;this.p=0;this.h=32374862}n=Wb.prototype;n.B=function(a){return Vb.b?Vb.b(a):Vb.call(null,a)};n.F=function(a,b){return K.a?K.a(b,a):K.call(null,b,a)};n.toString=function(){return Fb(this)};n.N=function(a,b){return M.a?M.a(b,a):M.call(null,b,a)};n.J=function(a,b,c){return M.c?M.c(b,c,a):M.call(null,b,c,a)};n.t=aa();n.G=function(){return this.m+1};n.Q=function(){return B.a(this.bb,this.m)};
n.S=function(){return 0<this.m?new Wb(this.bb,this.m-1,null):G};n.u=function(a,b){return Yb.a?Yb.a(a,b):Yb.call(null,a,b)};n.D=function(a,b){return new Wb(this.bb,this.m,b)};n.C=f("i");n.H=function(){return N.a?N.a(G,this.i):N.call(null,G,this.i)};function $b(a){for(;;){var b=H(a);if(null!=b)a=b;else return E(a)}}cb._=function(a,b){return a===b};
var ac=function(){function a(a,b){return null!=a?ya(a,b):Xb.b?Xb.b(b):Xb.call(null,b)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=I(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){for(;;)if(t(e))a=b.a(a,d),d=E(e),e=H(e);else return b.a(a,d)}a.j=2;a.g=function(a){var b=E(a);a=H(a);var d=E(a);a=F(a);return c(b,d,a)};a.e=c;return a}(),b=function(b,e,g){switch(arguments.length){case 2:return a.call(this,b,e);default:return c.e(b,
e,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.j=2;b.g=c.g;b.a=a;b.e=c.e;return b}();function O(a){if(null!=a){var b;b=a?((b=a.h&2)?b:a.Qb)?!0:!1:!1;if(b)a=a.G(a);else if(a instanceof Array)a=a.length;else if("string"===typeof a)a=a.length;else if(v(ua,a))a=va(a);else if(w)a:{a=D(a);for(b=0;;){if(Tb(a)){a=b+va(a);break a}a=H(a);b+=1}a=void 0}else a=null}else a=0;return a}
var bc=function(){function a(a,b,c){for(;;){if(null==a)return c;if(0===b)return D(a)?E(a):c;if(Ub(a))return B.c(a,b,c);if(D(a))a=H(a),b-=1;else return w?c:null}}function b(a,b){for(;;){if(null==a)throw Error("Index out of bounds");if(0===b){if(D(a))return E(a);throw Error("Index out of bounds");}if(Ub(a))return B.a(a,b);if(D(a)){var c=H(a),h=b-1;a=c;b=h}else{if(w)throw Error("Index out of bounds");return null}}}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,
c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),Q=function(){function a(a,b,c){if(null!=a){if(function(){var b;b=a?((b=a.h&16)?b:a.Jb)?!0:!1:!1;return b}())return a.P(a,Math.floor(b),c);if(a instanceof Array||"string"===typeof a)return b<a.length?a[b]:c;if(v(za,a))return B.a(a,b);if(w){if(function(){var b;b=a?((b=a.h&64)?b:a.Na)?!0:a.h?!1:v(Aa,a):v(Aa,a);return b}())return bc.c(a,Math.floor(b),c);throw Error([y("nth not supported on this type "),y(pa(oa(a)))].join(""));
}return null}return c}function b(a,b){if(null==a)return null;if(function(){var b;b=a?((b=a.h&16)?b:a.Jb)?!0:!1:!1;return b}())return a.L(a,Math.floor(b));if(a instanceof Array||"string"===typeof a)return b<a.length?a[b]:null;if(v(za,a))return B.a(a,b);if(w){if(function(){var b;b=a?((b=a.h&64)?b:a.Na)?!0:a.h?!1:v(Aa,a):v(Aa,a);return b}())return bc.a(a,Math.floor(b));throw Error([y("nth not supported on this type "),y(pa(oa(a)))].join(""));}return null}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,
c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),R=function(){function a(a,b,c){if(null!=a){var h;h=a?((h=a.h&256)?h:a.Wa)?!0:!1:!1;a=h?a.v(a,b,c):a instanceof Array?b<a.length?a[b]:c:"string"===typeof a?b<a.length?a[b]:c:v(Ea,a)?Fa.c(a,b,c):w?c:null}else a=c;return a}function b(a,b){var c;null==a?c=null:(c=a?((c=a.h&256)?c:a.Wa)?!0:!1:!1,c=c?a.M(a,b):a instanceof Array?b<a.length?a[b]:null:"string"===typeof a?b<a.length?a[b]:null:v(Ea,
a)?Fa.a(a,b):null);return c}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),S=function(){function a(a,b,c){return null!=a?Ja(a,b,c):cc.a?cc.a(b,c):cc.call(null,b,c)}var b=null,c=function(){function a(b,d,k,l){var q=null;3<arguments.length&&(q=I(Array.prototype.slice.call(arguments,3),0));return c.call(this,b,d,k,q)}function c(a,d,e,l){for(;;)if(a=b.c(a,d,
e),t(l))d=E(l),e=E(H(l)),l=H(H(l));else return a}a.j=3;a.g=function(a){var b=E(a);a=H(a);var d=E(a);a=H(a);var l=E(a);a=F(a);return c(b,d,l,a)};a.e=c;return a}(),b=function(b,e,g,h){switch(arguments.length){case 3:return a.call(this,b,e,g);default:return c.e(b,e,g,I(arguments,3))}throw Error("Invalid arity: "+arguments.length);};b.j=3;b.g=c.g;b.c=a;b.e=c.e;return b}(),dc=function(){var a=null,b=function(){function b(a,c,h){var k=null;2<arguments.length&&(k=I(Array.prototype.slice.call(arguments,2),
0));return d.call(this,a,c,k)}function d(b,c,d){for(;;)if(b=a.a(b,c),t(d))c=E(d),d=H(d);else return b}b.j=2;b.g=function(a){var b=E(a);a=H(a);var c=E(a);a=F(a);return d(b,c,a)};b.e=d;return b}(),a=function(a,d,e){switch(arguments.length){case 1:return a;case 2:return La(a,d);default:return b.e(a,d,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};a.j=2;a.g=b.g;a.b=aa();a.a=function(a,b){return La(a,b)};a.e=b.e;return a}();
function ec(a){var b="function"==p(a);return b?b:a?t(t(null)?null:a.Pb)?!0:a.zb?!1:v(ta,a):v(ta,a)}
var N=function fc(b,c){return function(){var c=ec(b);c&&(c=b?((c=b.h&262144)?c:b.tc)?!0:b.h?!1:v(Ya,b):v(Ya,b),c=!c);return c}()?fc(function(){"undefined"===typeof la&&(la={},la=function(b,c,g,h){this.i=b;this.Ab=c;this.fc=g;this.Zb=h;this.p=0;this.h=393217},la.$a=!0,la.Za="cljs.core/t4201",la.yb=function(b,c){return pb(c,"cljs.core/t4201")},la.prototype.call=function(){function b(d,h){d=this;var k=null;1<arguments.length&&(k=I(Array.prototype.slice.call(arguments,1),0));return c.call(this,d,k)}function c(b,
d){return T.a?T.a(b.Ab,d):T.call(null,b.Ab,d)}b.j=1;b.g=function(b){var d=E(b);b=F(b);return c(d,b)};b.e=c;return b}(),la.prototype.apply=function(b,c){b=this;return b.call.apply(b,[b].concat(c.slice()))},la.prototype.Pb=!0,la.prototype.C=f("Zb"),la.prototype.D=function(b,c){return new la(this.i,this.Ab,this.fc,c)});return new la(c,b,fc,null)}(),c):Za(b,c)};function hc(a){var b;b=a?((b=a.h&131072)?b:a.Vb)?!0:a.h?!1:v(Wa,a):v(Wa,a);return b?Xa(a):null}
var ic=function(){var a=null,b=function(){function b(a,c,h){var k=null;2<arguments.length&&(k=I(Array.prototype.slice.call(arguments,2),0));return d.call(this,a,c,k)}function d(b,c,d){for(;;)if(b=a.a(b,c),t(d))c=E(d),d=H(d);else return b}b.j=2;b.g=function(a){var b=E(a);a=H(a);var c=E(a);a=F(a);return d(b,c,a)};b.e=d;return b}(),a=function(a,d,e){switch(arguments.length){case 1:return a;case 2:return Qa(a,d);default:return b.e(a,d,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};
a.j=2;a.g=b.g;a.b=aa();a.a=function(a,b){return Qa(a,b)};a.e=b.e;return a}(),jc={},kc=0,C=function(){function a(a,b){var c="string"==typeof a;(c?b:c)?(255<kc&&(jc={},kc=0),c=jc[a],"number"!==typeof c&&(c=ea(a),jc[a]=c,kc+=1)):c=eb(a);return c}function b(a){return c.a(a,!0)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}();
function lc(a){var b=null==a;return b?b:na(D(a))}function mc(a){if(null==a)a=!1;else if(a){var b=a.h&8;a=(b?b:a.jc)?!0:a.h?!1:v(xa,a)}else a=v(xa,a);return a}function nc(a){if(null==a)a=!1;else if(a){var b=a.h&4096;a=(b?b:a.rc)?!0:a.h?!1:v(Pa,a)}else a=v(Pa,a);return a}function oc(a){if(a){var b=a.h&512;a=(b?b:a.hc)?!0:a.h?!1:v(Ga,a)}else a=v(Ga,a);return a}function pc(a){if(a){var b=a.h&16777216;a=(b?b:a.qc)?!0:a.h?!1:v(hb,a)}else a=v(hb,a);return a}
function qc(a){if(null==a)a=!1;else if(a){var b=a.h&1024;a=(b?b:a.nc)?!0:a.h?!1:v(Ka,a)}else a=v(Ka,a);return a}function rc(a){if(a){var b=a.h&16384;a=(b?b:a.sc)?!0:a.h?!1:v(Ta,a)}else a=v(Ta,a);return a}function sc(a){if(a){var b=a.p&512;a=(b?b:a.ic)?!0:!1}else a=!1;return a}function tc(a){var b=[];ja(a,function(a,d){return b.push(d)});return b}function uc(a,b,c,d,e){for(;0!==e;)c[d]=a[b],d+=1,e-=1,b+=1}var wc={};
function xc(a){if(null==a)a=!1;else if(a){var b=a.h&64;a=(b?b:a.Na)?!0:a.h?!1:v(Aa,a)}else a=v(Aa,a);return a}function yc(a){return t(a)?!0:!1}function zc(a,b){return R.c(a,b,wc)===wc?!1:!0}function Ac(a,b){if(a===b)return 0;if(null==a)return-1;if(null==b)return 1;if(oa(a)===oa(b)){var c;c=a?((c=a.p&2048)?c:a.Hb)?!0:!1:!1;return c?a.Ib(a,b):ha(a,b)}if(w)throw Error("compare on non-nil objects of different types");return null}
var Bc=function(){function a(a,b,c,h){for(;;){var k=Ac(Q.a(a,h),Q.a(b,h)),l=0===k;if(l?h+1<c:l)h+=1;else return k}}function b(a,b){var g=O(a),h=O(b);return g<h?-1:g>h?1:w?c.n(a,b,g,0):null}var c=null,c=function(c,e,g,h){switch(arguments.length){case 2:return b.call(this,c,e);case 4:return a.call(this,c,e,g,h)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.n=a;return c}();
function Cc(a){return Ob.a(a,Ac)?Ac:function(b,c){var d=a.a?a.a(b,c):a.call(null,b,c);return"number"===typeof d?d:t(d)?-1:t(a.a?a.a(c,b):a.call(null,c,b))?1:0}}
var Ec=function(){function a(a,b){if(D(b)){var c=Dc.b?Dc.b(b):Dc.call(null,b);ia(c,Cc(a));return D(c)}return G}function b(a){return c.a(Ac,a)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),Fc=function(){function a(a,b,c){return Ec.a(function(c,g){return Cc(b).call(null,a.b?a.b(c):a.call(null,c),a.b?a.b(g):a.call(null,g))},c)}function b(a,b){return c.c(a,Ac,b)}
var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),M=function(){function a(a,b,c){for(c=D(c);;)if(c){b=a.a?a.a(b,E(c)):a.call(null,b,E(c));if(Qb(b))return J.b?J.b(b):J.call(null,b);c=H(c)}else return b}function b(a,b){var c=D(b);return c?z.c?z.c(a,E(c),H(c)):z.call(null,a,E(c),H(c)):a.o?a.o():a.call(null)}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,
c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),z=function(){function a(a,b,c){var h;h=c?((h=c.h&524288)?h:c.Kb)?!0:!1:!1;return h?c.J(c,a,b):c instanceof Array?Sb.c(c,a,b):"string"===typeof c?Sb.c(c,a,b):v($a,c)?ab.c(c,a,b):w?M.c(a,b,c):null}function b(a,b){var c;c=b?((c=b.h&524288)?c:b.Kb)?!0:!1:!1;return c?b.N(b,a):b instanceof Array?Sb.a(b,a):"string"===typeof b?Sb.a(b,a):v($a,b)?ab.a(b,a):w?M.a(a,b):null}var c=null,c=function(c,
e,g){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}(),Gc=function(){var a=null,b=function(){function a(c,g,h){var k=null;2<arguments.length&&(k=I(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,g,k)}function b(a,c,d){for(;;)if(a>c)if(H(d))a=c,c=E(d),d=H(d);else return c>E(d);else return!1}a.j=2;a.g=function(a){var c=E(a);a=H(a);var h=E(a);a=F(a);return b(c,h,a)};a.e=b;
return a}(),a=function(a,d,e){switch(arguments.length){case 1:return!0;case 2:return a>d;default:return b.e(a,d,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};a.j=2;a.g=b.g;a.b=m(!0);a.a=function(a,b){return a>b};a.e=b.e;return a}(),Hc=function(){var a=null,b=function(){function a(c,g,h){var k=null;2<arguments.length&&(k=I(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,g,k)}function b(a,c,d){for(;;)if(a>=c)if(H(d))a=c,c=E(d),d=H(d);else return c>=E(d);else return!1}
a.j=2;a.g=function(a){var c=E(a);a=H(a);var h=E(a);a=F(a);return b(c,h,a)};a.e=b;return a}(),a=function(a,d,e){switch(arguments.length){case 1:return!0;case 2:return a>=d;default:return b.e(a,d,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};a.j=2;a.g=b.g;a.b=m(!0);a.a=function(a,b){return a>=b};a.e=b.e;return a}();function Ic(a){return a-1}
function Jc(a){return 0<=(a-a%2)/2?Math.floor.b?Math.floor.b((a-a%2)/2):Math.floor.call(null,(a-a%2)/2):Math.ceil.b?Math.ceil.b((a-a%2)/2):Math.ceil.call(null,(a-a%2)/2)}function Kc(a){a-=a>>1&1431655765;a=(a&858993459)+(a>>2&858993459);return 16843009*(a+(a>>4)&252645135)>>24}function Lc(a){var b=1;for(a=D(a);;){var c=a;if(t(c?0<b:c))b-=1,a=H(a);else return a}}
var y=function(){function a(a){return null==a?"":a.toString()}var b=null,c=function(){function a(b,d){var k=null;1<arguments.length&&(k=I(Array.prototype.slice.call(arguments,1),0));return c.call(this,b,k)}function c(a,d){return function(a,c){for(;;)if(t(c)){var d=a.append(b.b(E(c))),e=H(c);a=d;c=e}else return a.toString()}.call(null,new ka(b.b(a)),d)}a.j=1;a.g=function(a){var b=E(a);a=F(a);return c(b,a)};a.e=c;return a}(),b=function(b,e){switch(arguments.length){case 0:return"";case 1:return a.call(this,
b);default:return c.e(b,I(arguments,1))}throw Error("Invalid arity: "+arguments.length);};b.j=1;b.g=c.g;b.o=m("");b.b=a;b.e=c.e;return b}();function Yb(a,b){return yc(pc(b)?function(){for(var c=D(a),d=D(b);;){if(null==c)return null==d;if(null==d)return!1;if(Ob.a(E(c),E(d)))c=H(c),d=H(d);else return w?!1:null}}():null)}function Mb(a,b){return a^b+2654435769+(a<<6)+(a>>2)}function Vb(a){return z.c(function(a,c){return Mb(a,C.a(c,!1))},C.a(E(a),!1),H(a))}
function Mc(a){var b=0;for(a=D(a);;)if(a){var c=E(a),b=(b+(C.b(Nc.b?Nc.b(c):Nc.call(null,c))^C.b(Oc.b?Oc.b(c):Oc.call(null,c))))%4503599627370496;a=H(a)}else return b}function Pc(a){var b=0;for(a=D(a);;)if(a){var c=E(a),b=(b+C.b(c))%4503599627370496;a=H(a)}else return b}function Qc(a,b,c,d,e){this.i=a;this.Fa=b;this.na=c;this.count=d;this.l=e;this.p=0;this.h=65937646}n=Qc.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.V=function(){return 1===this.count?null:this.na};
n.F=function(a,b){return new Qc(this.i,b,a,this.count+1,null)};n.toString=function(){return Fb(this)};n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};n.t=aa();n.G=f("count");n.ua=f("Fa");n.va=function(a){return a.S(a)};n.Q=f("Fa");n.S=function(){return 1===this.count?G:this.na};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return new Qc(b,this.Fa,this.na,this.count,this.l)};n.C=f("i");n.H=function(){return G};function Rc(a){this.i=a;this.p=0;this.h=65937614}n=Rc.prototype;
n.B=m(0);n.V=m(null);n.F=function(a,b){return new Qc(this.i,b,null,1,null)};n.toString=function(){return Fb(this)};n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};n.t=m(null);n.G=m(0);n.ua=m(null);n.va=function(){throw Error("Can't pop empty list");};n.Q=m(null);n.S=function(){return G};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return new Rc(b)};n.C=f("i");n.H=aa();var G=new Rc(null);
function Sc(a){if(a){var b=a.h&134217728;a=(b?b:a.pc)?!0:a.h?!1:v(jb,a)}else a=v(jb,a);return a}function Tc(a){return Sc(a)?kb(a):z.c(ac,G,a)}
var Xb=function(){function a(a){var d=null;0<arguments.length&&(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){var b;if(a instanceof Nb)b=a.d;else a:{for(b=[];;)if(null!=a)b.push(a.Q(a)),a=a.V(a);else break a;b=void 0}a=b.length;for(var e=G;;)if(0<a){var g=a-1,e=e.F(e,b[a-1]);a=g}else return e}a.j=0;a.g=function(a){a=D(a);return b(a)};a.e=b;return a}();function Uc(a,b,c,d){this.i=a;this.Fa=b;this.na=c;this.l=d;this.p=0;this.h=65929452}n=Uc.prototype;
n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.V=function(){return null==this.na?null:gb(this.na)};n.F=function(a,b){return new Uc(null,b,a,this.l)};n.toString=function(){return Fb(this)};n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};n.t=aa();n.Q=f("Fa");n.S=function(){return null==this.na?G:this.na};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return new Uc(b,this.Fa,this.na,this.l)};n.C=f("i");n.H=function(){return N(G,this.i)};
function K(a,b){var c=null==b;c||(c=b?((c=b.h&64)?c:b.Na)?!0:!1:!1);return c?new Uc(null,a,b,null):new Uc(null,a,D(b),null)}eb.string=function(a){return ea(a)};function U(a,b,c,d){this.Aa=a;this.name=b;this.ra=c;this.ta=d;this.h=2153775105;this.p=4096}n=U.prototype;n.w=function(a,b){return pb(b,[y(":"),y(this.ra)].join(""))};n.B=function(){null==this.ta&&(this.ta=Mb(C.b(this.Aa),C.b(this.name))+2654435769);return this.ta};
n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:var e;null==c?e=null:(e=c?((e=c.h&256)?e:c.Wa)?!0:c.h?!1:v(Ea,c):v(Ea,c),e=e?Fa.c(c,this,null):null);return e;case 3:return null==c?e=d:(e=c?((e=c.h&256)?e:c.Wa)?!0:c.h?!1:v(Ea,c):v(Ea,c),e=e?Fa.c(c,this,d):d),e}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.u=function(a,b){return b instanceof U?this.ra===b.ra:!1};
n.toString=function(){return[y(":"),y(this.ra)].join("")};var Wc=function(){function a(a,b){return new U(a,b,[y(t(a)?[y(a),y("/")].join(""):null),y(b)].join(""),null)}function b(a){return a instanceof U?a:a instanceof Lb?new U(null,Vc.b?Vc.b(a):Vc.call(null,a),Vc.b?Vc.b(a):Vc.call(null,a),null):w?new U(null,a,a,null):null}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}();
function V(a,b,c,d){this.i=a;this.Ga=b;this.A=c;this.l=d;this.p=0;this.h=32374988}n=V.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.V=function(a){a.t(a);return null==this.A?null:this.A.V(this.A)};n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};function Xc(a){null!=a.Ga&&(a.A=a.Ga.o?a.Ga.o():a.Ga.call(null),a.Ga=null);return a.A}n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};
n.t=function(a){Xc(a);if(null==this.A)return null;for(a=this.A;;)if(a instanceof V)a=Xc(a);else return this.A=a,null==this.A?null:this.A.t(this.A)};n.Q=function(a){a.t(a);return null==this.A?null:this.A.Q(this.A)};n.S=function(a){a.t(a);return null!=this.A?this.A.S(this.A):G};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return new V(b,this.Ga,this.A,this.l)};n.C=f("i");n.H=function(){return N(G,this.i)};function Yc(a,b){this.ab=a;this.end=b;this.p=0;this.h=2}Yc.prototype.G=f("end");
Yc.prototype.add=function(a){this.ab[this.end]=a;return this.end+=1};Yc.prototype.aa=function(){var a=new Zc(this.ab,0,this.end);this.ab=null;return a};function Zc(a,b,c){this.d=a;this.K=b;this.end=c;this.p=0;this.h=524306}n=Zc.prototype;n.N=function(a,b){return Sb.n(this.d,b,this.d[this.K],this.K+1)};n.J=function(a,b,c){return Sb.n(this.d,b,c,this.K)};n.Fb=function(){if(this.K===this.end)throw Error("-drop-first of empty chunk");return new Zc(this.d,this.K+1,this.end)};
n.L=function(a,b){return this.d[this.K+b]};n.P=function(a,b,c){return((a=0<=b)?b<this.end-this.K:a)?this.d[this.K+b]:c};n.G=function(){return this.end-this.K};
var $c=function(){function a(a,b,c){return new Zc(a,b,c)}function b(a,b){return new Zc(a,b,a.length)}function c(a){return new Zc(a,0,a.length)}var d=null,d=function(d,g,h){switch(arguments.length){case 1:return c.call(this,d);case 2:return b.call(this,d,g);case 3:return a.call(this,d,g,h)}throw Error("Invalid arity: "+arguments.length);};d.b=c;d.a=b;d.c=a;return d}();function ad(a,b,c,d){this.aa=a;this.ja=b;this.i=c;this.l=d;this.h=31850732;this.p=1536}n=ad.prototype;
n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.V=function(){if(1<va(this.aa))return new ad(Bb(this.aa),this.ja,this.i,null);var a=gb(this.ja);return null==a?null:a};n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};n.t=aa();n.Q=function(){return B.a(this.aa,0)};n.S=function(){return 1<va(this.aa)?new ad(Bb(this.aa),this.ja,this.i,null):null==this.ja?G:this.ja};n.Gb=function(){return null==this.ja?null:this.ja};n.u=function(a,b){return Yb(a,b)};
n.D=function(a,b){return new ad(this.aa,this.ja,b,this.l)};n.C=f("i");n.H=function(){return N(G,this.i)};n.cb=f("aa");n.Va=function(){return null==this.ja?G:this.ja};function bd(a,b){return 0===va(a)?b:new ad(a,b,null,null)}function Dc(a){for(var b=[];;)if(D(a))b.push(E(a)),a=H(a);else return b}function cd(a,b){if(Tb(a))return O(a);for(var c=a,d=b,e=0;;){var g;g=(g=0<d)?D(c):g;if(t(g))c=H(c),d-=1,e+=1;else return e}}
var ed=function dd(b){return null==b?null:null==H(b)?D(E(b)):w?K(E(b),dd(H(b))):null},fd=function(){function a(a,b){return new V(null,function(){var c=D(a);return c?sc(c)?bd(Cb(c),d.a(Db(c),b)):K(E(c),d.a(F(c),b)):b},null,null)}function b(a){return new V(null,function(){return a},null,null)}function c(){return new V(null,m(null),null,null)}var d=null,e=function(){function a(c,d,e){var g=null;2<arguments.length&&(g=I(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,d,g)}function b(a,
c,e){return function u(a,b){return new V(null,function(){var c=D(a);return c?sc(c)?bd(Cb(c),u(Db(c),b)):K(E(c),u(F(c),b)):t(b)?u(E(b),H(b)):null},null,null)}(d.a(a,c),e)}a.j=2;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=F(a);return b(c,d,a)};a.e=b;return a}(),d=function(d,h,k){switch(arguments.length){case 0:return c.call(this);case 1:return b.call(this,d);case 2:return a.call(this,d,h);default:return e.e(d,h,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};d.j=2;d.g=e.g;d.o=c;
d.b=b;d.a=a;d.e=e.e;return d}(),gd=function(){function a(a,b,c,d){return K(a,K(b,K(c,d)))}function b(a,b,c){return K(a,K(b,c))}var c=null,d=function(){function a(c,d,e,q,s){var u=null;4<arguments.length&&(u=I(Array.prototype.slice.call(arguments,4),0));return b.call(this,c,d,e,q,u)}function b(a,c,d,e,g){return K(a,K(c,K(d,K(e,ed(g)))))}a.j=4;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=H(a);var e=E(a);a=H(a);var s=E(a);a=F(a);return b(c,d,e,s,a)};a.e=b;return a}(),c=function(c,g,h,k,l){switch(arguments.length){case 1:return D(c);
case 2:return K(c,g);case 3:return b.call(this,c,g,h);case 4:return a.call(this,c,g,h,k);default:return d.e(c,g,h,k,I(arguments,4))}throw Error("Invalid arity: "+arguments.length);};c.j=4;c.g=d.g;c.b=function(a){return D(a)};c.a=function(a,b){return K(a,b)};c.c=b;c.n=a;c.e=d.e;return c}();function hd(a){return wb(a)}function id(a,b,c){return xb(a,b,c)}
function jd(a,b,c){var d=D(c);if(0===b)return a.o?a.o():a.call(null);c=Ba(d);var e=Ca(d);if(1===b)return a.b?a.b(c):a.b?a.b(c):a.call(null,c);var d=Ba(e),g=Ca(e);if(2===b)return a.a?a.a(c,d):a.a?a.a(c,d):a.call(null,c,d);var e=Ba(g),h=Ca(g);if(3===b)return a.c?a.c(c,d,e):a.c?a.c(c,d,e):a.call(null,c,d,e);var g=Ba(h),k=Ca(h);if(4===b)return a.n?a.n(c,d,e,g):a.n?a.n(c,d,e,g):a.call(null,c,d,e,g);h=Ba(k);k=Ca(k);if(5===b)return a.s?a.s(c,d,e,g,h):a.s?a.s(c,d,e,g,h):a.call(null,c,d,e,g,h);a=Ba(k);var l=
Ca(k);if(6===b)return a.da?a.da(c,d,e,g,h,a):a.da?a.da(c,d,e,g,h,a):a.call(null,c,d,e,g,h,a);var k=Ba(l),q=Ca(l);if(7===b)return a.Ca?a.Ca(c,d,e,g,h,a,k):a.Ca?a.Ca(c,d,e,g,h,a,k):a.call(null,c,d,e,g,h,a,k);var l=Ba(q),s=Ca(q);if(8===b)return a.qb?a.qb(c,d,e,g,h,a,k,l):a.qb?a.qb(c,d,e,g,h,a,k,l):a.call(null,c,d,e,g,h,a,k,l);var q=Ba(s),u=Ca(s);if(9===b)return a.rb?a.rb(c,d,e,g,h,a,k,l,q):a.rb?a.rb(c,d,e,g,h,a,k,l,q):a.call(null,c,d,e,g,h,a,k,l,q);var s=Ba(u),A=Ca(u);if(10===b)return a.fb?a.fb(c,d,
e,g,h,a,k,l,q,s):a.fb?a.fb(c,d,e,g,h,a,k,l,q,s):a.call(null,c,d,e,g,h,a,k,l,q,s);var u=Ba(A),P=Ca(A);if(11===b)return a.gb?a.gb(c,d,e,g,h,a,k,l,q,s,u):a.gb?a.gb(c,d,e,g,h,a,k,l,q,s,u):a.call(null,c,d,e,g,h,a,k,l,q,s,u);var A=Ba(P),L=Ca(P);if(12===b)return a.hb?a.hb(c,d,e,g,h,a,k,l,q,s,u,A):a.hb?a.hb(c,d,e,g,h,a,k,l,q,s,u,A):a.call(null,c,d,e,g,h,a,k,l,q,s,u,A);var P=Ba(L),W=Ca(L);if(13===b)return a.ib?a.ib(c,d,e,g,h,a,k,l,q,s,u,A,P):a.ib?a.ib(c,d,e,g,h,a,k,l,q,s,u,A,P):a.call(null,c,d,e,g,h,a,k,l,
q,s,u,A,P);var L=Ba(W),ma=Ca(W);if(14===b)return a.jb?a.jb(c,d,e,g,h,a,k,l,q,s,u,A,P,L):a.jb?a.jb(c,d,e,g,h,a,k,l,q,s,u,A,P,L):a.call(null,c,d,e,g,h,a,k,l,q,s,u,A,P,L);var W=Ba(ma),ra=Ca(ma);if(15===b)return a.kb?a.kb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W):a.kb?a.kb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W):a.call(null,c,d,e,g,h,a,k,l,q,s,u,A,P,L,W);var ma=Ba(ra),Ha=Ca(ra);if(16===b)return a.lb?a.lb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma):a.lb?a.lb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma):a.call(null,c,d,e,g,h,a,k,l,q,s,u,A,P,L,
W,ma);var ra=Ba(Ha),db=Ca(Ha);if(17===b)return a.mb?a.mb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra):a.mb?a.mb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra):a.call(null,c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra);var Ha=Ba(db),vc=Ca(db);if(18===b)return a.nb?a.nb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra,Ha):a.nb?a.nb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra,Ha):a.call(null,c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra,Ha);db=Ba(vc);vc=Ca(vc);if(19===b)return a.ob?a.ob(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra,Ha,db):a.ob?a.ob(c,d,e,g,h,a,k,l,q,
s,u,A,P,L,W,ma,ra,Ha,db):a.call(null,c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra,Ha,db);var gc=Ba(vc);Ca(vc);if(20===b)return a.pb?a.pb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra,Ha,db,gc):a.pb?a.pb(c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra,Ha,db,gc):a.call(null,c,d,e,g,h,a,k,l,q,s,u,A,P,L,W,ma,ra,Ha,db,gc);throw Error("Only up to 20 arguments supported on functions");}
var T=function(){function a(a,b,c,d,e){b=gd.n(b,c,d,e);c=a.j;return a.g?(d=cd(b,c+1),d<=c?jd(a,d,b):a.g(b)):a.apply(a,Dc(b))}function b(a,b,c,d){b=gd.c(b,c,d);c=a.j;return a.g?(d=cd(b,c+1),d<=c?jd(a,d,b):a.g(b)):a.apply(a,Dc(b))}function c(a,b,c){b=gd.a(b,c);c=a.j;if(a.g){var d=cd(b,c+1);return d<=c?jd(a,d,b):a.g(b)}return a.apply(a,Dc(b))}function d(a,b){var c=a.j;if(a.g){var d=cd(b,c+1);return d<=c?jd(a,d,b):a.g(b)}return a.apply(a,Dc(b))}var e=null,g=function(){function a(c,d,e,g,h,P){var L=null;
5<arguments.length&&(L=I(Array.prototype.slice.call(arguments,5),0));return b.call(this,c,d,e,g,h,L)}function b(a,c,d,e,g,h){c=K(c,K(d,K(e,K(g,ed(h)))));d=a.j;return a.g?(e=cd(c,d+1),e<=d?jd(a,e,c):a.g(c)):a.apply(a,Dc(c))}a.j=5;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=H(a);var e=E(a);a=H(a);var g=E(a);a=H(a);var h=E(a);a=F(a);return b(c,d,e,g,h,a)};a.e=b;return a}(),e=function(e,k,l,q,s,u){switch(arguments.length){case 2:return d.call(this,e,k);case 3:return c.call(this,e,k,l);case 4:return b.call(this,
e,k,l,q);case 5:return a.call(this,e,k,l,q,s);default:return g.e(e,k,l,q,s,I(arguments,5))}throw Error("Invalid arity: "+arguments.length);};e.j=5;e.g=g.g;e.a=d;e.c=c;e.n=b;e.s=a;e.e=g.e;return e}();function kd(a,b){for(;;){if(null==D(b))return!0;if(t(a.b?a.b(E(b)):a.call(null,E(b)))){var c=a,d=H(b);a=c;b=d}else return w?!1:null}}function ld(a){return a}
function md(a){return function(){var b=null,c=function(){function b(a,d,k){var l=null;2<arguments.length&&(l=I(Array.prototype.slice.call(arguments,2),0));return c.call(this,a,d,l)}function c(b,d,e){return na(T.n(a,b,d,e))}b.j=2;b.g=function(a){var b=E(a);a=H(a);var d=E(a);a=F(a);return c(b,d,a)};b.e=c;return b}(),b=function(b,e,g){switch(arguments.length){case 0:return na(a.o?a.o():a.call(null));case 1:return na(a.b?a.b(b):a.call(null,b));case 2:return na(a.a?a.a(b,e):a.call(null,b,e));default:return c.e(b,
e,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.j=2;b.g=c.g;return b}()}
var nd=function(){function a(a,b,c){return function(){var d=null,l=function(){function d(a,b,c,e){var g=null;3<arguments.length&&(g=I(Array.prototype.slice.call(arguments,3),0));return k.call(this,a,b,c,g)}function k(d,l,q,s){return a.b?a.b(b.b?b.b(T.s(c,d,l,q,s)):b.call(null,T.s(c,d,l,q,s))):a.call(null,b.b?b.b(T.s(c,d,l,q,s)):b.call(null,T.s(c,d,l,q,s)))}d.j=3;d.g=function(a){var b=E(a);a=H(a);var c=E(a);a=H(a);var d=E(a);a=F(a);return k(b,c,d,a)};d.e=k;return d}(),d=function(d,k,u,A){switch(arguments.length){case 0:return a.b?
a.b(b.b?b.b(c.o?c.o():c.call(null)):b.call(null,c.o?c.o():c.call(null))):a.call(null,b.b?b.b(c.o?c.o():c.call(null)):b.call(null,c.o?c.o():c.call(null)));case 1:return a.b?a.b(b.b?b.b(c.b?c.b(d):c.call(null,d)):b.call(null,c.b?c.b(d):c.call(null,d))):a.call(null,b.b?b.b(c.b?c.b(d):c.call(null,d)):b.call(null,c.b?c.b(d):c.call(null,d)));case 2:return a.b?a.b(b.b?b.b(c.a?c.a(d,k):c.call(null,d,k)):b.call(null,c.a?c.a(d,k):c.call(null,d,k))):a.call(null,b.b?b.b(c.a?c.a(d,k):c.call(null,d,k)):b.call(null,
c.a?c.a(d,k):c.call(null,d,k)));case 3:return a.b?a.b(b.b?b.b(c.c?c.c(d,k,u):c.call(null,d,k,u)):b.call(null,c.c?c.c(d,k,u):c.call(null,d,k,u))):a.call(null,b.b?b.b(c.c?c.c(d,k,u):c.call(null,d,k,u)):b.call(null,c.c?c.c(d,k,u):c.call(null,d,k,u)));default:return l.e(d,k,u,I(arguments,3))}throw Error("Invalid arity: "+arguments.length);};d.j=3;d.g=l.g;return d}()}function b(a,b){return function(){var c=null,d=function(){function c(a,b,e,g){var h=null;3<arguments.length&&(h=I(Array.prototype.slice.call(arguments,
3),0));return d.call(this,a,b,e,h)}function d(c,h,k,l){return a.b?a.b(T.s(b,c,h,k,l)):a.call(null,T.s(b,c,h,k,l))}c.j=3;c.g=function(a){var b=E(a);a=H(a);var c=E(a);a=H(a);var e=E(a);a=F(a);return d(b,c,e,a)};c.e=d;return c}(),c=function(c,h,s,u){switch(arguments.length){case 0:return a.b?a.b(b.o?b.o():b.call(null)):a.call(null,b.o?b.o():b.call(null));case 1:return a.b?a.b(b.b?b.b(c):b.call(null,c)):a.call(null,b.b?b.b(c):b.call(null,c));case 2:return a.b?a.b(b.a?b.a(c,h):b.call(null,c,h)):a.call(null,
b.a?b.a(c,h):b.call(null,c,h));case 3:return a.b?a.b(b.c?b.c(c,h,s):b.call(null,c,h,s)):a.call(null,b.c?b.c(c,h,s):b.call(null,c,h,s));default:return d.e(c,h,s,I(arguments,3))}throw Error("Invalid arity: "+arguments.length);};c.j=3;c.g=d.g;return c}()}var c=null,d=function(){function a(c,d,e,q){var s=null;3<arguments.length&&(s=I(Array.prototype.slice.call(arguments,3),0));return b.call(this,c,d,e,s)}function b(a,c,d,e){var g=Tc(gd.n(a,c,d,e));return function(){function a(c){var d=null;0<arguments.length&&
(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){a=T.a(E(g),a);for(var c=H(g);;)if(c)a=E(c).call(null,a),c=H(c);else return a}a.j=0;a.g=function(a){a=D(a);return b(a)};a.e=b;return a}()}a.j=3;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=H(a);var e=E(a);a=F(a);return b(c,d,e,a)};a.e=b;return a}(),c=function(c,g,h,k){switch(arguments.length){case 0:return ld;case 1:return c;case 2:return b.call(this,c,g);case 3:return a.call(this,c,g,h);default:return d.e(c,g,h,
I(arguments,3))}throw Error("Invalid arity: "+arguments.length);};c.j=3;c.g=d.g;c.o=function(){return ld};c.b=aa();c.a=b;c.c=a;c.e=d.e;return c}(),od=function(){function a(a,b,c,d){return function(){function e(a){var b=null;0<arguments.length&&(b=I(Array.prototype.slice.call(arguments,0),0));return s.call(this,b)}function s(e){return T.s(a,b,c,d,e)}e.j=0;e.g=function(a){a=D(a);return s(a)};e.e=s;return e}()}function b(a,b,c){return function(){function d(a){var b=null;0<arguments.length&&(b=I(Array.prototype.slice.call(arguments,
0),0));return e.call(this,b)}function e(d){return T.n(a,b,c,d)}d.j=0;d.g=function(a){a=D(a);return e(a)};d.e=e;return d}()}function c(a,b){return function(){function c(a){var b=null;0<arguments.length&&(b=I(Array.prototype.slice.call(arguments,0),0));return d.call(this,b)}function d(c){return T.c(a,b,c)}c.j=0;c.g=function(a){a=D(a);return d(a)};c.e=d;return c}()}var d=null,e=function(){function a(c,d,e,g,u){var A=null;4<arguments.length&&(A=I(Array.prototype.slice.call(arguments,4),0));return b.call(this,
c,d,e,g,A)}function b(a,c,d,e,g){return function(){function b(a){var c=null;0<arguments.length&&(c=I(Array.prototype.slice.call(arguments,0),0));return h.call(this,c)}function h(b){return T.s(a,c,d,e,fd.a(g,b))}b.j=0;b.g=function(a){a=D(a);return h(a)};b.e=h;return b}()}a.j=4;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=H(a);var e=E(a);a=H(a);var g=E(a);a=F(a);return b(c,d,e,g,a)};a.e=b;return a}(),d=function(d,h,k,l,q){switch(arguments.length){case 2:return c.call(this,d,h);case 3:return b.call(this,
d,h,k);case 4:return a.call(this,d,h,k,l);default:return e.e(d,h,k,l,I(arguments,4))}throw Error("Invalid arity: "+arguments.length);};d.j=4;d.g=e.g;d.a=c;d.c=b;d.n=a;d.e=e.e;return d}(),pd=function(){function a(a,b,c,d){return function(){var l=null,q=function(){function l(a,b,c,d){var e=null;3<arguments.length&&(e=I(Array.prototype.slice.call(arguments,3),0));return q.call(this,a,b,c,e)}function q(l,s,u,W){return T.s(a,null==l?b:l,null==s?c:s,null==u?d:u,W)}l.j=3;l.g=function(a){var b=E(a);a=H(a);
var c=E(a);a=H(a);var d=E(a);a=F(a);return q(b,c,d,a)};l.e=q;return l}(),l=function(l,u,A,P){switch(arguments.length){case 2:return a.a?a.a(null==l?b:l,null==u?c:u):a.call(null,null==l?b:l,null==u?c:u);case 3:return a.c?a.c(null==l?b:l,null==u?c:u,null==A?d:A):a.call(null,null==l?b:l,null==u?c:u,null==A?d:A);default:return q.e(l,u,A,I(arguments,3))}throw Error("Invalid arity: "+arguments.length);};l.j=3;l.g=q.g;return l}()}function b(a,b,c){return function(){var d=null,l=function(){function d(a,b,
c,e){var g=null;3<arguments.length&&(g=I(Array.prototype.slice.call(arguments,3),0));return k.call(this,a,b,c,g)}function k(d,l,q,s){return T.s(a,null==d?b:d,null==l?c:l,q,s)}d.j=3;d.g=function(a){var b=E(a);a=H(a);var c=E(a);a=H(a);var d=E(a);a=F(a);return k(b,c,d,a)};d.e=k;return d}(),d=function(d,k,u,A){switch(arguments.length){case 2:return a.a?a.a(null==d?b:d,null==k?c:k):a.call(null,null==d?b:d,null==k?c:k);case 3:return a.c?a.c(null==d?b:d,null==k?c:k,u):a.call(null,null==d?b:d,null==k?c:k,
u);default:return l.e(d,k,u,I(arguments,3))}throw Error("Invalid arity: "+arguments.length);};d.j=3;d.g=l.g;return d}()}function c(a,b){return function(){var c=null,d=function(){function c(a,b,e,g){var h=null;3<arguments.length&&(h=I(Array.prototype.slice.call(arguments,3),0));return d.call(this,a,b,e,h)}function d(c,h,k,l){return T.s(a,null==c?b:c,h,k,l)}c.j=3;c.g=function(a){var b=E(a);a=H(a);var c=E(a);a=H(a);var e=E(a);a=F(a);return d(b,c,e,a)};c.e=d;return c}(),c=function(c,h,s,u){switch(arguments.length){case 1:return a.b?
a.b(null==c?b:c):a.call(null,null==c?b:c);case 2:return a.a?a.a(null==c?b:c,h):a.call(null,null==c?b:c,h);case 3:return a.c?a.c(null==c?b:c,h,s):a.call(null,null==c?b:c,h,s);default:return d.e(c,h,s,I(arguments,3))}throw Error("Invalid arity: "+arguments.length);};c.j=3;c.g=d.g;return c}()}var d=null,d=function(d,g,h,k){switch(arguments.length){case 2:return c.call(this,d,g);case 3:return b.call(this,d,g,h);case 4:return a.call(this,d,g,h,k)}throw Error("Invalid arity: "+arguments.length);};d.a=c;
d.c=b;d.n=a;return d}(),qd=function(){function a(a,b,c,e){return new V(null,function(){var q=D(b),s=D(c),u=D(e);return(q?s?u:s:q)?K(a.c?a.c(E(q),E(s),E(u)):a.call(null,E(q),E(s),E(u)),d.n(a,F(q),F(s),F(u))):null},null,null)}function b(a,b,c){return new V(null,function(){var e=D(b),q=D(c);return(e?q:e)?K(a.a?a.a(E(e),E(q)):a.call(null,E(e),E(q)),d.c(a,F(e),F(q))):null},null,null)}function c(a,b){return new V(null,function(){var c=D(b);if(c){if(sc(c)){for(var e=Cb(c),q=O(e),s=new Yc(Array(q),0),u=0;;)if(u<
q){var A=a.b?a.b(B.a(e,u)):a.call(null,B.a(e,u));s.add(A);u+=1}else break;return bd(s.aa(),d.a(a,Db(c)))}return K(a.b?a.b(E(c)):a.call(null,E(c)),d.a(a,F(c)))}return null},null,null)}var d=null,e=function(){function a(c,d,e,g,u){var A=null;4<arguments.length&&(A=I(Array.prototype.slice.call(arguments,4),0));return b.call(this,c,d,e,g,A)}function b(a,c,e,g,h){return d.a(function(b){return T.a(a,b)},function P(a){return new V(null,function(){var b=d.a(D,a);return kd(ld,b)?K(d.a(E,b),P(d.a(F,b))):null},
null,null)}(ac.e(h,g,I([e,c],0))))}a.j=4;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=H(a);var e=E(a);a=H(a);var g=E(a);a=F(a);return b(c,d,e,g,a)};a.e=b;return a}(),d=function(d,h,k,l,q){switch(arguments.length){case 2:return c.call(this,d,h);case 3:return b.call(this,d,h,k);case 4:return a.call(this,d,h,k,l);default:return e.e(d,h,k,l,I(arguments,4))}throw Error("Invalid arity: "+arguments.length);};d.j=4;d.g=e.g;d.a=c;d.c=b;d.n=a;d.e=e.e;return d}(),sd=function rd(b,c){return new V(null,function(){if(0<
b){var d=D(c);return d?K(E(d),rd(b-1,F(d))):null}return null},null,null)};function td(a,b){return new V(null,function(){var c;a:{c=a;for(var d=b;;){var d=D(d),e=0<c;if(t(e?d:e))c-=1,d=F(d);else{c=d;break a}}c=void 0}return c},null,null)}
var ud=function(){function a(a,b){return sd(a,c.b(b))}function b(a){return new V(null,function(){return K(a,c.b(a))},null,null)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),vd=function(){function a(a,b){return sd(a,c.b(b))}function b(a){return new V(null,function(){return K(a.o?a.o():a.call(null),c.b(a))},null,null)}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,
c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),wd=function(){function a(a,c){return new V(null,function(){var g=D(a),h=D(c);return(g?h:g)?K(E(g),K(E(h),b.a(F(g),F(h)))):null},null,null)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=I(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){return new V(null,function(){var c=qd.a(D,ac.e(e,d,I([a],0)));return kd(ld,c)?fd.a(qd.a(E,
c),T.a(b,qd.a(F,c))):null},null,null)}a.j=2;a.g=function(a){var b=E(a);a=H(a);var d=E(a);a=F(a);return c(b,d,a)};a.e=c;return a}(),b=function(b,e,g){switch(arguments.length){case 2:return a.call(this,b,e);default:return c.e(b,e,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.j=2;b.g=c.g;b.a=a;b.e=c.e;return b}();function xd(a){return function c(a,e){return new V(null,function(){var g=D(a);return g?K(E(g),c(F(g),e)):D(e)?c(E(e),F(e)):null},null,null)}(null,a)}
var yd=function(){function a(a,b){return xd(qd.a(a,b))}var b=null,c=function(){function a(c,d,k){var l=null;2<arguments.length&&(l=I(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,d,l)}function b(a,c,d){return xd(T.n(qd,a,c,d))}a.j=2;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=F(a);return b(c,d,a)};a.e=b;return a}(),b=function(b,e,g){switch(arguments.length){case 2:return a.call(this,b,e);default:return c.e(b,e,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};
b.j=2;b.g=c.g;b.a=a;b.e=c.e;return b}(),Ad=function zd(b,c){return new V(null,function(){var d=D(c);if(d){if(sc(d)){for(var e=Cb(d),g=O(e),h=new Yc(Array(g),0),k=0;;)if(k<g){if(t(b.b?b.b(B.a(e,k)):b.call(null,B.a(e,k)))){var l=B.a(e,k);h.add(l)}k+=1}else break;return bd(h.aa(),zd(b,Db(d)))}e=E(d);d=F(d);return t(b.b?b.b(e):b.call(null,e))?K(e,zd(b,d)):zd(b,d)}return null},null,null)};function Bd(a,b){return Ad(md(a),b)}
function Cd(a){var b=Dd;return function d(a){return new V(null,function(){return K(a,t(b.b?b.b(a):b.call(null,a))?yd.a(d,D.b?D.b(a):D.call(null,a)):null)},null,null)}(a)}function Ed(a,b){var c;null!=a?(c=a?((c=a.p&4)?c:a.kc)?!0:!1:!1,c=c?hd(z.c(vb,ub(a),b)):z.c(ya,a,b)):c=z.c(ac,G,b);return c}
var Fd=function(){function a(a,b,c,k){return new V(null,function(){var l=D(k);if(l){var q=sd(a,l);return a===O(q)?K(q,d.n(a,b,c,td(b,l))):Xb.e(I([sd(a,fd.a(q,c))],0))}return null},null,null)}function b(a,b,c){return new V(null,function(){var k=D(c);if(k){var l=sd(a,k);return a===O(l)?K(l,d.c(a,b,td(b,k))):null}return null},null,null)}function c(a,b){return d.c(a,a,b)}var d=null,d=function(d,g,h,k){switch(arguments.length){case 2:return c.call(this,d,g);case 3:return b.call(this,d,g,h);case 4:return a.call(this,
d,g,h,k)}throw Error("Invalid arity: "+arguments.length);};d.a=c;d.c=b;d.n=a;return d}(),Gd=function(){function a(a,b,c){var h=wc;for(b=D(b);;)if(b){var k=a,l=void 0;l=k?((l=k.h&256)?l:k.Wa)?!0:k.h?!1:v(Ea,k):v(Ea,k);if(l){a=R.c(a,E(b),h);if(h===a)return c;b=H(b)}else return c}else return a}function b(a,b){return c.c(a,b,null)}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=
b;c.c=a;return c}(),Hd=function(){function a(a,b,c,d,g,u){var A=Q.c(b,0,null);b=Lc(b);return t(b)?S.c(a,A,e.da(R.a(a,A),b,c,d,g,u)):S.c(a,A,c.n?c.n(R.a(a,A),d,g,u):c.call(null,R.a(a,A),d,g,u))}function b(a,b,c,d,g){var u=Q.c(b,0,null);b=Lc(b);return t(b)?S.c(a,u,e.s(R.a(a,u),b,c,d,g)):S.c(a,u,c.c?c.c(R.a(a,u),d,g):c.call(null,R.a(a,u),d,g))}function c(a,b,c,d){var g=Q.c(b,0,null);b=Lc(b);return t(b)?S.c(a,g,e.n(R.a(a,g),b,c,d)):S.c(a,g,c.a?c.a(R.a(a,g),d):c.call(null,R.a(a,g),d))}function d(a,b,c){var d=
Q.c(b,0,null);b=Lc(b);return t(b)?S.c(a,d,e.c(R.a(a,d),b,c)):S.c(a,d,c.b?c.b(R.a(a,d)):c.call(null,R.a(a,d)))}var e=null,g=function(){function a(c,d,e,g,h,P,L){var W=null;6<arguments.length&&(W=I(Array.prototype.slice.call(arguments,6),0));return b.call(this,c,d,e,g,h,P,W)}function b(a,c,d,g,h,k,L){var W=Q.c(c,0,null);c=Lc(c);return t(c)?S.c(a,W,T.e(e,R.a(a,W),c,d,g,I([h,k,L],0))):S.c(a,W,T.e(d,R.a(a,W),g,h,k,I([L],0)))}a.j=6;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=H(a);var e=E(a);a=H(a);var g=
E(a);a=H(a);var h=E(a);a=H(a);var L=E(a);a=F(a);return b(c,d,e,g,h,L,a)};a.e=b;return a}(),e=function(e,k,l,q,s,u,A){switch(arguments.length){case 3:return d.call(this,e,k,l);case 4:return c.call(this,e,k,l,q);case 5:return b.call(this,e,k,l,q,s);case 6:return a.call(this,e,k,l,q,s,u);default:return g.e(e,k,l,q,s,u,I(arguments,6))}throw Error("Invalid arity: "+arguments.length);};e.j=6;e.g=g.g;e.c=d;e.n=c;e.s=b;e.da=a;e.e=g.e;return e}();function Id(a,b){this.q=a;this.d=b}
function Jd(a){return new Id(a.q,a.d.slice())}function Kd(a){a=a.f;return 32>a?0:a-1>>>5<<5}function Ld(a,b,c){for(;;){if(0===b)return c;var d=new Id(a,Array(32));d.d[0]=c;c=d;b-=5}}var Nd=function Md(b,c,d,e){var g=Jd(d),h=b.f-1>>>c&31;5===c?g.d[h]=e:(d=d.d[h],b=null!=d?Md(b,c-5,d,e):Ld(null,c-5,e),g.d[h]=b);return g};function Od(a,b){throw Error([y("No item "),y(a),y(" in vector of length "),y(b)].join(""));}
function Pd(a,b){var c=0<=b;if(c?b<a.f:c){if(b>=Kd(a))return a.U;for(var c=a.root,d=a.shift;;)if(0<d)var e=d-5,c=c.d[b>>>d&31],d=e;else return c.d}else return Od(b,a.f)}var Rd=function Qd(b,c,d,e,g){var h=Jd(d);if(0===c)h.d[e&31]=g;else{var k=e>>>c&31;b=Qd(b,c-5,d.d[k],e,g);h.d[k]=b}return h},Td=function Sd(b,c,d){var e=b.f-2>>>c&31;if(5<c){b=Sd(b,c-5,d.d[e]);if((c=null==b)?0===e:c)return null;d=Jd(d);d.d[e]=b;return d}return 0===e?null:w?(d=Jd(d),d.d[e]=null,d):null};
function Ud(a,b,c,d,e,g){this.i=a;this.f=b;this.shift=c;this.root=d;this.U=e;this.l=g;this.p=4;this.h=167668511}n=Ud.prototype;n.Ia=function(){return new Vd(this.f,this.shift,Wd.b?Wd.b(this.root):Wd.call(null,this.root),Xd.b?Xd.b(this.U):Xd.call(null,this.U))};n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.M=function(a,b){return a.P(a,b,null)};n.v=function(a,b,c){return a.P(a,b,c)};
n.Z=function(a,b,c){var d=0<=b;if(d?b<this.f:d)return Kd(a)<=b?(a=this.U.slice(),a[b&31]=c,new Ud(this.i,this.f,this.shift,this.root,a,null)):new Ud(this.i,this.f,this.shift,Rd(a,this.shift,this.root,b,c),this.U,null);if(b===this.f)return a.F(a,c);if(w)throw Error([y("Index "),y(b),y(" out of bounds  [0,"),y(this.f),y("]")].join(""));return null};
n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.L(this,c);case 3:return this.P(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};
n.Ja=function(a,b,c){c=[0,c];for(var d=0;;)if(d<this.f){var e=Pd(a,d),g=e.length;a:{for(var h=0,k=c[1];;)if(h<g){k=b.c?b.c(k,h+d,e[h]):b.call(null,k,h+d,e[h]);if(Qb(k)){e=k;break a}h+=1}else{c[0]=g;e=c[1]=k;break a}e=void 0}if(Qb(e))return J.b?J.b(e):J.call(null,e);d+=c[0]}else return c[1]};
n.F=function(a,b){if(32>this.f-Kd(a)){var c=this.U.slice();c.push(b);return new Ud(this.i,this.f+1,this.shift,this.root,c,null)}var d=this.f>>>5>1<<this.shift,c=d?this.shift+5:this.shift;if(d){d=new Id(null,Array(32));d.d[0]=this.root;var e=Ld(null,this.shift,new Id(null,this.U));d.d[1]=e}else d=Nd(a,this.shift,this.root,new Id(null,this.U));return new Ud(this.i,this.f+1,c,d,[b],null)};n.Ma=function(a){return 0<this.f?new Wb(a,this.f-1,null):G};n.Ka=function(a){return a.L(a,0)};
n.La=function(a){return a.L(a,1)};n.toString=function(){return Fb(this)};n.N=function(a,b){return Rb.a(a,b)};n.J=function(a,b,c){return Rb.c(a,b,c)};n.t=function(a){return 0===this.f?null:32>this.f?I.b(this.U):w?Yd.c?Yd.c(a,0,0):Yd.call(null,a,0,0):null};n.G=f("f");n.ua=function(a){return 0<this.f?a.L(a,this.f-1):null};
n.va=function(a){if(0===this.f)throw Error("Can't pop empty vector");if(1===this.f)return Za(Zd,this.i);if(1<this.f-Kd(a))return new Ud(this.i,this.f-1,this.shift,this.root,this.U.slice(0,-1),null);if(w){var b=Pd(a,this.f-2);a=Td(a,this.shift,this.root);a=null==a?$d:a;var c=this.f-1,d=5<this.shift;return(d?null==a.d[1]:d)?new Ud(this.i,c,this.shift-5,a.d[0],b,null):new Ud(this.i,c,this.shift,a,b,null)}return null};n.Oa=function(a,b,c){return a.Z(a,b,c)};n.u=function(a,b){return Yb(a,b)};
n.D=function(a,b){return new Ud(b,this.f,this.shift,this.root,this.U,this.l)};n.C=f("i");n.L=function(a,b){return Pd(a,b)[b&31]};n.P=function(a,b,c){var d=0<=b;return(d?b<this.f:d)?a.L(a,b):c};n.H=function(){return N(Zd,this.i)};var $d=new Id(null,Array(32)),Zd=new Ud(null,0,5,$d,[],0);function X(a){var b=a.length;if(32>b)return new Ud(null,b,5,$d,a,null);for(var c=a.slice(0,32),d=32,e=ub(new Ud(null,32,5,$d,c,null));;)if(d<b)c=d+1,e=vb(e,a[d]),d=c;else return wb(e)}
function ae(a){return wb(z.c(vb,ub(Zd),a))}var be=function(){function a(a){var c=null;0<arguments.length&&(c=I(Array.prototype.slice.call(arguments,0),0));return ae(c)}a.j=0;a.g=function(a){a=D(a);return ae(a)};a.e=function(a){return ae(a)};return a}();function ce(a,b,c,d,e,g){this.R=a;this.ba=b;this.m=c;this.K=d;this.i=e;this.l=g;this.h=32243948;this.p=1536}n=ce.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};
n.V=function(a){return this.K+1<this.ba.length?(a=Yd.n?Yd.n(this.R,this.ba,this.m,this.K+1):Yd.call(null,this.R,this.ba,this.m,this.K+1),null==a?null:a):a.Gb(a)};n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};n.N=function(a,b){return Rb.a(de.c?de.c(this.R,this.m+this.K,O(this.R)):de.call(null,this.R,this.m+this.K,O(this.R)),b)};n.J=function(a,b,c){return Rb.c(de.c?de.c(this.R,this.m+this.K,O(this.R)):de.call(null,this.R,this.m+this.K,O(this.R)),b,c)};n.t=aa();n.Q=function(){return this.ba[this.K]};
n.S=function(a){return this.K+1<this.ba.length?(a=Yd.n?Yd.n(this.R,this.ba,this.m,this.K+1):Yd.call(null,this.R,this.ba,this.m,this.K+1),null==a?G:a):a.Va(a)};n.Gb=function(){var a=this.ba.length,a=this.m+a<va(this.R)?Yd.c?Yd.c(this.R,this.m+a,0):Yd.call(null,this.R,this.m+a,0):null;return null==a?null:a};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return Yd.s?Yd.s(this.R,this.ba,this.m,this.K,b):Yd.call(null,this.R,this.ba,this.m,this.K,b)};n.H=function(){return N(Zd,this.i)};
n.cb=function(){return $c.a(this.ba,this.K)};n.Va=function(){var a=this.ba.length,a=this.m+a<va(this.R)?Yd.c?Yd.c(this.R,this.m+a,0):Yd.call(null,this.R,this.m+a,0):null;return null==a?G:a};
var Yd=function(){function a(a,b,c,d,l){return new ce(a,b,c,d,l,null)}function b(a,b,c,d){return new ce(a,b,c,d,null,null)}function c(a,b,c){return new ce(a,Pd(a,b),b,c,null,null)}var d=null,d=function(d,g,h,k,l){switch(arguments.length){case 3:return c.call(this,d,g,h);case 4:return b.call(this,d,g,h,k);case 5:return a.call(this,d,g,h,k,l)}throw Error("Invalid arity: "+arguments.length);};d.c=c;d.n=b;d.s=a;return d}();
function ee(a,b,c,d,e){this.i=a;this.$=b;this.start=c;this.end=d;this.l=e;this.p=0;this.h=32400159}n=ee.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.M=function(a,b){return a.P(a,b,null)};n.v=function(a,b,c){return a.P(a,b,c)};n.Z=function(a,b,c){var d=this,e=d.start+b;return fe.s?fe.s(d.i,S.c(d.$,e,c),d.start,function(){var a=d.end,b=e+1;return a>b?a:b}(),null):fe.call(null,d.i,S.c(d.$,e,c),d.start,function(){var a=d.end,b=e+1;return a>b?a:b}(),null)};
n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.L(this,c);case 3:return this.P(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.F=function(a,b){return fe.s?fe.s(this.i,Ua(this.$,this.end,b),this.start,this.end+1,null):fe.call(null,this.i,Ua(this.$,this.end,b),this.start,this.end+1,null)};n.toString=function(){return Fb(this)};
n.N=function(a,b){return Rb.a(a,b)};n.J=function(a,b,c){return Rb.c(a,b,c)};n.t=function(){var a=this;return function c(d){return d===a.end?null:K(B.a(a.$,d),new V(null,function(){return c(d+1)},null,null))}(a.start)};n.G=function(){return this.end-this.start};n.ua=function(){return B.a(this.$,this.end-1)};n.va=function(){if(this.start===this.end)throw Error("Can't pop empty vector");return fe.s?fe.s(this.i,this.$,this.start,this.end-1,null):fe.call(null,this.i,this.$,this.start,this.end-1,null)};
n.Oa=function(a,b,c){return a.Z(a,b,c)};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return fe.s?fe.s(b,this.$,this.start,this.end,this.l):fe.call(null,b,this.$,this.start,this.end,this.l)};n.C=f("i");n.L=function(a,b){var c=0>b;return(c?c:this.end<=this.start+b)?Od(b,this.end-this.start):B.a(this.$,this.start+b)};n.P=function(a,b,c){return((a=0>b)?a:this.end<=this.start+b)?c:B.c(this.$,this.start+b,c)};n.H=function(){return N(Zd,this.i)};
function fe(a,b,c,d,e){for(;;)if(b instanceof ee){var g=b.start+c,h=b.start+d;b=b.$;c=g;d=h}else{var k=O(b);if(function(){var a=0>c;return a||(a=0>d)?a:(a=c>k)?a:d>k}())throw Error("Index out of bounds");return new ee(a,b,c,d,e)}}
var de=function(){function a(a,b,c){return fe(null,a,b,c,null)}function b(a,b){return c.c(a,b,O(a))}var c=null,c=function(c,e,g){switch(arguments.length){case 2:return b.call(this,c,e);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.a=b;c.c=a;return c}();function ge(a,b){return a===b.q?b:new Id(a,b.d.slice())}function Wd(a){return new Id({},a.d.slice())}function Xd(a){var b=Array(32);uc(a,0,b,0,a.length);return b}
var ie=function he(b,c,d,e){d=ge(b.root.q,d);var g=b.f-1>>>c&31;if(5===c)b=e;else{var h=d.d[g];b=null!=h?he(b,c-5,h,e):Ld(b.root.q,c-5,e)}d.d[g]=b;return d},ke=function je(b,c,d){d=ge(b.root.q,d);var e=b.f-2>>>c&31;if(5<c){b=je(b,c-5,d.d[e]);if((c=null==b)?0===e:c)return null;d.d[e]=b;return d}return 0===e?null:w?(d.d[e]=null,d):null};
function le(a,b){var c=0<=b;if(c?b<a.f:c){if(b>=Kd(a))return a.U;for(var d=c=a.root,e=a.shift;;)if(0<e)d=ge(c.q,d.d[b>>>e&31]),e-=5;else return d.d}else throw Error([y("No item "),y(b),y(" in transient vector of length "),y(a.f)].join(""));}function Vd(a,b,c,d){this.f=a;this.shift=b;this.root=c;this.U=d;this.h=275;this.p=88}n=Vd.prototype;
n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.M(this,c);case 3:return this.v(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.M=function(a,b){return a.P(a,b,null)};n.v=function(a,b,c){return a.P(a,b,c)};n.L=function(a,b){if(this.root.q)return Pd(a,b)[b&31];throw Error("nth after persistent!");};n.P=function(a,b,c){var d=0<=b;return(d?b<this.f:d)?a.L(a,b):c};
n.G=function(){if(this.root.q)return this.f;throw Error("count after persistent!");};
function me(a,b,c,d){if(a.root.q){if(function(){var b=0<=c;return b?c<a.f:b}()){if(Kd(b)<=c)a.U[c&31]=d;else{var e=function h(b,e){var q=ge(a.root.q,e);if(0===b)q.d[c&31]=d;else{var s=c>>>b&31,u=h(b-5,q.d[s]);q.d[s]=u}return q}.call(null,a.shift,a.root);a.root=e}return b}if(c===a.f)return b.pa(b,d);if(w)throw Error([y("Index "),y(c),y(" out of bounds for TransientVector of length"),y(a.f)].join(""));return null}throw Error("assoc! after persistent!");}
n.Mb=function(a){var b=this;if(b.root.q){if(0===b.f)throw Error("Can't pop empty vector");if(1===b.f)return b.f=0,a;if(0<(b.f-1&31))return b.f-=1,a;if(w){var c=le(a,b.f-2),d=function(){var c=ke(a,b.shift,b.root);return null!=c?c:new Id(b.root.q,Array(32))}();if(function(){var a=5<b.shift;return a?null==d.d[1]:a}()){var e=ge(b.root.q,d.d[0]);b.root=e;b.shift-=5}else b.root=d;b.f-=1;b.U=c;return a}return null}throw Error("pop! after persistent!");};n.Da=function(a,b,c){return me(a,a,b,c)};
n.pa=function(a,b){if(this.root.q){if(32>this.f-Kd(a))this.U[this.f&31]=b;else{var c=new Id(this.root.q,this.U),d=Array(32);d[0]=b;this.U=d;if(this.f>>>5>1<<this.shift){var d=Array(32),e=this.shift+5;d[0]=this.root;d[1]=Ld(this.root.q,this.shift,c);this.root=new Id(this.root.q,d);this.shift=e}else this.root=ie(a,this.shift,this.root,c)}this.f+=1;return a}throw Error("conj! after persistent!");};
n.wa=function(a){if(this.root.q){this.root.q=null;a=this.f-Kd(a);var b=Array(a);uc(this.U,0,b,0,a);return new Ud(null,this.f,this.shift,this.root,b,null)}throw Error("persistent! called twice");};function ne(){this.p=0;this.h=2097152}ne.prototype.u=m(!1);var oe=new ne;function pe(a,b){return yc(qc(b)?O(a)===O(b)?kd(ld,qd.a(function(a){return Ob.a(R.c(b,E(a),oe),E(H(a)))},a)):null:null)}
function qe(a,b){var c=a.d;if(b instanceof U)a:{for(var d=c.length,e=b.ra,g=0;;){if(d<=g){c=-1;break a}var h=c[g],k=h instanceof U;if(k?e===h.ra:k){c=g;break a}if(w)g+=2;else{c=null;break a}}c=void 0}else if((d="string"==typeof b)?d:"number"===typeof b)a:{d=c.length;for(e=0;;){if(d<=e){c=-1;break a}if(b===c[e]){c=e;break a}if(w)e+=2;else{c=null;break a}}c=void 0}else if(b instanceof Lb)a:{d=c.length;e=b.Ba;for(g=0;;){if(d<=g){c=-1;break a}h=c[g];if((k=h instanceof Lb)?e===h.Ba:k){c=g;break a}if(w)g+=
2;else{c=null;break a}}c=void 0}else if(null==b)a:{d=c.length;for(e=0;;){if(d<=e){c=-1;break a}if(null==c[e]){c=e;break a}if(w)e+=2;else{c=null;break a}}c=void 0}else if(w)a:{d=c.length;for(e=0;;){if(d<=e){c=-1;break a}if(Ob.a(b,c[e])){c=e;break a}if(w)e+=2;else{c=null;break a}}c=void 0}else c=null;return c}function re(a,b,c){this.d=a;this.m=b;this.W=c;this.p=0;this.h=32374990}n=re.prototype;n.B=function(a){return Vb(a)};
n.V=function(){return this.m<this.d.length-2?new re(this.d,this.m+2,this.W):null};n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};n.t=aa();n.G=function(){return(this.d.length-this.m)/2};n.Q=function(){return X([this.d[this.m],this.d[this.m+1]])};n.S=function(){return this.m<this.d.length-2?new re(this.d,this.m+2,this.W):G};n.u=function(a,b){return Yb(a,b)};
n.D=function(a,b){return new re(this.d,this.m,b)};n.C=f("W");n.H=function(){return N(G,this.W)};function se(a,b,c,d){this.i=a;this.f=b;this.d=c;this.l=d;this.p=4;this.h=16123663}n=se.prototype;n.Ia=function(){return new te({},this.d.length,this.d.slice())};n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Mc(a)};n.M=function(a,b){return a.v(a,b,null)};n.v=function(a,b,c){a=qe(a,b);return-1===a?c:this.d[a+1]};
n.Z=function(a,b,c){var d=qe(a,b);if(-1===d){if(this.f<ue){d=a.d;a=d.length;for(var e=Array(a+2),g=0;;)if(g<a)e[g]=d[g],g+=1;else break;e[a]=b;e[a+1]=c;return new se(this.i,this.f+1,e,null)}return Za(Ja(Ed(ve,a),b,c),this.i)}return c===this.d[d+1]?a:w?(b=this.d.slice(),b[d+1]=c,new se(this.i,this.f,b,null)):null};n.Ua=function(a,b){return-1!==qe(a,b)};
n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.M(this,c);case 3:return this.v(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.Ja=function(a,b,c){a=this.d.length;for(var d=0;;)if(d<a){c=b.c?b.c(c,this.d[d],this.d[d+1]):b.call(null,c,this.d[d],this.d[d+1]);if(Qb(c))return J.b?J.b(c):J.call(null,c);d+=2}else return c};
n.F=function(a,b){return rc(b)?a.Z(a,B.a(b,0),B.a(b,1)):z.c(ya,a,b)};n.toString=function(){return Fb(this)};n.t=function(){return 0<=this.d.length-2?new re(this.d,0,null):null};n.G=f("f");n.u=function(a,b){return pe(a,b)};n.D=function(a,b){return new se(b,this.f,this.d,this.l)};n.C=f("i");n.H=function(){return Za(we,this.i)};
n.Xa=function(a,b){if(0<=qe(a,b)){var c=this.d.length,d=c-2;if(0===d)return a.H(a);for(var d=Array(d),e=0,g=0;;){if(e>=c)return new se(this.i,this.f-1,d,null);if(Ob.a(b,this.d[e]))e+=2;else if(w)d[g]=this.d[e],d[g+1]=this.d[e+1],g+=2,e+=2;else return null}}else return a};var we=new se(null,0,[],null),ue=8;function Gb(a,b){var c=b?a:a.slice();return new se(null,c.length/2,c,null)}function te(a,b,c){this.xa=a;this.ga=b;this.d=c;this.p=56;this.h=258}n=te.prototype;
n.xb=function(a,b){if(t(this.xa)){var c=qe(a,b);0<=c&&(this.d[c]=this.d[this.ga-2],this.d[c+1]=this.d[this.ga-1],c=this.d,c.pop(),c.pop(),this.ga-=2);return a}throw Error("dissoc! after persistent!");};n.Da=function(a,b,c){if(t(this.xa)){var d=qe(a,b);if(-1===d)return this.ga+2<=2*ue?(this.ga+=2,this.d.push(b),this.d.push(c),a):id(xe.a?xe.a(this.ga,this.d):xe.call(null,this.ga,this.d),b,c);c!==this.d[d+1]&&(this.d[d+1]=c);return a}throw Error("assoc! after persistent!");};
n.pa=function(a,b){if(t(this.xa)){var c;c=b?((c=b.h&2048)?c:b.Ub)?!0:b.h?!1:v(Ma,b):v(Ma,b);if(c)return a.Da(a,Nc.b?Nc.b(b):Nc.call(null,b),Oc.b?Oc.b(b):Oc.call(null,b));c=D(b);for(var d=a;;){var e=E(c);if(t(e))c=H(c),d=d.Da(d,Nc.b?Nc.b(e):Nc.call(null,e),Oc.b?Oc.b(e):Oc.call(null,e));else return d}}else throw Error("conj! after persistent!");};n.wa=function(){if(t(this.xa))return this.xa=!1,new se(null,Jc(this.ga),this.d,null);throw Error("persistent! called twice");};
n.M=function(a,b){return a.v(a,b,null)};n.v=function(a,b,c){if(t(this.xa))return a=qe(a,b),-1===a?c:this.d[a+1];throw Error("lookup after persistent!");};n.G=function(){if(t(this.xa))return Jc(this.ga);throw Error("count after persistent!");};function xe(a,b){for(var c=ub(ve),d=0;;)if(d<a)c=xb(c,b[d],b[d+1]),d+=2;else return c}function ye(){this.k=!1}function ze(a,b){var c;a===b?c=!0:(c=a===b?!0:((c=a instanceof U)?b instanceof U:c)?a.ra===b.ra:!1,c=c?!0:w?Ob.a(a,b):null);return c}
var Ae=function(){function a(a,b,c,h,k){a=a.slice();a[b]=c;a[h]=k;return a}function b(a,b,c){a=a.slice();a[b]=c;return a}var c=null,c=function(c,e,g,h,k){switch(arguments.length){case 3:return b.call(this,c,e,g);case 5:return a.call(this,c,e,g,h,k)}throw Error("Invalid arity: "+arguments.length);};c.c=b;c.s=a;return c}();function Be(a,b){var c=Array(a.length-2);uc(a,0,c,0,2*b);uc(a,2*(b+1),c,2*b,c.length-2*b);return c}
var Ce=function(){function a(a,b,c,h,k,l){a=a.qa(b);a.d[c]=h;a.d[k]=l;return a}function b(a,b,c,h){a=a.qa(b);a.d[c]=h;return a}var c=null,c=function(c,e,g,h,k,l){switch(arguments.length){case 4:return b.call(this,c,e,g,h);case 6:return a.call(this,c,e,g,h,k,l)}throw Error("Invalid arity: "+arguments.length);};c.n=b;c.da=a;return c}();
function De(a,b,c){for(var d=a.length,e=0;;)if(e<d){var g=a[e];null!=g?c=b.c?b.c(c,g,a[e+1]):b.call(null,c,g,a[e+1]):(g=a[e+1],c=null!=g?g.za(b,c):c);if(Qb(c))return J.b?J.b(c):J.call(null,c);e+=2}else return c}function Ee(a,b,c){this.q=a;this.r=b;this.d=c}function Fe(a,b,c,d){if(a.r===c)return null;a=a.qa(b);b=a.d;var e=b.length;a.r^=c;uc(b,2*(d+1),b,2*d,e-2*(d+1));b[e-2]=null;b[e-1]=null;return a}n=Ee.prototype;
n.fa=function(a,b,c,d,e,g){var h=1<<(c>>>b&31),k=Kc(this.r&h-1);if(0===(this.r&h)){var l=Kc(this.r);if(2*l<this.d.length){a=this.qa(a);b=a.d;g.k=!0;a:for(c=2*(l-k),g=2*k+(c-1),l=2*(k+1)+(c-1);;){if(0===c)break a;b[l]=b[g];l-=1;c-=1;g-=1}b[2*k]=d;b[2*k+1]=e;a.r|=h;return a}if(16<=l){k=Array(32);k[c>>>b&31]=Ge.fa(a,b+5,c,d,e,g);for(e=d=0;;)if(32>d)0!==(this.r>>>d&1)&&(k[d]=null!=this.d[e]?Ge.fa(a,b+5,C.b(this.d[e]),this.d[e],this.d[e+1],g):this.d[e+1],e+=2),d+=1;else break;return new He(a,l+1,k)}return w?
(b=Array(2*(l+4)),uc(this.d,0,b,0,2*k),b[2*k]=d,b[2*k+1]=e,uc(this.d,2*k,b,2*(k+1),2*(l-k)),g.k=!0,a=this.qa(a),a.d=b,a.r|=h,a):null}l=this.d[2*k];h=this.d[2*k+1];return null==l?(l=h.fa(a,b+5,c,d,e,g),l===h?this:Ce.n(this,a,2*k+1,l)):ze(d,l)?e===h?this:Ce.n(this,a,2*k+1,e):w?(g.k=!0,Ce.da(this,a,2*k,null,2*k+1,Ie.Ca?Ie.Ca(a,b+5,l,h,c,d,e):Ie.call(null,a,b+5,l,h,c,d,e))):null};n.Pa=function(){return Je.b?Je.b(this.d):Je.call(null,this.d)};
n.Ra=function(a,b,c,d,e){var g=1<<(c>>>b&31);if(0===(this.r&g))return this;var h=Kc(this.r&g-1),k=this.d[2*h],l=this.d[2*h+1];return null==k?(b=l.Ra(a,b+5,c,d,e),b===l?this:null!=b?Ce.n(this,a,2*h+1,b):this.r===g?null:w?Fe(this,a,g,h):null):ze(d,k)?(e[0]=!0,Fe(this,a,g,h)):w?this:null};n.qa=function(a){if(a===this.q)return this;var b=Kc(this.r),c=Array(0>b?4:2*(b+1));uc(this.d,0,c,0,2*b);return new Ee(a,this.r,c)};n.za=function(a,b){return De(this.d,a,b)};
n.Qa=function(a,b,c){var d=1<<(b>>>a&31);if(0===(this.r&d))return this;var e=Kc(this.r&d-1),g=this.d[2*e],h=this.d[2*e+1];return null==g?(a=h.Qa(a+5,b,c),a===h?this:null!=a?new Ee(null,this.r,Ae.c(this.d,2*e+1,a)):this.r===d?null:w?new Ee(null,this.r^d,Be(this.d,e)):null):ze(c,g)?new Ee(null,this.r^d,Be(this.d,e)):w?this:null};
n.ea=function(a,b,c,d,e){var g=1<<(b>>>a&31),h=Kc(this.r&g-1);if(0===(this.r&g)){var k=Kc(this.r);if(16<=k){h=Array(32);h[b>>>a&31]=Ge.ea(a+5,b,c,d,e);for(d=c=0;;)if(32>c)0!==(this.r>>>c&1)&&(h[c]=null!=this.d[d]?Ge.ea(a+5,C.b(this.d[d]),this.d[d],this.d[d+1],e):this.d[d+1],d+=2),c+=1;else break;return new He(null,k+1,h)}a=Array(2*(k+1));uc(this.d,0,a,0,2*h);a[2*h]=c;a[2*h+1]=d;uc(this.d,2*h,a,2*(h+1),2*(k-h));e.k=!0;return new Ee(null,this.r|g,a)}k=this.d[2*h];g=this.d[2*h+1];return null==k?(k=g.ea(a+
5,b,c,d,e),k===g?this:new Ee(null,this.r,Ae.c(this.d,2*h+1,k))):ze(c,k)?d===g?this:new Ee(null,this.r,Ae.c(this.d,2*h+1,d)):w?(e.k=!0,new Ee(null,this.r,Ae.s(this.d,2*h,null,2*h+1,Ie.da?Ie.da(a+5,k,g,b,c,d):Ie.call(null,a+5,k,g,b,c,d)))):null};n.sa=function(a,b,c,d){var e=1<<(b>>>a&31);if(0===(this.r&e))return d;var g=Kc(this.r&e-1),e=this.d[2*g],g=this.d[2*g+1];return null==e?g.sa(a+5,b,c,d):ze(c,e)?g:w?d:null};var Ge=new Ee(null,0,[]);
function Ke(a,b,c){var d=a.d;a=2*(a.f-1);for(var e=Array(a),g=0,h=1,k=0;;)if(g<a){var l=g!==c;if(l?null!=d[g]:l)e[h]=d[g],h+=2,k|=1<<g;g+=1}else return new Ee(b,k,e)}function He(a,b,c){this.q=a;this.f=b;this.d=c}n=He.prototype;n.fa=function(a,b,c,d,e,g){var h=c>>>b&31,k=this.d[h];if(null==k)return a=Ce.n(this,a,h,Ge.fa(a,b+5,c,d,e,g)),a.f+=1,a;b=k.fa(a,b+5,c,d,e,g);return b===k?this:Ce.n(this,a,h,b)};n.Pa=function(){return Le.b?Le.b(this.d):Le.call(null,this.d)};
n.Ra=function(a,b,c,d,e){var g=c>>>b&31,h=this.d[g];if(null==h)return this;b=h.Ra(a,b+5,c,d,e);if(b===h)return this;if(null==b){if(8>=this.f)return Ke(this,a,g);a=Ce.n(this,a,g,b);a.f-=1;return a}return w?Ce.n(this,a,g,b):null};n.qa=function(a){return a===this.q?this:new He(a,this.f,this.d.slice())};n.za=function(a,b){for(var c=this.d.length,d=0,e=b;;)if(d<c){var g=this.d[d];if(null!=g&&(e=g.za(a,e),Qb(e)))return J.b?J.b(e):J.call(null,e);d+=1}else return e};
n.Qa=function(a,b,c){var d=b>>>a&31,e=this.d[d];return null!=e?(a=e.Qa(a+5,b,c),a===e?this:null==a?8>=this.f?Ke(this,null,d):new He(null,this.f-1,Ae.c(this.d,d,a)):w?new He(null,this.f,Ae.c(this.d,d,a)):null):this};n.ea=function(a,b,c,d,e){var g=b>>>a&31,h=this.d[g];if(null==h)return new He(null,this.f+1,Ae.c(this.d,g,Ge.ea(a+5,b,c,d,e)));a=h.ea(a+5,b,c,d,e);return a===h?this:new He(null,this.f,Ae.c(this.d,g,a))};n.sa=function(a,b,c,d){var e=this.d[b>>>a&31];return null!=e?e.sa(a+5,b,c,d):d};
function Me(a,b,c){b*=2;for(var d=0;;)if(d<b){if(ze(c,a[d]))return d;d+=2}else return-1}function Ne(a,b,c,d){this.q=a;this.ma=b;this.f=c;this.d=d}n=Ne.prototype;
n.fa=function(a,b,c,d,e,g){if(c===this.ma){b=Me(this.d,this.f,d);if(-1===b){if(this.d.length>2*this.f)return a=Ce.da(this,a,2*this.f,d,2*this.f+1,e),g.k=!0,a.f+=1,a;c=this.d.length;b=Array(c+2);uc(this.d,0,b,0,c);b[c]=d;b[c+1]=e;g.k=!0;g=this.f+1;a===this.q?(this.d=b,this.f=g,a=this):a=new Ne(this.q,this.ma,g,b);return a}return this.d[b+1]===e?this:Ce.n(this,a,b+1,e)}return(new Ee(a,1<<(this.ma>>>b&31),[null,this,null,null])).fa(a,b,c,d,e,g)};
n.Pa=function(){return Je.b?Je.b(this.d):Je.call(null,this.d)};n.Ra=function(a,b,c,d,e){b=Me(this.d,this.f,d);if(-1===b)return this;e[0]=!0;if(1===this.f)return null;a=this.qa(a);e=a.d;e[b]=e[2*this.f-2];e[b+1]=e[2*this.f-1];e[2*this.f-1]=null;e[2*this.f-2]=null;a.f-=1;return a};n.qa=function(a){if(a===this.q)return this;var b=Array(2*(this.f+1));uc(this.d,0,b,0,2*this.f);return new Ne(a,this.ma,this.f,b)};n.za=function(a,b){return De(this.d,a,b)};
n.Qa=function(a,b,c){a=Me(this.d,this.f,c);return-1===a?this:1===this.f?null:w?new Ne(null,this.ma,this.f-1,Be(this.d,Jc(a))):null};n.ea=function(a,b,c,d,e){return b===this.ma?(a=Me(this.d,this.f,c),-1===a?(a=this.d.length,b=Array(a+2),uc(this.d,0,b,0,a),b[a]=c,b[a+1]=d,e.k=!0,new Ne(null,this.ma,this.f+1,b)):Ob.a(this.d[a],d)?this:new Ne(null,this.ma,this.f,Ae.c(this.d,a+1,d))):(new Ee(null,1<<(this.ma>>>a&31),[null,this])).ea(a,b,c,d,e)};
n.sa=function(a,b,c,d){a=Me(this.d,this.f,c);return 0>a?d:ze(c,this.d[a])?this.d[a+1]:w?d:null};
var Ie=function(){function a(a,b,c,h,k,l,q){var s=C.b(c);if(s===k)return new Ne(null,s,2,[c,h,l,q]);var u=new ye;return Ge.fa(a,b,s,c,h,u).fa(a,b,k,l,q,u)}function b(a,b,c,h,k,l){var q=C.b(b);if(q===h)return new Ne(null,q,2,[b,c,k,l]);var s=new ye;return Ge.ea(a,q,b,c,s).ea(a,h,k,l,s)}var c=null,c=function(c,e,g,h,k,l,q){switch(arguments.length){case 6:return b.call(this,c,e,g,h,k,l);case 7:return a.call(this,c,e,g,h,k,l,q)}throw Error("Invalid arity: "+arguments.length);};c.da=b;c.Ca=a;return c}();
function Oe(a,b,c,d,e){this.i=a;this.ha=b;this.m=c;this.A=d;this.l=e;this.p=0;this.h=32374860}n=Oe.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};n.t=aa();n.Q=function(){return null==this.A?X([this.ha[this.m],this.ha[this.m+1]]):E(this.A)};
n.S=function(){return null==this.A?Je.c?Je.c(this.ha,this.m+2,null):Je.call(null,this.ha,this.m+2,null):Je.c?Je.c(this.ha,this.m,H(this.A)):Je.call(null,this.ha,this.m,H(this.A))};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return new Oe(b,this.ha,this.m,this.A,this.l)};n.C=f("i");n.H=function(){return N(G,this.i)};
var Je=function(){function a(a,b,c){if(null==c)for(c=a.length;;)if(b<c){if(null!=a[b])return new Oe(null,a,b,null,null);var h=a[b+1];if(t(h)&&(h=h.Pa(),t(h)))return new Oe(null,a,b+2,h,null);b+=2}else return null;else return new Oe(null,a,b,c,null)}function b(a){return c.c(a,0,null)}var c=null,c=function(c,e,g){switch(arguments.length){case 1:return b.call(this,c);case 3:return a.call(this,c,e,g)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.c=a;return c}();
function Pe(a,b,c,d,e){this.i=a;this.ha=b;this.m=c;this.A=d;this.l=e;this.p=0;this.h=32374860}n=Pe.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};n.t=aa();n.Q=function(){return E(this.A)};n.S=function(){return Le.n?Le.n(null,this.ha,this.m,H(this.A)):Le.call(null,null,this.ha,this.m,H(this.A))};n.u=function(a,b){return Yb(a,b)};
n.D=function(a,b){return new Pe(b,this.ha,this.m,this.A,this.l)};n.C=f("i");n.H=function(){return N(G,this.i)};
var Le=function(){function a(a,b,c,h){if(null==h)for(h=b.length;;)if(c<h){var k=b[c];if(t(k)&&(k=k.Pa(),t(k)))return new Pe(a,b,c+1,k,null);c+=1}else return null;else return new Pe(a,b,c,h,null)}function b(a){return c.n(null,a,0,null)}var c=null,c=function(c,e,g,h){switch(arguments.length){case 1:return b.call(this,c);case 4:return a.call(this,c,e,g,h)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.n=a;return c}();
function Qe(a,b,c,d,e,g){this.i=a;this.f=b;this.root=c;this.T=d;this.X=e;this.l=g;this.p=4;this.h=16123663}n=Qe.prototype;n.Ia=function(){return new Re({},this.root,this.f,this.T,this.X)};n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Mc(a)};n.M=function(a,b){return a.v(a,b,null)};n.v=function(a,b,c){return null==b?this.T?this.X:c:null==this.root?c:w?this.root.sa(0,C.b(b),b,c):null};
n.Z=function(a,b,c){if(null==b){var d=this.T;return(d?c===this.X:d)?a:new Qe(this.i,this.T?this.f:this.f+1,this.root,!0,c,null)}d=new ye;c=(null==this.root?Ge:this.root).ea(0,C.b(b),b,c,d);return c===this.root?a:new Qe(this.i,d.k?this.f+1:this.f,c,this.T,this.X,null)};n.Ua=function(a,b){return null==b?this.T:null==this.root?!1:w?this.root.sa(0,C.b(b),b,wc)!==wc:null};
n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.M(this,c);case 3:return this.v(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.Ja=function(a,b,c){a=this.T?b.c?b.c(c,null,this.X):b.call(null,c,null,this.X):c;return Qb(a)?J.b?J.b(a):J.call(null,a):null!=this.root?this.root.za(b,a):w?a:null};n.F=function(a,b){return rc(b)?a.Z(a,B.a(b,0),B.a(b,1)):z.c(ya,a,b)};
n.toString=function(){return Fb(this)};n.t=function(){if(0<this.f){var a=null!=this.root?this.root.Pa():null;return this.T?K(X([null,this.X]),a):a}return null};n.G=f("f");n.u=function(a,b){return pe(a,b)};n.D=function(a,b){return new Qe(b,this.f,this.root,this.T,this.X,this.l)};n.C=f("i");n.H=function(){return Za(ve,this.i)};
n.Xa=function(a,b){if(null==b)return this.T?new Qe(this.i,this.f-1,this.root,!1,null,null):a;if(null==this.root)return a;if(w){var c=this.root.Qa(0,C.b(b),b);return c===this.root?a:new Qe(this.i,this.f-1,c,this.T,this.X,null)}return null};var ve=new Qe(null,0,null,!1,null,0);function Re(a,b,c,d,e){this.q=a;this.root=b;this.count=c;this.T=d;this.X=e;this.p=56;this.h=258}n=Re.prototype;
n.xb=function(a,b){if(a.q)if(null==b)a.T&&(a.T=!1,a.X=null,a.count-=1);else{if(null!=a.root){var c=new ye,d=a.root.Ra(a.q,0,C.b(b),b,c);d!==a.root&&(a.root=d);t(c[0])&&(a.count-=1)}}else throw Error("dissoc! after persistent!");return a};n.Da=function(a,b,c){return Se(a,b,c)};
n.pa=function(a,b){var c;a:{if(a.q){c=b?((c=b.h&2048)?c:b.Ub)?!0:b.h?!1:v(Ma,b):v(Ma,b);if(c){c=Se(a,Nc.b?Nc.b(b):Nc.call(null,b),Oc.b?Oc.b(b):Oc.call(null,b));break a}c=D(b);for(var d=a;;){var e=E(c);if(t(e))c=H(c),d=Se(d,Nc.b?Nc.b(e):Nc.call(null,e),Oc.b?Oc.b(e):Oc.call(null,e));else{c=d;break a}}}else throw Error("conj! after persistent");c=void 0}return c};n.wa=function(a){if(a.q)a.q=null,a=new Qe(null,a.count,a.root,a.T,a.X,null);else throw Error("persistent! called twice");return a};
n.M=function(a,b){return null==b?this.T?this.X:null:null==this.root?null:this.root.sa(0,C.b(b),b)};n.v=function(a,b,c){return null==b?this.T?this.X:c:null==this.root?c:this.root.sa(0,C.b(b),b,c)};n.G=function(){if(this.q)return this.count;throw Error("count after persistent!");};
function Se(a,b,c){if(a.q){if(null==b)a.X!==c&&(a.X=c),a.T||(a.count+=1,a.T=!0);else{var d=new ye;b=(null==a.root?Ge:a.root).fa(a.q,0,C.b(b),b,c,d);b!==a.root&&(a.root=b);d.k&&(a.count+=1)}return a}throw Error("assoc! after persistent!");}function Te(a,b,c){for(var d=b;;)if(null!=a)b=c?a.left:a.right,d=ac.a(d,a),a=b;else return d}function Ue(a,b,c,d,e){this.i=a;this.stack=b;this.Ta=c;this.f=d;this.l=e;this.p=0;this.h=32374862}n=Ue.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};
n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};n.t=aa();n.G=function(a){return 0>this.f?O(H(a))+1:this.f};n.Q=function(){return Ra(this.stack)};n.S=function(){var a=E(this.stack),a=Te(this.Ta?a.right:a.left,H(this.stack),this.Ta);return null!=a?new Ue(null,a,this.Ta,this.f-1,null):G};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return new Ue(b,this.stack,this.Ta,this.f,this.l)};n.C=f("i");
n.H=function(){return N(G,this.i)};function Ve(a,b,c,d){return c instanceof Y?c.left instanceof Y?new Y(c.key,c.k,c.left.la(),new Z(a,b,c.right,d,null),null):c.right instanceof Y?new Y(c.right.key,c.right.k,new Z(c.key,c.k,c.left,c.right.left,null),new Z(a,b,c.right.right,d,null),null):w?new Z(a,b,c,d,null):null:new Z(a,b,c,d,null)}
function We(a,b,c,d){return d instanceof Y?d.right instanceof Y?new Y(d.key,d.k,new Z(a,b,c,d.left,null),d.right.la(),null):d.left instanceof Y?new Y(d.left.key,d.left.k,new Z(a,b,c,d.left.left,null),new Z(d.key,d.k,d.left.right,d.right,null),null):w?new Z(a,b,c,d,null):null:new Z(a,b,c,d,null)}
function Xe(a,b,c,d){if(c instanceof Y)return new Y(a,b,c.la(),d,null);if(d instanceof Z)return We(a,b,c,d.Sa());var e=d instanceof Y;if(e?d.left instanceof Z:e)return new Y(d.left.key,d.left.k,new Z(a,b,c,d.left.left,null),We(d.key,d.k,d.left.right,d.right.Sa()),null);if(w)throw Error("red-black tree invariant violation");return null}
function Ye(a,b,c,d){if(d instanceof Y)return new Y(a,b,c,d.la(),null);if(c instanceof Z)return Ve(a,b,c.Sa(),d);var e=c instanceof Y;if(e?c.right instanceof Z:e)return new Y(c.right.key,c.right.k,Ve(c.key,c.k,c.left.Sa(),c.right.left),new Z(a,b,c.right.right,d,null),null);if(w)throw Error("red-black tree invariant violation");return null}
var $e=function Ze(b,c,d){d=null!=b.left?Ze(b.left,c,d):d;if(Qb(d))return J.b?J.b(d):J.call(null,d);d=c.c?c.c(d,b.key,b.k):c.call(null,d,b.key,b.k);if(Qb(d))return J.b?J.b(d):J.call(null,d);b=null!=b.right?Ze(b.right,c,d):d;return Qb(b)?J.b?J.b(b):J.call(null,b):b};function Z(a,b,c,d,e){this.key=a;this.k=b;this.left=c;this.right=d;this.l=e;this.p=0;this.h=32402207}n=Z.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.M=function(a,b){return a.P(a,b,null)};
n.v=function(a,b,c){return a.P(a,b,c)};n.Z=function(a,b,c){return S.c(X([this.key,this.k]),b,c)};n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.M(this,c);case 3:return this.v(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.F=function(a,b){return X([this.key,this.k,b])};n.Ka=f("key");n.La=f("k");n.Cb=function(a){return a.Eb(this)};
n.Sa=function(){return new Y(this.key,this.k,this.left,this.right,null)};n.replace=function(a,b,c,d){return new Z(a,b,c,d,null)};n.za=function(a,b){return $e(this,a,b)};n.Bb=function(a){return a.Db(this)};n.Db=function(a){return new Z(a.key,a.k,this,a.right,null)};n.Eb=function(a){return new Z(a.key,a.k,a.left,this,null)};n.la=function(){return this};n.N=function(a,b){return Rb.a(a,b)};n.J=function(a,b,c){return Rb.c(a,b,c)};n.t=function(){return Xb.e(I([this.key,this.k],0))};n.G=m(2);n.ua=f("k");
n.va=function(){return X([this.key])};n.Oa=function(a,b,c){return Ua(X([this.key,this.k]),b,c)};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return N(X([this.key,this.k]),b)};n.C=m(null);n.L=function(a,b){return 0===b?this.key:1===b?this.k:null};n.P=function(a,b,c){return 0===b?this.key:1===b?this.k:w?c:null};n.H=function(){return Zd};function Y(a,b,c,d,e){this.key=a;this.k=b;this.left=c;this.right=d;this.l=e;this.p=0;this.h=32402207}n=Y.prototype;
n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};n.M=function(a,b){return a.P(a,b,null)};n.v=function(a,b,c){return a.P(a,b,c)};n.Z=function(a,b,c){return S.c(X([this.key,this.k]),b,c)};n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.M(this,c);case 3:return this.v(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};
n.F=function(a,b){return X([this.key,this.k,b])};n.Ka=f("key");n.La=f("k");n.Cb=function(a){return new Y(this.key,this.k,this.left,a,null)};n.Sa=function(){throw Error("red-black tree invariant violation");};n.replace=function(a,b,c,d){return new Y(a,b,c,d,null)};n.za=function(a,b){return $e(this,a,b)};n.Bb=function(a){return new Y(this.key,this.k,a,this.right,null)};
n.Db=function(a){return this.left instanceof Y?new Y(this.key,this.k,this.left.la(),new Z(a.key,a.k,this.right,a.right,null),null):this.right instanceof Y?new Y(this.right.key,this.right.k,new Z(this.key,this.k,this.left,this.right.left,null),new Z(a.key,a.k,this.right.right,a.right,null),null):w?new Z(a.key,a.k,this,a.right,null):null};
n.Eb=function(a){return this.right instanceof Y?new Y(this.key,this.k,new Z(a.key,a.k,a.left,this.left,null),this.right.la(),null):this.left instanceof Y?new Y(this.left.key,this.left.k,new Z(a.key,a.k,a.left,this.left.left,null),new Z(this.key,this.k,this.left.right,this.right,null),null):w?new Z(a.key,a.k,a.left,this,null):null};n.la=function(){return new Z(this.key,this.k,this.left,this.right,null)};n.N=function(a,b){return Rb.a(a,b)};n.J=function(a,b,c){return Rb.c(a,b,c)};
n.t=function(){return Xb.e(I([this.key,this.k],0))};n.G=m(2);n.ua=f("k");n.va=function(){return X([this.key])};n.Oa=function(a,b,c){return Ua(X([this.key,this.k]),b,c)};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return N(X([this.key,this.k]),b)};n.C=m(null);n.L=function(a,b){return 0===b?this.key:1===b?this.k:null};n.P=function(a,b,c){return 0===b?this.key:1===b?this.k:w?c:null};n.H=function(){return Zd};
var bf=function af(b,c,d,e,g){if(null==c)return new Y(d,e,null,null,null);var h=b.a?b.a(d,c.key):b.call(null,d,c.key);return 0===h?(g[0]=c,null):0>h?(b=af(b,c.left,d,e,g),null!=b?c.Bb(b):null):w?(b=af(b,c.right,d,e,g),null!=b?c.Cb(b):null):null},df=function cf(b,c){if(null==b)return c;if(null==c)return b;if(b instanceof Y){if(c instanceof Y){var d=cf(b.right,c.left);return d instanceof Y?new Y(d.key,d.k,new Y(b.key,b.k,b.left,d.left,null),new Y(c.key,c.k,d.right,c.right,null),null):new Y(b.key,b.k,
b.left,new Y(c.key,c.k,d,c.right,null),null)}return new Y(b.key,b.k,b.left,cf(b.right,c),null)}return c instanceof Y?new Y(c.key,c.k,cf(b,c.left),c.right,null):w?(d=cf(b.right,c.left),d instanceof Y?new Y(d.key,d.k,new Z(b.key,b.k,b.left,d.left,null),new Z(c.key,c.k,d.right,c.right,null),null):Xe(b.key,b.k,b.left,new Z(c.key,c.k,d,c.right,null))):null},ff=function ef(b,c,d,e){if(null!=c){var g=b.a?b.a(d,c.key):b.call(null,d,c.key);if(0===g)return e[0]=c,df(c.left,c.right);if(0>g){var h=ef(b,c.left,
d,e);return function(){var b=null!=h;return b?b:null!=e[0]}()?c.left instanceof Z?Xe(c.key,c.k,h,c.right):new Y(c.key,c.k,h,c.right,null):null}if(w)return h=ef(b,c.right,d,e),function(){var b=null!=h;return b?b:null!=e[0]}()?c.right instanceof Z?Ye(c.key,c.k,c.left,h):new Y(c.key,c.k,c.left,h,null):null}return null},hf=function gf(b,c,d,e){var g=c.key,h=b.a?b.a(d,g):b.call(null,d,g);return 0===h?c.replace(g,e,c.left,c.right):0>h?c.replace(g,c.k,gf(b,c.left,d,e),c.right):w?c.replace(g,c.k,c.left,gf(b,
c.right,d,e)):null};function jf(a,b,c,d,e){this.Y=a;this.ia=b;this.f=c;this.i=d;this.l=e;this.p=0;this.h=418776847}n=jf.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Mc(a)};n.M=function(a,b){return a.v(a,b,null)};n.v=function(a,b,c){a=kf(a,b);return null!=a?a.k:c};n.Z=function(a,b,c){var d=[null],e=bf(this.Y,this.ia,b,c,d);return null==e?(d=Q.a(d,0),Ob.a(c,d.k)?a:new jf(this.Y,hf(this.Y,this.ia,b,c),this.f,this.i,null)):new jf(this.Y,e.la(),this.f+1,this.i,null)};
n.Ua=function(a,b){return null!=kf(a,b)};n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.M(this,c);case 3:return this.v(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.Ja=function(a,b,c){return null!=this.ia?$e(this.ia,b,c):c};n.F=function(a,b){return rc(b)?a.Z(a,B.a(b,0),B.a(b,1)):z.c(ya,a,b)};
n.Ma=function(){return 0<this.f?new Ue(null,Te(this.ia,null,!1),!1,this.f,null):null};function kf(a,b){for(var c=a.ia;;)if(null!=c){var d=a.Y.a?a.Y.a(b,c.key):a.Y.call(null,b,c.key);if(0===d)return c;if(0>d)c=c.left;else if(w)c=c.right;else return null}else return null}n.vb=function(a,b){return 0<this.f?new Ue(null,Te(this.ia,null,b),b,this.f,null):null};
n.wb=function(a,b,c){if(0<this.f){a=null;for(var d=this.ia;;)if(null!=d){var e=this.Y.a?this.Y.a(b,d.key):this.Y.call(null,b,d.key);if(0===e)return new Ue(null,ac.a(a,d),c,-1,null);if(t(c))0>e?(a=ac.a(a,d),d=d.left):d=d.right;else if(w)0<e?(a=ac.a(a,d),d=d.right):d=d.left;else return null}else return null==a?null:new Ue(null,a,c,-1,null)}else return null};n.ub=function(a,b){return Nc.b?Nc.b(b):Nc.call(null,b)};n.tb=f("Y");
n.t=function(){return 0<this.f?new Ue(null,Te(this.ia,null,!0),!0,this.f,null):null};n.G=f("f");n.u=function(a,b){return pe(a,b)};n.D=function(a,b){return new jf(this.Y,this.ia,this.f,b,this.l)};n.C=f("i");n.H=function(){return N(lf,this.i)};n.Xa=function(a,b){var c=[null],d=ff(this.Y,this.ia,b,c);return null==d?null==Q.a(c,0)?a:new jf(this.Y,null,0,this.i,null):new jf(this.Y,d.la(),this.f-1,this.i,null)};
var lf=new jf(Ac,null,0,null,0),cc=function(){function a(a){var d=null;0<arguments.length&&(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){a=D(a);for(var b=ub(ve);;)if(a){var e=H(H(a)),b=id(b,E(a),E(H(a)));a=e}else return wb(b)}a.j=0;a.g=function(a){a=D(a);return b(a)};a.e=b;return a}(),mf=function(){function a(a){var d=null;0<arguments.length&&(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return new se(null,Jc(O(a)),T.a(qa,
a),null)}a.j=0;a.g=function(a){a=D(a);return b(a)};a.e=b;return a}(),nf=function(){function a(a){var d=null;0<arguments.length&&(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){a=D(a);for(var b=lf;;)if(a){var e=H(H(a)),b=S.c(b,E(a),E(H(a)));a=e}else return b}a.j=0;a.g=function(a){a=D(a);return b(a)};a.e=b;return a}(),of=function(){function a(a,d){var e=null;1<arguments.length&&(e=I(Array.prototype.slice.call(arguments,1),0));return b.call(this,a,e)}function b(a,
b){for(var e=D(b),g=new jf(Cc(a),null,0,null,0);;)if(e)var h=H(H(e)),g=S.c(g,E(e),E(H(e))),e=h;else return g}a.j=1;a.g=function(a){var d=E(a);a=F(a);return b(d,a)};a.e=b;return a}();function pf(a,b){this.O=a;this.W=b;this.p=0;this.h=32374988}n=pf.prototype;n.B=function(a){return Vb(a)};n.V=function(){var a=this.O;if(a)var b=a.h&128,a=(b?b:a.Ya)?!0:a.h?!1:v(Da,a);else a=v(Da,a);a=a?this.O.V(this.O):H(this.O);return null==a?null:new pf(a,this.W)};n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};
n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};n.t=aa();n.Q=function(){var a=this.O.Q(this.O);return a.Ka(a)};n.S=function(){var a=this.O;if(a)var b=a.h&128,a=(b?b:a.Ya)?!0:a.h?!1:v(Da,a);else a=v(Da,a);a=a?this.O.V(this.O):H(this.O);return null!=a?new pf(a,this.W):G};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return new pf(this.O,b)};n.C=f("W");n.H=function(){return N(G,this.W)};function qf(a){return(a=D(a))?new pf(a,null):null}function Nc(a){return Na(a)}
function rf(a,b){this.O=a;this.W=b;this.p=0;this.h=32374988}n=rf.prototype;n.B=function(a){return Vb(a)};n.V=function(){var a=this.O;if(a)var b=a.h&128,a=(b?b:a.Ya)?!0:a.h?!1:v(Da,a);else a=v(Da,a);a=a?this.O.V(this.O):H(this.O);return null==a?null:new rf(a,this.W)};n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};n.N=function(a,b){return M.a(b,a)};n.J=function(a,b,c){return M.c(b,c,a)};n.t=aa();n.Q=function(){var a=this.O.Q(this.O);return a.La(a)};
n.S=function(){var a=this.O;if(a)var b=a.h&128,a=(b?b:a.Ya)?!0:a.h?!1:v(Da,a);else a=v(Da,a);a=a?this.O.V(this.O):H(this.O);return null!=a?new rf(a,this.W):G};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return new rf(this.O,b)};n.C=f("W");n.H=function(){return N(G,this.W)};function Oc(a){return Oa(a)}function sf(a,b,c){this.i=a;this.ya=b;this.l=c;this.p=4;this.h=15077647}n=sf.prototype;n.Ia=function(){return new tf(ub(this.ya))};n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Pc(a)};
n.M=function(a,b){return a.v(a,b,null)};n.v=function(a,b,c){return t(Ia(this.ya,b))?b:c};n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.M(this,c);case 3:return this.v(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.F=function(a,b){return new sf(this.i,S.c(this.ya,b,null),null)};n.toString=function(){return Fb(this)};n.t=function(){return qf(this.ya)};
n.sb=function(a,b){return new sf(this.i,La(this.ya,b),null)};n.G=function(){return va(this.ya)};n.u=function(a,b){var c=nc(b);return c?(c=O(a)===O(b))?kd(function(b){return zc(a,b)},b):c:c};n.D=function(a,b){return new sf(b,this.ya,this.l)};n.C=f("i");n.H=function(){return N(uf,this.i)};var uf=new sf(null,we,0);function tf(a){this.oa=a;this.h=259;this.p=136}n=tf.prototype;
n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return Fa.c(this.oa,c,wc)===wc?null:c;case 3:return Fa.c(this.oa,c,wc)===wc?d:c}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.M=function(a,b){return a.v(a,b,null)};n.v=function(a,b,c){return Fa.c(this.oa,b,wc)===wc?c:b};n.G=function(){return O(this.oa)};n.Lb=function(a,b){this.oa=yb(this.oa,b);return a};
n.pa=function(a,b){this.oa=xb(this.oa,b,null);return a};n.wa=function(){return new sf(null,wb(this.oa),null)};function vf(a,b,c){this.i=a;this.ka=b;this.l=c;this.p=0;this.h=417730831}n=vf.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Pc(a)};n.M=function(a,b){return a.v(a,b,null)};n.v=function(a,b,c){a=kf(this.ka,b);return null!=a?a.key:c};
n.call=function(){var a=null;return a=function(a,c,d){switch(arguments.length){case 2:return this.M(this,c);case 3:return this.v(this,c,d)}throw Error("Invalid arity: "+arguments.length);}}();n.apply=function(a,b){a=this;return a.call.apply(a,[a].concat(b.slice()))};n.F=function(a,b){return new vf(this.i,S.c(this.ka,b,null),null)};n.Ma=function(){return qd.a(Nc,kb(this.ka))};n.toString=function(){return Fb(this)};n.vb=function(a,b){return qd.a(Nc,lb(this.ka,b))};
n.wb=function(a,b,c){return qd.a(Nc,mb(this.ka,b,c))};n.ub=function(a,b){return b};n.tb=function(){return ob(this.ka)};n.t=function(){return qf(this.ka)};n.sb=function(a,b){return new vf(this.i,dc.a(this.ka,b),null)};n.G=function(){return O(this.ka)};n.u=function(a,b){var c=nc(b);return c?(c=O(a)===O(b))?kd(function(b){return zc(a,b)},b):c:c};n.D=function(a,b){return new vf(b,this.ka,this.l)};n.C=f("i");n.H=function(){return N(wf,this.i)};
var wf=new vf(null,lf,0),xf=function(){function a(a){var d=null;0<arguments.length&&(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return z.c(ya,wf,a)}a.j=0;a.g=function(a){a=D(a);return b(a)};a.e=b;return a}(),yf=function(){function a(a,d){var e=null;1<arguments.length&&(e=I(Array.prototype.slice.call(arguments,1),0));return b.call(this,a,e)}function b(a,b){return z.c(ya,new vf(null,of(a),0),b)}a.j=1;a.g=function(a){var d=E(a);a=F(a);return b(d,a)};a.e=b;return a}();
function zf(a){for(var b=Zd;;)if(H(a))b=ac.a(b,E(a)),a=H(a);else return D(b)}function Vc(a){var b;b=a?((b=a.p&4096)?b:a.oc)?!0:!1:!1;if(b)return a.name;if("string"===typeof a)return a;throw Error([y("Doesn't support name: "),y(a)].join(""));}
var Af=function(){function a(a,b,c){return(a.b?a.b(b):a.call(null,b))>(a.b?a.b(c):a.call(null,c))?b:c}var b=null,c=function(){function a(b,d,k,l){var q=null;3<arguments.length&&(q=I(Array.prototype.slice.call(arguments,3),0));return c.call(this,b,d,k,q)}function c(a,d,e,l){return z.c(function(c,d){return b.c(a,c,d)},b.c(a,d,e),l)}a.j=3;a.g=function(a){var b=E(a);a=H(a);var d=E(a);a=H(a);var l=E(a);a=F(a);return c(b,d,l,a)};a.e=c;return a}(),b=function(b,e,g,h){switch(arguments.length){case 2:return e;
case 3:return a.call(this,b,e,g);default:return c.e(b,e,g,I(arguments,3))}throw Error("Invalid arity: "+arguments.length);};b.j=3;b.g=c.g;b.a=function(a,b){return b};b.c=a;b.e=c.e;return b}(),Cf=function Bf(b,c){return new V(null,function(){var d=D(c);return d?t(b.b?b.b(E(d)):b.call(null,E(d)))?K(E(d),Bf(b,F(d))):null:null},null,null)};
function Df(a,b,c){return function(d){var e=ob(a);return b.a?b.a(e.a?e.a(nb(a,d),c):e.call(null,nb(a,d),c),0):b.call(null,e.a?e.a(nb(a,d),c):e.call(null,nb(a,d),c),0)}}
var Ef=function(){function a(a,b,c,h,k){var l=mb(a,c,!0);if(t(l)){var q=Q.c(l,0,null);return Cf(Df(a,h,k),t(Df(a,b,c).call(null,q))?l:H(l))}return null}function b(a,b,c){var h=Df(a,b,c),k;a:{k=[Gc,null,Hc,null];var l=k.length;if(l/2<=ue)k=new sf(null,Gb.a?Gb.a(k,!0):Gb.call(null,k,!0),null);else{for(var q=0,s=ub(uf);;)if(q<l)var u=q+2,s=vb(s,k[q]),q=u;else{k=wb(s);break a}k=void 0}}return t(k.call(null,b))?(a=mb(a,c,!0),t(a)?(b=Q.c(a,0,null),t(h.b?h.b(b):h.call(null,b))?a:H(a)):null):Cf(h,lb(a,!0))}
var c=null,c=function(c,e,g,h,k){switch(arguments.length){case 3:return b.call(this,c,e,g);case 5:return a.call(this,c,e,g,h,k)}throw Error("Invalid arity: "+arguments.length);};c.c=b;c.s=a;return c}();function Ff(a,b,c,d,e){this.i=a;this.start=b;this.end=c;this.step=d;this.l=e;this.p=0;this.h=32375006}n=Ff.prototype;n.B=function(a){var b=this.l;return null!=b?b:this.l=a=Vb(a)};
n.V=function(){return 0<this.step?this.start+this.step<this.end?new Ff(this.i,this.start+this.step,this.end,this.step,null):null:this.start+this.step>this.end?new Ff(this.i,this.start+this.step,this.end,this.step,null):null};n.F=function(a,b){return K(b,a)};n.toString=function(){return Fb(this)};n.N=function(a,b){return Rb.a(a,b)};n.J=function(a,b,c){return Rb.c(a,b,c)};n.t=function(a){return 0<this.step?this.start<this.end?a:null:this.start>this.end?a:null};
n.G=function(a){return na(a.t(a))?0:Math.ceil((this.end-this.start)/this.step)};n.Q=f("start");n.S=function(a){return null!=a.t(a)?new Ff(this.i,this.start+this.step,this.end,this.step,null):G};n.u=function(a,b){return Yb(a,b)};n.D=function(a,b){return new Ff(b,this.start,this.end,this.step,this.l)};n.C=f("i");n.L=function(a,b){if(b<a.G(a))return this.start+b*this.step;var c=this.start>this.end;if(c?0===this.step:c)return this.start;throw Error("Index out of bounds");};
n.P=function(a,b,c){c=b<a.G(a)?this.start+b*this.step:((a=this.start>this.end)?0===this.step:a)?this.start:c;return c};n.H=function(){return N(G,this.i)};
var Gf=function(){function a(a,b,c){return new Ff(null,a,b,c,null)}function b(a,b){return e.c(a,b,1)}function c(a){return e.c(0,a,1)}function d(){return e.c(0,Number.MAX_VALUE,1)}var e=null,e=function(e,h,k){switch(arguments.length){case 0:return d.call(this);case 1:return c.call(this,e);case 2:return b.call(this,e,h);case 3:return a.call(this,e,h,k)}throw Error("Invalid arity: "+arguments.length);};e.o=d;e.b=c;e.a=b;e.c=a;return e}(),Hf=function(){function a(a,b){for(;;){var c=D(b);if(t(c?0<a:c)){var c=
a-1,h=H(b);a=c;b=h}else return null}}function b(a){for(;;)if(D(a))a=H(a);else return null}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),If=function(){function a(a,b){Hf.a(a,b);return b}function b(a){Hf.b(a);return a}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);
};c.b=b;c.a=a;return c}();function $(a,b,c,d,e,g,h){pb(a,c);D(h)&&(b.c?b.c(E(h),a,g):b.call(null,E(h),a,g));c=D(H(h));h=null;for(var k=0,l=0;;)if(l<k){var q=h.L(h,l);pb(a,d);b.c?b.c(q,a,g):b.call(null,q,a,g);l+=1}else if(c=D(c))h=c,sc(h)?(c=Cb(h),l=Db(h),h=c,k=O(c),c=l):(c=E(h),pb(a,d),b.c?b.c(c,a,g):b.call(null,c,a,g),c=H(h),h=null,k=0),l=0;else break;return pb(a,e)}
var Jf=function(){function a(a,d){var e=null;1<arguments.length&&(e=I(Array.prototype.slice.call(arguments,1),0));return b.call(this,a,e)}function b(a,b){for(var e=D(b),g=null,h=0,k=0;;)if(k<h){var l=g.L(g,k);pb(a,l);k+=1}else if(e=D(e))g=e,sc(g)?(e=Cb(g),h=Db(g),g=e,l=O(e),e=h,h=l):(l=E(g),pb(a,l),e=H(g),g=null,h=0),k=0;else return null}a.j=1;a.g=function(a){var d=E(a);a=F(a);return b(d,a)};a.e=b;return a}(),Kf={'"':'\\"',"\\":"\\\\","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t"};
function Lf(a){return[y('"'),y(a.replace(RegExp('[\\\\"\b\f\n\r\t]',"g"),function(a){return Kf[a]})),y('"')].join("")}
var Nf=function Mf(b,c,d){if(null==b)return pb(c,"nil");if(void 0===b)return pb(c,"#\x3cundefined\x3e");if(w){t(function(){var c=R.a(d,Jb);return t(c)?(c=b?((c=b.h&131072)?c:b.Vb)?!0:b.h?!1:v(Wa,b):v(Wa,b),t(c)?hc(b):c):c}())&&(pb(c,"^"),Mf(hc(b),c,d),pb(c," "));if(null==b)return pb(c,"nil");if(b.$a)return b.yb(b,c,d);if(function(){var c;c=b?((c=b.h&2147483648)?c:b.I)?!0:!1:!1;return c}())return b.w(b,c,d);if(function(){var c=oa(b)===Boolean;return c?c:"number"===typeof b}())return pb(c,""+y(b));
if(b instanceof Array)return $(c,Mf,"#\x3cArray [",", ","]\x3e",d,b);if("string"==typeof b)return t(Ib.call(null,d))?pb(c,Lf(b)):pb(c,b);if(ec(b))return Jf.e(c,I(["#\x3c",""+y(b),"\x3e"],0));if(b instanceof Date){var e=function(b,c){for(var d=""+y(b);;)if(O(d)<c)d=[y("0"),y(d)].join("");else return d};return Jf.e(c,I(['#inst "',""+y(b.getUTCFullYear()),"-",e(b.getUTCMonth()+1,2),"-",e(b.getUTCDate(),2),"T",e(b.getUTCHours(),2),":",e(b.getUTCMinutes(),2),":",e(b.getUTCSeconds(),2),".",e(b.getUTCMilliseconds(),
3),"-",'00:00"'],0))}return t(b instanceof RegExp)?Jf.e(c,I(['#"',b.source,'"'],0)):function(){var c;c=b?((c=b.h&2147483648)?c:b.I)?!0:b.h?!1:v(rb,b):v(rb,b);return c}()?sb(b,c,d):w?Jf.e(c,I(["#\x3c",""+y(b),"\x3e"],0)):null}return null},Of=function(){function a(a){var d=null;0<arguments.length&&(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){var b=Gb([Hb,!0,Ib,!0,Jb,!1,Kb,!1],!0);if(lc(a))b="";else{var e=y,g=new ka,h=new Eb(g);a:{Nf(E(a),h,b);a=D(H(a));for(var k=
null,l=0,q=0;;)if(q<l){var s=k.L(k,q);pb(h," ");Nf(s,h,b);q+=1}else if(a=D(a))k=a,sc(k)?(a=Cb(k),l=Db(k),k=a,s=O(a),a=l,l=s):(s=E(k),pb(h," "),Nf(s,h,b),a=H(k),k=null,l=0),q=0;else break a}qb(h);b=""+e(g)}return b}a.j=0;a.g=function(a){a=D(a);return b(a)};a.e=b;return a}();pf.prototype.I=!0;pf.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};Nb.prototype.I=!0;Nb.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};ee.prototype.I=!0;
ee.prototype.w=function(a,b,c){return $(b,Nf,"["," ","]",c,a)};ad.prototype.I=!0;ad.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};jf.prototype.I=!0;jf.prototype.w=function(a,b,c){return $(b,function(a){return $(b,Nf,""," ","",c,a)},"{",", ","}",c,a)};se.prototype.I=!0;se.prototype.w=function(a,b,c){return $(b,function(a){return $(b,Nf,""," ","",c,a)},"{",", ","}",c,a)};V.prototype.I=!0;V.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};Wb.prototype.I=!0;
Wb.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};vf.prototype.I=!0;vf.prototype.w=function(a,b,c){return $(b,Nf,"#{"," ","}",c,a)};Oe.prototype.I=!0;Oe.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};Y.prototype.I=!0;Y.prototype.w=function(a,b,c){return $(b,Nf,"["," ","]",c,a)};ce.prototype.I=!0;ce.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};Qe.prototype.I=!0;
Qe.prototype.w=function(a,b,c){return $(b,function(a){return $(b,Nf,""," ","",c,a)},"{",", ","}",c,a)};sf.prototype.I=!0;sf.prototype.w=function(a,b,c){return $(b,Nf,"#{"," ","}",c,a)};Ud.prototype.I=!0;Ud.prototype.w=function(a,b,c){return $(b,Nf,"["," ","]",c,a)};Qc.prototype.I=!0;Qc.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};re.prototype.I=!0;re.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};Rc.prototype.I=!0;Rc.prototype.w=function(a,b){return pb(b,"()")};
Z.prototype.I=!0;Z.prototype.w=function(a,b,c){return $(b,Nf,"["," ","]",c,a)};Uc.prototype.I=!0;Uc.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};Ff.prototype.I=!0;Ff.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};Pe.prototype.I=!0;Pe.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};rf.prototype.I=!0;rf.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};Ue.prototype.I=!0;Ue.prototype.w=function(a,b,c){return $(b,Nf,"("," ",")",c,a)};Ud.prototype.Hb=!0;
Ud.prototype.Ib=function(a,b){return Bc.a(a,b)};ee.prototype.Hb=!0;ee.prototype.Ib=function(a,b){return Bc.a(a,b)};function Pf(a,b,c,d){this.state=a;this.i=b;this.dc=c;this.ec=d;this.h=2153938944;this.p=2}n=Pf.prototype;n.B=function(a){return a[ca]||(a[ca]=++da)};
n.Nb=function(a,b,c){for(var d=D(this.ec),e=null,g=0,h=0;;)if(h<g){var k=e.L(e,h),l=Q.c(k,0,null),k=Q.c(k,1,null);k.n?k.n(l,a,b,c):k.call(null,l,a,b,c);h+=1}else if(d=D(d))sc(d)?(e=Cb(d),d=Db(d),l=e,g=O(e),e=l):(e=E(d),l=Q.c(e,0,null),k=Q.c(e,1,null),k.n?k.n(l,a,b,c):k.call(null,l,a,b,c),d=H(d),e=null,g=0),h=0;else return null};n.w=function(a,b,c){pb(b,"#\x3cAtom: ");Nf(this.state,b,c);return pb(b,"\x3e")};n.C=f("i");n.eb=f("state");n.u=function(a,b){return a===b};
var Rf=function(){function a(a){return new Pf(a,null,null,null)}var b=null,c=function(){function a(c,d){var k=null;1<arguments.length&&(k=I(Array.prototype.slice.call(arguments,1),0));return b.call(this,c,k)}function b(a,c){var d=xc(c)?T.a(cc,c):c,e=R.a(d,Qf),d=R.a(d,Jb);return new Pf(a,d,e,null)}a.j=1;a.g=function(a){var c=E(a);a=F(a);return b(c,a)};a.e=b;return a}(),b=function(b,e){switch(arguments.length){case 1:return a.call(this,b);default:return c.e(b,I(arguments,1))}throw Error("Invalid arity: "+
arguments.length);};b.j=1;b.g=c.g;b.b=a;b.e=c.e;return b}();function Sf(a,b){var c=a.dc;if(t(c)&&!t(c.b?c.b(b):c.call(null,b)))throw Error([y("Assert failed: "),y("Validator rejected reference state"),y("\n"),y(Of.e(I([Xb(new Lb(null,"validate","validate",1233162959,null),new Lb(null,"new-value","new-value",972165309,null))],0)))].join(""));c=a.state;a.state=b;tb(a,c,b);return b}
var Tf=function(){function a(a,b,c,d,e){return Sf(a,b.n?b.n(a.state,c,d,e):b.call(null,a.state,c,d,e))}function b(a,b,c,d){return Sf(a,b.c?b.c(a.state,c,d):b.call(null,a.state,c,d))}function c(a,b,c){return Sf(a,b.a?b.a(a.state,c):b.call(null,a.state,c))}function d(a,b){return Sf(a,b.b?b.b(a.state):b.call(null,a.state))}var e=null,g=function(){function a(c,d,e,g,h,P){var L=null;5<arguments.length&&(L=I(Array.prototype.slice.call(arguments,5),0));return b.call(this,c,d,e,g,h,L)}function b(a,c,d,e,
g,h){return Sf(a,T.e(c,a.state,d,e,g,I([h],0)))}a.j=5;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=H(a);var e=E(a);a=H(a);var g=E(a);a=H(a);var h=E(a);a=F(a);return b(c,d,e,g,h,a)};a.e=b;return a}(),e=function(e,k,l,q,s,u){switch(arguments.length){case 2:return d.call(this,e,k);case 3:return c.call(this,e,k,l);case 4:return b.call(this,e,k,l,q);case 5:return a.call(this,e,k,l,q,s);default:return g.e(e,k,l,q,s,I(arguments,5))}throw Error("Invalid arity: "+arguments.length);};e.j=5;e.g=g.g;e.a=d;
e.c=c;e.n=b;e.s=a;e.e=g.e;return e}();function J(a){return Va(a)}var Uf={};function Vf(a){if(a?a.Tb:a)return a.Tb(a);var b;b=Vf[p(null==a?null:a)];if(!b&&(b=Vf._,!b))throw x("IEncodeJS.-clj-\x3ejs",a);return b.call(null,a)}function Wf(a){return(a?t(t(null)?null:a.Sb)||(a.zb?0:v(Uf,a)):v(Uf,a))?Vf(a):function(){var b="string"===typeof a;return b||(b="number"===typeof a)?b:(b=a instanceof U)?b:a instanceof Lb}()?Xf.b?Xf.b(a):Xf.call(null,a):Of.e(I([a],0))}
var Xf=function Yf(b){if(null==b)return null;if(b?t(t(null)?null:b.Sb)||(b.zb?0:v(Uf,b)):v(Uf,b))return Vf(b);if(b instanceof U)return Vc(b);if(b instanceof Lb)return""+y(b);if(qc(b)){var c={};b=D(b);for(var d=null,e=0,g=0;;)if(g<e){var h=d.L(d,g),k=Q.c(h,0,null),h=Q.c(h,1,null);c[Wf(k)]=Yf(h);g+=1}else if(b=D(b))sc(b)?(e=Cb(b),b=Db(b),d=e,e=O(e)):(e=E(b),d=Q.c(e,0,null),e=Q.c(e,1,null),c[Wf(d)]=Yf(e),b=H(b),d=null,e=0),g=0;else break;return c}return mc(b)?T.a(qa,qd.a(Yf,b)):w?b:null},Zf={};
function $f(a,b){if(a?a.Rb:a)return a.Rb(a,b);var c;c=$f[p(null==a?null:a)];if(!c&&(c=$f._,!c))throw x("IEncodeClojure.-js-\x3eclj",a);return c.call(null,a,b)}
var bg=function(){function a(a){return b.e(a,I([Gb([ag,!1],!0)],0))}var b=null,c=function(){function a(c,d){var k=null;1<arguments.length&&(k=I(Array.prototype.slice.call(arguments,1),0));return b.call(this,c,k)}function b(a,c){if(a?t(t(null)?null:a.lc)||(a.zb?0:v(Zf,a)):v(Zf,a))return $f(a,T.a(mf,c));if(D(c)){var d=xc(c)?T.a(cc,c):c,e=R.a(d,ag);return function(a,b,c,d){return function L(e){return xc(e)?If.b(qd.a(L,e)):mc(e)?Ed(wa(e),qd.a(L,e)):e instanceof Array?ae(qd.a(L,e)):oa(e)===Object?Ed(we,
function(){return function(a,b,c,d){return function gc(g){return new V(null,function(a,b,c,d){return function(){for(;;){var a=D(g);if(a){if(sc(a)){var b=Cb(a),c=O(b),h=new Yc(Array(c),0);a:{for(var k=0;;)if(k<c){var l=B.a(b,k),l=X([d.b?d.b(l):d.call(null,l),L(e[l])]);h.add(l);k+=1}else{b=!0;break a}b=void 0}return b?bd(h.aa(),gc(Db(a))):bd(h.aa(),null)}h=E(a);return K(X([d.b?d.b(h):d.call(null,h),L(e[h])]),gc(F(a)))}return null}}}(a,b,c,d),null,null)}}(a,b,c,d)(tc(e))}()):w?e:null}}(c,d,e,t(e)?Wc:
y)(a)}return null}a.j=1;a.g=function(a){var c=E(a);a=F(a);return b(c,a)};a.e=b;return a}(),b=function(b,e){switch(arguments.length){case 1:return a.call(this,b);default:return c.e(b,I(arguments,1))}throw Error("Invalid arity: "+arguments.length);};b.j=1;b.g=c.g;b.b=a;b.e=c.e;return b}();var Kb=new U(null,"dup","dup"),cg=new U(null,"r","r"),dg=new U(null,"pnodes","pnodes"),eg=new U(null,"ppath","ppath"),fg=new U("zip","branch?","zip/branch?"),ag=new U(null,"keywordize-keys","keywordize-keys"),gg=new U(null,"changed?","changed?"),Hb=new U(null,"flush-on-newline","flush-on-newline"),hg=new U(null,"end","end"),ig=new U(null,"l","l"),jg=new U("zip","make-node","zip/make-node"),w=new U(null,"else","else"),Ib=new U(null,"readably","readably"),Qf=new U(null,"validator","validator"),Jb=new U(null,
"meta","meta"),kg=new U("zip","children","zip/children");var lg,mg,og=function ng(b,c){"undefined"===typeof lg&&(lg={},lg=function(b,c,g,h){this.ca=b;this.Ea=c;this.bc=g;this.$b=h;this.p=0;this.h=917504},lg.$a=!0,lg.Za="clojure.core.reducers/t5018",lg.yb=function(b,c){return pb(c,"clojure.core.reducers/t5018")},lg.prototype.N=function(b,c){return b.J(b,c,c.o?c.o():c.call(null))},lg.prototype.J=function(b,c,g){return ab.c(this.Ea,this.ca.b?this.ca.b(c):this.ca.call(null,c),g)},lg.prototype.C=f("$b"),lg.prototype.D=function(b,c){return new lg(this.ca,this.Ea,
this.bc,c)});return new lg(c,b,ng,null)},qg=function pg(b,c){"undefined"===typeof mg&&(mg={},mg=function(b,c,g,h){this.ca=b;this.Ea=c;this.Yb=g;this.ac=h;this.p=0;this.h=917504},mg.$a=!0,mg.Za="clojure.core.reducers/t5024",mg.yb=function(b,c){return pb(c,"clojure.core.reducers/t5024")},mg.prototype.N=function(b,c){return ab.c(this.Ea,this.ca.b?this.ca.b(c):this.ca.call(null,c),c.o?c.o():c.call(null))},mg.prototype.J=function(b,c,g){return ab.c(this.Ea,this.ca.b?this.ca.b(c):this.ca.call(null,c),g)},
mg.prototype.C=f("ac"),mg.prototype.D=function(b,c){return new mg(this.ca,this.Ea,this.Yb,c)});return new mg(c,b,pg,null)},rg=function(){function a(a,b){return qg(b,function(b){return function(){var c=null;return c=function(c,e,h){switch(arguments.length){case 0:return b.o?b.o():b.call(null);case 2:return b.a?b.a(c,a.b?a.b(e):a.call(null,e)):b.call(null,c,a.b?a.b(e):a.call(null,e));case 3:return b.a?b.a(c,a.a?a.a(e,h):a.call(null,e,h)):b.call(null,c,a.a?a.a(e,h):a.call(null,e,h))}throw Error("Invalid arity: "+
arguments.length);}}()})}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),sg=function(){function a(a,b){return qg(b,function(b){return function(){var c=null;return c=function(c,e,h){switch(arguments.length){case 0:return b.o?b.o():b.call(null);case 2:return t(a.b?a.b(e):a.call(null,e))?b.a?b.a(c,e):b.call(null,c,
e):c;case 3:return t(a.a?a.a(e,h):a.call(null,e,h))?b.c?b.c(c,e,h):b.call(null,c,e,h):c}throw Error("Invalid arity: "+arguments.length);}}()})}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),tg=function(){function a(a){return qg(a,function(a){return function(){var b=null;return b=function(b,d){switch(arguments.length){case 0:return a.o?
a.o():a.call(null);case 2:return pc(d)?ab.c(c.b(d),a,b):a.a?a.a(b,d):a.call(null,b,d)}throw Error("Invalid arity: "+arguments.length);}}()})}function b(){return function(a){return c.b(a)}}var c=null,c=function(c){switch(arguments.length){case 0:return b.call(this);case 1:return a.call(this,c)}throw Error("Invalid arity: "+arguments.length);};c.o=b;c.b=a;return c}(),ug=function(){function a(a,b){return sg.a(md(a),b)}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,
c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),vg=function(){function a(a,b){return og(b,function(b){return function(){var c=null;return c=function(c,e,h){switch(arguments.length){case 0:return b.o?b.o():b.call(null);case 2:return t(a.b?a.b(e):a.call(null,e))?b.a?b.a(c,e):b.call(null,c,e):new Pb(c);case 3:return t(a.a?a.a(e,h):a.call(null,e,h))?b.c?b.c(c,e,h):b.call(null,c,e,h):new Pb(c)}throw Error("Invalid arity: "+arguments.length);}}()})}
function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),wg=function(){function a(a,b){return og(b,function(b){var c=Rf.b(a);return function(){var a=null;return a=function(a,d,e){switch(arguments.length){case 0:return b.o?b.o():b.call(null);case 2:return Tf.a(c,Ic),0>Va(c)?new Pb(a):b.a?b.a(a,d):b.call(null,a,d);case 3:return Tf.a(c,
Ic),0>Va(c)?new Pb(a):b.c?b.c(a,d,e):b.call(null,a,d,e)}throw Error("Invalid arity: "+arguments.length);}}()})}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}(),xg=function(){function a(a,b){return og(b,function(b){var c=Rf.b(a);return function(){var a=null;return a=function(a,d,e){switch(arguments.length){case 0:return b.o?
b.o():b.call(null);case 2:return Tf.a(c,Ic),0>Va(c)?b.a?b.a(a,d):b.call(null,a,d):a;case 3:return Tf.a(c,Ic),0>Va(c)?b.c?b.c(a,d,e):b.call(null,a,d,e):a}throw Error("Invalid arity: "+arguments.length);}}()})}function b(a){return function(b){return c.a(a,b)}}var c=null,c=function(c,e){switch(arguments.length){case 1:return b.call(this,c);case 2:return a.call(this,c,e)}throw Error("Invalid arity: "+arguments.length);};c.b=b;c.a=a;return c}();function yg(a,b){var c=T.c(Af,a,b);return K(c,Bd(function(a){return c===a},b))}
var zg=function(){function a(a,b){return O(a)<O(b)?z.c(ac,b,a):z.c(ac,a,b)}var b=null,c=function(){function a(c,d,k){var l=null;2<arguments.length&&(l=I(Array.prototype.slice.call(arguments,2),0));return b.call(this,c,d,l)}function b(a,c,d){a=yg(O,ac.e(d,c,I([a],0)));return z.c(Ed,E(a),F(a))}a.j=2;a.g=function(a){var c=E(a);a=H(a);var d=E(a);a=F(a);return b(c,d,a)};a.e=b;return a}(),b=function(b,e,g){switch(arguments.length){case 0:return uf;case 1:return b;case 2:return a.call(this,b,e);default:return c.e(b,
e,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.j=2;b.g=c.g;b.o=function(){return uf};b.b=aa();b.a=a;b.e=c.e;return b}(),Ag=function(){function a(a,b){for(;;)if(O(b)<O(a)){var c=a;a=b;b=c}else return z.c(function(a,b){return function(a,c){return zc(b,c)?a:ic.a(a,c)}}(a,b),a,a)}var b=null,c=function(){function a(b,d,k){var l=null;2<arguments.length&&(l=I(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){a=yg(function(a){return-O(a)},ac.e(e,
d,I([a],0)));return z.c(b,E(a),F(a))}a.j=2;a.g=function(a){var b=E(a);a=H(a);var d=E(a);a=F(a);return c(b,d,a)};a.e=c;return a}(),b=function(b,e,g){switch(arguments.length){case 1:return b;case 2:return a.call(this,b,e);default:return c.e(b,e,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.j=2;b.g=c.g;b.b=aa();b.a=a;b.e=c.e;return b}(),Bg=function(){function a(a,b){return O(a)<O(b)?z.c(function(a,c){return zc(b,c)?ic.a(a,c):a},a,a):z.c(ic,a,b)}var b=null,c=function(){function a(b,
d,k){var l=null;2<arguments.length&&(l=I(Array.prototype.slice.call(arguments,2),0));return c.call(this,b,d,l)}function c(a,d,e){return z.c(b,a,ac.a(e,d))}a.j=2;a.g=function(a){var b=E(a);a=H(a);var d=E(a);a=F(a);return c(b,d,a)};a.e=c;return a}(),b=function(b,e,g){switch(arguments.length){case 1:return b;case 2:return a.call(this,b,e);default:return c.e(b,e,I(arguments,2))}throw Error("Invalid arity: "+arguments.length);};b.j=2;b.g=c.g;b.b=aa();b.a=a;b.e=c.e;return b}();r("mori.count",O);r("mori.empty",function(a){return wa(a)});r("mori.first",E);r("mori.rest",F);r("mori.seq",D);r("mori.conj",ac);r("mori.cons",K);r("mori.find",function(a,b){var c;if(c=null!=a)c=(c=oc(a))?zc(a,b):c;return c?X([b,R.a(a,b)]):null});r("mori.nth",Q);r("mori.last",$b);r("mori.assoc",S);r("mori.dissoc",dc);r("mori.get_in",Gd);r("mori.update_in",Hd);r("mori.assoc_in",function Cg(b,c,d){var e=Q.c(c,0,null);c=Lc(c);return t(c)?S.c(b,e,Cg(R.a(b,e),c,d)):S.c(b,e,d)});r("mori.fnil",pd);
r("mori.disj",ic);r("mori.pop",function(a){return Sa(a)});r("mori.peek",function(a){return Ra(a)});r("mori.hash",C);r("mori.get",R);r("mori.has_key",zc);r("mori.is_empty",lc);r("mori.reverse",Tc);r("mori.take",sd);r("mori.drop",td);r("mori.partition",Fd);
r("mori.partition_by",function Dg(b,c){return new V(null,function(){var d=D(c);if(d){var e=E(d),g=b.b?b.b(e):b.call(null,e),e=K(e,Cf(function(c,d){return function(c){return Ob.a(d,b.b?b.b(c):b.call(null,c))}}(e,g),H(d)));return K(e,Dg(b,D(td(O(e),d))))}return null},null,null)});r("mori.iterate",function Eg(b,c){return K(c,new V(null,function(){return Eg(b,b.b?b.b(c):b.call(null,c))},null,null))});r("mori.into",Ed);r("mori.subvec",de);r("mori.take_while",Cf);
r("mori.drop_while",function(a,b){return new V(null,function(){var c;a:{c=a;for(var d=b;;){var d=D(d),e;e=(e=d)?c.b?c.b(E(d)):c.call(null,E(d)):e;if(t(e))d=F(d);else{c=d;break a}}c=void 0}return c},null,null)});r("mori.group_by",function(a,b){return z.c(function(b,d){var e=a.b?a.b(d):a.call(null,d);return S.c(b,e,ac.a(R.c(b,e,Zd),d))},we,b)});r("mori.interpose",function(a,b){return td(1,wd.a(ud.b(a),b))});r("mori.interleave",wd);r("mori.concat",fd);
function Dd(a){var b=a instanceof Array;return b?b:pc(a)}r("mori.flatten",function(a){return Ad(function(a){return na(Dd(a))},F(Cd(a)))});r("mori.keys",qf);r("mori.vals",function(a){return(a=D(a))?new rf(a,null):null});r("mori.prim_seq",Zb);r("mori.map",qd);r("mori.mapcat",yd);r("mori.reduce",z);r("mori.reduce_kv",function(a,b,c){return bb(c,a,b)});r("mori.filter",Ad);r("mori.remove",Bd);
r("mori.some",function(a,b){for(;;)if(D(b)){var c=a.b?a.b(E(b)):a.call(null,E(b));if(t(c))return c;var c=a,d=H(b);a=c;b=d}else return null});r("mori.every",kd);r("mori.equals",Ob);r("mori.range",Gf);r("mori.repeat",ud);r("mori.repeatedly",vd);r("mori.sort",Ec);r("mori.sort_by",Fc);r("mori.into_array",sa);r("mori.subseq",Ef);r("mori.rmap",rg);r("mori.rfilter",sg);r("mori.rremove",ug);r("mori.rtake",wg);r("mori.rtake_while",vg);r("mori.rdrop",xg);r("mori.rflatten",tg);r("mori.list",Xb);
r("mori.vector",be);r("mori.array_map",mf);r("mori.hash_map",cc);r("mori.set",function(a){a=D(a);if(null==a)return uf;if(a instanceof Nb){a=a.d;a:{for(var b=0,c=ub(uf);;)if(b<a.length)var d=b+1,c=c.pa(c,a[b]),b=d;else{a=c;break a}a=void 0}return a.wa(a)}if(w)for(d=ub(uf);;)if(null!=a)b=a.V(a),d=d.pa(d,a.Q(a)),a=b;else return d.wa(d);else return null});r("mori.sorted_set",xf);r("mori.sorted_set_by",yf);r("mori.sorted_map",nf);r("mori.sorted_map_by",of);
r("mori.zipmap",function(a,b){for(var c=ub(we),d=D(a),e=D(b);;){var g=d;if(g?e:g)c=id(c,E(d),E(e)),d=H(d),e=H(e);else return wb(c)}});r("mori.is_list",function(a){if(a){var b=a.h&33554432;a=(b?b:a.mc)?!0:a.h?!1:v(ib,a)}else a=v(ib,a);return a});r("mori.is_seq",xc);r("mori.is_vector",rc);r("mori.is_map",qc);r("mori.is_set",nc);r("mori.is_collection",mc);r("mori.is_sequential",pc);r("mori.is_associative",oc);r("mori.is_counted",Tb);r("mori.is_indexed",Ub);
r("mori.is_reduceable",function(a){if(a){var b=a.h&524288;a=(b?b:a.Kb)?!0:a.h?!1:v($a,a)}else a=v($a,a);return a});r("mori.is_seqable",function(a){if(a){var b=a.h&8388608;a=(b?b:a.Wb)?!0:a.h?!1:v(fb,a)}else a=v(fb,a);return a});r("mori.is_reversible",Sc);r("mori.union",zg);r("mori.intersection",Ag);r("mori.difference",Bg);r("mori.is_subset",function(a,b){var c=O(a)<=O(b);return c?kd(function(a){return zc(b,a)},a):c});
r("mori.is_superset",function(a,b){var c=O(a)>=O(b);return c?kd(function(b){return zc(a,b)},b):c});r("mori.partial",od);r("mori.comp",nd);r("mori.pipeline",function(){function a(a){var d=null;0<arguments.length&&(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return z.a?z.a(function(a,b){return b.b?b.b(a):b.call(null,a)},a):z.call(null,function(a,b){return b.b?b.b(a):b.call(null,a)},a)}a.j=0;a.g=function(a){a=D(a);return b(a)};a.e=b;return a}());
r("mori.curry",function(){function a(a,d){var e=null;1<arguments.length&&(e=I(Array.prototype.slice.call(arguments,1),0));return b.call(this,a,e)}function b(a,b){return function(e){return T.a(a,K.a?K.a(e,b):K.call(null,e,b))}}a.j=1;a.g=function(a){var d=E(a);a=F(a);return b(d,a)};a.e=b;return a}());
r("mori.juxt",function(){function a(a){var d=null;0<arguments.length&&(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return function(){function b(a){var c=null;0<arguments.length&&(c=I(Array.prototype.slice.call(arguments,0),0));return e.call(this,c)}function e(b){return sa.b?sa.b(qd.a?qd.a(function(a){return T.a(a,b)},a):qd.call(null,function(a){return T.a(a,b)},a)):sa.call(null,qd.a?qd.a(function(a){return T.a(a,b)},a):qd.call(null,function(a){return T.a(a,
b)},a))}b.j=0;b.g=function(a){a=D(a);return e(a)};b.e=e;return b}()}a.j=0;a.g=function(a){a=D(a);return b(a)};a.e=b;return a}());
r("mori.knit",function(){function a(a){var d=null;0<arguments.length&&(d=I(Array.prototype.slice.call(arguments,0),0));return b.call(this,d)}function b(a){return function(b){return sa.b?sa.b(qd.c?qd.c(function(a,b){return a.b?a.b(b):a.call(null,b)},a,b):qd.call(null,function(a,b){return a.b?a.b(b):a.call(null,b)},a,b)):sa.call(null,qd.c?qd.c(function(a,b){return a.b?a.b(b):a.call(null,b)},a,b):qd.call(null,function(a,b){return a.b?a.b(b):a.call(null,b)},a,b))}}a.j=0;a.g=function(a){a=D(a);return b(a)};
a.e=b;return a}());r("mori.sum",function(a,b){return a+b});r("mori.inc",function(a){return a+1});r("mori.dec",function(a){return a-1});r("mori.is_even",function(a){return 0===(a%2+2)%2});r("mori.is_odd",function(a){return 1===(a%2+2)%2});r("mori.each",function(a,b){for(var c=D(a),d=null,e=0,g=0;;)if(g<e){var h=d.L(d,g);b.b?b.b(h):b.call(null,h);g+=1}else if(c=D(c))d=c,sc(d)?(c=Cb(d),e=Db(d),d=c,h=O(c),c=e,e=h):(h=E(d),b.b?b.b(h):b.call(null,h),c=H(d),d=null,e=0),g=0;else return null});
r("mori.identity",ld);r("mori.constantly",function(a){return function(){function b(b){0<arguments.length&&I(Array.prototype.slice.call(arguments,0),0);return a}b.j=0;b.g=function(b){D(b);return a};b.e=function(){return a};return b}()});r("mori.clj_to_js",Xf);r("mori.js_to_clj",bg);V.prototype.inspect=function(){return this.toString()};Nb.prototype.inspect=function(){return this.toString()};Wb.prototype.inspect=function(){return this.toString()};Ue.prototype.inspect=function(){return this.toString()};
Oe.prototype.inspect=function(){return this.toString()};Pe.prototype.inspect=function(){return this.toString()};Qc.prototype.inspect=function(){return this.toString()};Uc.prototype.inspect=function(){return this.toString()};Rc.prototype.inspect=function(){return this.toString()};Ud.prototype.inspect=function(){return this.toString()};ad.prototype.inspect=function(){return this.toString()};ce.prototype.inspect=function(){return this.toString()};ee.prototype.inspect=function(){return this.toString()};
Z.prototype.inspect=function(){return this.toString()};Y.prototype.inspect=function(){return this.toString()};se.prototype.inspect=function(){return this.toString()};Qe.prototype.inspect=function(){return this.toString()};jf.prototype.inspect=function(){return this.toString()};sf.prototype.inspect=function(){return this.toString()};vf.prototype.inspect=function(){return this.toString()};Ff.prototype.inspect=function(){return this.toString()};function Fg(a,b,c,d){return N(X([d,null]),Gb([jg,c,kg,b,fg,a],!0))}function Gg(a){return a.b?a.b(0):a.call(null,0)}function Hg(a){return fg.call(null,hc(a)).call(null,Gg(a))}function Ig(a){if(t(Hg(a)))return kg.call(null,hc(a)).call(null,Gg(a));throw"called children on a leaf node";}function Jg(a,b,c){return jg.call(null,hc(a)).call(null,b,c)}
function Kg(a){if(t(Hg(a))){var b=Q.c(a,0,null),c=Q.c(a,1,null),d=Ig(a),e=Q.c(d,0,null),g=Lc(d);return t(d)?N(X([e,Gb([ig,Zd,dg,t(c)?ac.a(dg.call(null,c),b):X([b]),eg,c,cg,g],!0)]),hc(a)):null}return null}function Lg(a){var b=Q.c(a,0,null),c=Q.c(a,1,null),d=xc(c)?T.a(cc,c):c,c=R.a(d,ig),e=R.a(d,eg),g=R.a(d,dg),h=R.a(d,cg),d=R.a(d,gg);return t(g)?(g=Ra(g),N(t(d)?X([Jg(a,g,fd.a(c,K(b,h))),t(e)?S.c(e,gg,!0):e]):X([g,e]),hc(a))):null}
function Mg(a){var b=Q.c(a,0,null),c=Q.c(a,1,null),c=xc(c)?T.a(cc,c):c,d=R.a(c,ig),e=R.a(c,cg),g=Q.c(e,0,null),h=Lc(e);return t(t(c)?e:c)?N(X([g,S.e(c,ig,ac.a(d,b),I([cg,h],0))]),hc(a)):null}function Ng(a){var b=Q.c(a,0,null),c=Q.c(a,1,null),c=xc(c)?T.a(cc,c):c,d=R.a(c,ig),e=R.a(c,cg);return t(t(c)?e:c)?N(X([$b(e),S.e(c,ig,T.n(ac,d,b,zf(e)),I([cg,null],0))]),hc(a)):a}
function Og(a){var b=Q.c(a,0,null),c=Q.c(a,1,null),c=xc(c)?T.a(cc,c):c,d=R.a(c,ig),e=R.a(c,cg);return t(t(c)?D(d):c)?N(X([Ra(d),S.e(c,ig,Sa(d),I([cg,K(b,e)],0))]),hc(a)):null}function Pg(a,b){Q.c(a,0,null);var c=Q.c(a,1,null);return N(X([b,S.c(c,gg,!0)]),hc(a))}
var Qg=function(){function a(a,d,e){var g=null;2<arguments.length&&(g=I(Array.prototype.slice.call(arguments,2),0));return b.call(this,a,d,g)}function b(a,b,e){return Pg(a,T.c(b,Gg(a),e))}a.j=2;a.g=function(a){var d=E(a);a=H(a);var e=E(a);a=F(a);return b(d,e,a)};a.e=b;return a}();r("mori.zip.zipper",Fg);r("mori.zip.seq_zip",function(a){return Fg(xc,ld,function(a,c){return N(c,hc(a))},a)});r("mori.zip.vector_zip",function(a){return Fg(rc,D,function(a,c){return N(ae(c),hc(a))},a)});r("mori.zip.node",Gg);r("mori.zip.is_branch",{}.gc);r("mori.zip.children",Ig);r("mori.zip.make_node",Jg);r("mori.zip.path",function(a){return dg.call(null,a.b?a.b(1):a.call(null,1))});r("mori.zip.lefts",function(a){return D(ig.call(null,a.b?a.b(1):a.call(null,1)))});
r("mori.zip.rights",function(a){return cg.call(null,a.b?a.b(1):a.call(null,1))});r("mori.zip.down",Kg);r("mori.zip.up",Lg);r("mori.zip.root",function(a){for(;;){if(Ob.a(hg,a.b?a.b(1):a.call(null,1)))return Gg(a);var b=Lg(a);if(t(b))a=b;else return Gg(a)}});r("mori.zip.right",Mg);r("mori.zip.rightmost",Ng);r("mori.zip.left",Og);
r("mori.zip.leftmost",function(a){var b=Q.c(a,0,null),c=Q.c(a,1,null),c=xc(c)?T.a(cc,c):c,d=R.a(c,ig),e=R.a(c,cg);return t(t(c)?D(d):c)?N(X([E(d),S.e(c,ig,Zd,I([cg,fd.e(F(d),X([b]),I([e],0))],0))]),hc(a)):a});r("mori.zip.insert_left",function(a,b){var c=Q.c(a,0,null),d=Q.c(a,1,null),d=xc(d)?T.a(cc,d):d,e=R.a(d,ig);if(null==d)throw"Insert at top";return N(X([c,S.e(d,ig,ac.a(e,b),I([gg,!0],0))]),hc(a))});
r("mori.zip.insert_right",function(a,b){var c=Q.c(a,0,null),d=Q.c(a,1,null),d=xc(d)?T.a(cc,d):d,e=R.a(d,cg);if(null==d)throw"Insert at top";return N(X([c,S.e(d,cg,K(b,e),I([gg,!0],0))]),hc(a))});r("mori.zip.replace",Pg);r("mori.zip.edit",Qg);r("mori.zip.insert_child",function(a,b){return Pg(a,Jg(a,Gg(a),K(b,Ig(a))))});r("mori.zip.append_child",function(a,b){return Pg(a,Jg(a,Gg(a),fd.a(Ig(a),X([b]))))});
r("mori.zip.next",function(a){if(Ob.a(hg,a.b?a.b(1):a.call(null,1)))return a;var b;b=Hg(a);b=t(b)?Kg(a):b;if(t(b))return b;b=Mg(a);if(t(b))return b;for(;;)if(t(Lg(a))){b=Mg(Lg(a));if(t(b))return b;a=Lg(a)}else return X([Gg(a),hg])});r("mori.zip.prev",function(a){var b=Og(a);if(t(b))for(a=b;;)if(b=Hg(a),b=t(b)?Kg(a):b,t(b))a=Ng(b);else return a;else return Lg(a)});r("mori.zip.is_end",function(a){return Ob.a(hg,a.b?a.b(1):a.call(null,1))});
r("mori.zip.remove",function(a){Q.c(a,0,null);var b=Q.c(a,1,null),b=xc(b)?T.a(cc,b):b,c=R.a(b,ig),d=R.a(b,eg),e=R.a(b,dg),g=R.a(b,cg);if(null==b)throw"Remove at top";if(0<O(c))for(a=N(X([Ra(c),S.e(b,ig,Sa(c),I([gg,!0],0))]),hc(a));;)if(b=Hg(a),b=t(b)?Kg(a):b,t(b))a=Ng(b);else return a;else return N(X([Jg(a,Ra(e),g),t(d)?S.c(d,gg,!0):d]),hc(a))});r("mori.mutable.thaw",function(a){return ub(a)});r("mori.mutable.freeze",hd);r("mori.mutable.conj",function(a,b){return vb(a,b)});r("mori.mutable.assoc",id);r("mori.mutable.dissoc",function(a,b){return yb(a,b)});r("mori.mutable.pop",function(a){return zb(a)});r("mori.mutable.disj",function(a,b){return Ab(a,b)});;return this.mori;}.call({});});

},{}],6:[function(require,module,exports){
'use strict';

var copyProperties = require('./lib/copyProperties');

var WARNING_MESSAGE = (
  'It looks like you\'re trying to use jeffbski\'s React.js project.\n' +
  'The `react` npm package now points to the React JavaScript library for ' +
  'building user interfaces, not the React.js project for managing asynchronous ' +
  'control flow. If you\'re looking for that library, please npm install autoflow.'
);

function error() {
  throw new Error(WARNING_MESSAGE);
}

// Model the React.js project's public interface exactly.

function ReactJSShim() {
  error();
}

ReactJSShim.logEvents = error;
ReactJSShim.resolvePromises = error;
ReactJSShim.trackTasks = error;
ReactJSShim.createEventCollector = error;

// These could throw using defineProperty() but supporting older browsers will
// be painful. Additionally any error messages around this will contain the string
// so I think this is sufficient.
ReactJSShim.options = WARNING_MESSAGE;
ReactJSShim.events = WARNING_MESSAGE;

var ReactJSErrors = {
  wrap: function(module) {
    copyProperties(ReactJSShim, module);
    return ReactJSShim;
  }
};

module.exports = ReactJSErrors;

},{"./lib/copyProperties":84}],7:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule $
 * @typechecks
 */

var ge = require("./ge");
var ex = require("./ex");

/**
 * Find a node by ID.
 *
 * If your application code depends on the existence of the element, use $,
 * which will throw if the element doesn't exist.
 *
 * If you're not sure whether or not the element exists, use ge instead, and
 * manually check for the element's existence in your application code.
 *
 * @param {string|DOMDocument|DOMElement|DOMTextNode|Comment} id
 * @return {DOMDocument|DOMElement|DOMTextNode|Comment}
 */
function $(id) {
  var element = ge(id);
  if (!element) {
    throw new Error(ex(
      'Tried to get element with id of "%s" but it is not present on the page.',
      id
    ));
  }
  return element;
}

module.exports = $;

},{"./ex":91,"./ge":95}],8:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule CSSProperty
 */

"use strict";

/**
 * CSS properties which accept numbers but are not in units of "px".
 */
var isUnitlessNumber = {
  fillOpacity: true,
  fontWeight: true,
  lineHeight: true,
  opacity: true,
  orphans: true,
  zIndex: true,
  zoom: true
};

/**
 * Most style properties can be unset by doing .style[prop] = '' but IE8
 * doesn't like doing that with shorthand properties so for the properties that
 * IE8 breaks on, which are listed here, we instead unset each of the
 * individual properties. See http://bugs.jquery.com/ticket/12385.
 * The 4-value 'clock' properties like margin, padding, border-width seem to
 * behave without any problems. Curiously, list-style works too without any
 * special prodding.
 */
var shorthandPropertyExpansions = {
  background: {
    backgroundImage: true,
    backgroundPosition: true,
    backgroundRepeat: true,
    backgroundColor: true
  },
  border: {
    borderWidth: true,
    borderStyle: true,
    borderColor: true
  },
  borderBottom: {
    borderBottomWidth: true,
    borderBottomStyle: true,
    borderBottomColor: true
  },
  borderLeft: {
    borderLeftWidth: true,
    borderLeftStyle: true,
    borderLeftColor: true
  },
  borderRight: {
    borderRightWidth: true,
    borderRightStyle: true,
    borderRightColor: true
  },
  borderTop: {
    borderTopWidth: true,
    borderTopStyle: true,
    borderTopColor: true
  },
  font: {
    fontStyle: true,
    fontVariant: true,
    fontWeight: true,
    fontSize: true,
    lineHeight: true,
    fontFamily: true
  }
};

var CSSProperty = {
  isUnitlessNumber: isUnitlessNumber,
  shorthandPropertyExpansions: shorthandPropertyExpansions
};

module.exports = CSSProperty;

},{}],9:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule CSSPropertyOperations
 * @typechecks static-only
 */

"use strict";

var CSSProperty = require("./CSSProperty");

var dangerousStyleValue = require("./dangerousStyleValue");
var escapeTextForBrowser = require("./escapeTextForBrowser");
var hyphenate = require("./hyphenate");
var memoizeStringOnly = require("./memoizeStringOnly");

var processStyleName = memoizeStringOnly(function(styleName) {
  return escapeTextForBrowser(hyphenate(styleName));
});

/**
 * Operations for dealing with CSS properties.
 */
var CSSPropertyOperations = {

  /**
   * Serializes a mapping of style properties for use as inline styles:
   *
   *   > createMarkupForStyles({width: '200px', height: 0})
   *   "width:200px;height:0;"
   *
   * Undefined values are ignored so that declarative programming is easier.
   *
   * @param {object} styles
   * @return {?string}
   */
  createMarkupForStyles: function(styles) {
    var serialized = '';
    for (var styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      var styleValue = styles[styleName];
      if (styleValue != null) {
        serialized += processStyleName(styleName) + ':';
        serialized += dangerousStyleValue(styleName, styleValue) + ';';
      }
    }
    return serialized || null;
  },

  /**
   * Sets the value for multiple styles on a node.  If a value is specified as
   * '' (empty string), the corresponding style property will be unset.
   *
   * @param {DOMElement} node
   * @param {object} styles
   */
  setValueForStyles: function(node, styles) {
    var style = node.style;
    for (var styleName in styles) {
      if (!styles.hasOwnProperty(styleName)) {
        continue;
      }
      var styleValue = dangerousStyleValue(styleName, styles[styleName]);
      if (styleValue) {
        style[styleName] = styleValue;
      } else {
        var expansion = CSSProperty.shorthandPropertyExpansions[styleName];
        if (expansion) {
          // Shorthand property that IE8 won't like unsetting, so unset each
          // component to placate it
          for (var individualStyleName in expansion) {
            style[individualStyleName] = '';
          }
        } else {
          style[styleName] = '';
        }
      }
    }
  }

};

module.exports = CSSPropertyOperations;

},{"./CSSProperty":8,"./dangerousStyleValue":88,"./escapeTextForBrowser":90,"./hyphenate":103,"./memoizeStringOnly":112}],10:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule CallbackRegistry
 * @typechecks static-only
 */

"use strict";

var listenerBank = {};

/**
 * Stores "listeners" by `registrationName`/`id`. There should be at most one
 * "listener" per `registrationName`/`id` in the `listenerBank`.
 *
 * Access listeners via `listenerBank[registrationName][id]`.
 *
 * @class CallbackRegistry
 * @internal
 */
var CallbackRegistry = {

  /**
   * Stores `listener` at `listenerBank[registrationName][id]`. Is idempotent.
   *
   * @param {string} id ID of the DOM element.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @param {?function} listener The callback to store.
   */
  putListener: function(id, registrationName, listener) {
    var bankForRegistrationName =
      listenerBank[registrationName] || (listenerBank[registrationName] = {});
    bankForRegistrationName[id] = listener;
  },

  /**
   * @param {string} id ID of the DOM element.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   * @return {?function} The stored callback.
   */
  getListener: function(id, registrationName) {
    var bankForRegistrationName = listenerBank[registrationName];
    return bankForRegistrationName && bankForRegistrationName[id];
  },

  /**
   * Deletes a listener from the registration bank.
   *
   * @param {string} id ID of the DOM element.
   * @param {string} registrationName Name of listener (e.g. `onClick`).
   */
  deleteListener: function(id, registrationName) {
    var bankForRegistrationName = listenerBank[registrationName];
    if (bankForRegistrationName) {
      delete bankForRegistrationName[id];
    }
  },

  /**
   * Deletes all listeners for the DOM element with the supplied ID.
   *
   * @param {string} id ID of the DOM element.
   */
  deleteAllListeners: function(id) {
    for (var registrationName in listenerBank) {
      delete listenerBank[registrationName][id];
    }
  },

  /**
   * This is needed for tests only. Do not use!
   */
  __purge: function() {
    listenerBank = {};
  }

};

module.exports = CallbackRegistry;

},{}],11:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ChangeEventPlugin
 */

"use strict";

var EventConstants = require("./EventConstants");
var EventPluginHub = require("./EventPluginHub");
var EventPropagators = require("./EventPropagators");
var ExecutionEnvironment = require("./ExecutionEnvironment");
var SyntheticEvent = require("./SyntheticEvent");

var isEventSupported = require("./isEventSupported");
var isTextInputElement = require("./isTextInputElement");
var keyOf = require("./keyOf");

var topLevelTypes = EventConstants.topLevelTypes;

var eventTypes = {
  change: {
    phasedRegistrationNames: {
      bubbled: keyOf({onChange: null}),
      captured: keyOf({onChangeCapture: null})
    }
  }
};

/**
 * For IE shims
 */
var activeElement = null;
var activeElementID = null;
var activeElementValue = null;
var activeElementValueProp = null;

/**
 * SECTION: handle `change` event
 */
function shouldUseChangeEvent(elem) {
  return (
    elem.nodeName === 'SELECT' ||
    (elem.nodeName === 'INPUT' && elem.type === 'file')
  );
}

var doesChangeEventBubble = false;
if (ExecutionEnvironment.canUseDOM) {
  // See `handleChange` comment below
  doesChangeEventBubble = isEventSupported('change') && (
    !('documentMode' in document) || document.documentMode > 8
  );
}

function manualDispatchChangeEvent(nativeEvent) {
  var event = SyntheticEvent.getPooled(
    eventTypes.change,
    activeElementID,
    nativeEvent
  );
  EventPropagators.accumulateTwoPhaseDispatches(event);

  // If change bubbled, we'd just bind to it like all the other events
  // and have it go through ReactEventTopLevelCallback. Since it doesn't, we
  // manually listen for the change event and so we have to enqueue and
  // process the abstract event manually.
  EventPluginHub.enqueueEvents(event);
  EventPluginHub.processEventQueue();
}

function startWatchingForChangeEventIE8(target, targetID) {
  activeElement = target;
  activeElementID = targetID;
  activeElement.attachEvent('onchange', manualDispatchChangeEvent);
}

function stopWatchingForChangeEventIE8() {
  if (!activeElement) {
    return;
  }
  activeElement.detachEvent('onchange', manualDispatchChangeEvent);
  activeElement = null;
  activeElementID = null;
}

function getTargetIDForChangeEvent(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topChange) {
    return topLevelTargetID;
  }
}
function handleEventsForChangeEventIE8(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topFocus) {
    // stopWatching() should be a noop here but we call it just in case we
    // missed a blur event somehow.
    stopWatchingForChangeEventIE8();
    startWatchingForChangeEventIE8(topLevelTarget, topLevelTargetID);
  } else if (topLevelType === topLevelTypes.topBlur) {
    stopWatchingForChangeEventIE8();
  }
}


/**
 * SECTION: handle `input` event
 */
var isInputEventSupported = false;
if (ExecutionEnvironment.canUseDOM) {
  // IE9 claims to support the input event but fails to trigger it when
  // deleting text, so we ignore its input events
  isInputEventSupported = isEventSupported('input') && (
    !('documentMode' in document) || document.documentMode > 9
  );
}

/**
 * (For old IE.) Replacement getter/setter for the `value` property that gets
 * set on the active element.
 */
var newValueProp =  {
  get: function() {
    return activeElementValueProp.get.call(this);
  },
  set: function(val) {
    // Cast to a string so we can do equality checks.
    activeElementValue = '' + val;
    activeElementValueProp.set.call(this, val);
  }
};

/**
 * (For old IE.) Starts tracking propertychange events on the passed-in element
 * and override the value property so that we can distinguish user events from
 * value changes in JS.
 */
function startWatchingForValueChange(target, targetID) {
  activeElement = target;
  activeElementID = targetID;
  activeElementValue = target.value;
  activeElementValueProp = Object.getOwnPropertyDescriptor(
    target.constructor.prototype,
    'value'
  );

  Object.defineProperty(activeElement, 'value', newValueProp);
  activeElement.attachEvent('onpropertychange', handlePropertyChange);
}

/**
 * (For old IE.) Removes the event listeners from the currently-tracked element,
 * if any exists.
 */
function stopWatchingForValueChange() {
  if (!activeElement) {
    return;
  }

  // delete restores the original property definition
  delete activeElement.value;
  activeElement.detachEvent('onpropertychange', handlePropertyChange);

  activeElement = null;
  activeElementID = null;
  activeElementValue = null;
  activeElementValueProp = null;
}

/**
 * (For old IE.) Handles a propertychange event, sending a `change` event if
 * the value of the active element has changed.
 */
function handlePropertyChange(nativeEvent) {
  if (nativeEvent.propertyName !== 'value') {
    return;
  }
  var value = nativeEvent.srcElement.value;
  if (value === activeElementValue) {
    return;
  }
  activeElementValue = value;

  manualDispatchChangeEvent(nativeEvent);
}

/**
 * If a `change` event should be fired, returns the target's ID.
 */
function getTargetIDForInputEvent(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topInput) {
    // In modern browsers (i.e., not IE8 or IE9), the input event is exactly
    // what we want so fall through here and trigger an abstract event
    return topLevelTargetID;
  }
}

// For IE8 and IE9.
function handleEventsForInputEventIE(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topFocus) {
    // In IE8, we can capture almost all .value changes by adding a
    // propertychange handler and looking for events with propertyName
    // equal to 'value'
    // In IE9, propertychange fires for most input events but is buggy and
    // doesn't fire when text is deleted, but conveniently, selectionchange
    // appears to fire in all of the remaining cases so we catch those and
    // forward the event if the value has changed
    // In either case, we don't want to call the event handler if the value
    // is changed from JS so we redefine a setter for `.value` that updates
    // our activeElementValue variable, allowing us to ignore those changes
    //
    // stopWatching() should be a noop here but we call it just in case we
    // missed a blur event somehow.
    stopWatchingForValueChange();
    startWatchingForValueChange(topLevelTarget, topLevelTargetID);
  } else if (topLevelType === topLevelTypes.topBlur) {
    stopWatchingForValueChange();
  }
}

// For IE8 and IE9.
function getTargetIDForInputEventIE(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topSelectionChange ||
      topLevelType === topLevelTypes.topKeyUp ||
      topLevelType === topLevelTypes.topKeyDown) {
    // On the selectionchange event, the target is just document which isn't
    // helpful for us so just check activeElement instead.
    //
    // 99% of the time, keydown and keyup aren't necessary. IE8 fails to fire
    // propertychange on the first input event after setting `value` from a
    // script and fires only keydown, keypress, keyup. Catching keyup usually
    // gets it and catching keydown lets us fire an event for the first
    // keystroke if user does a key repeat (it'll be a little delayed: right
    // before the second keystroke). Other input methods (e.g., paste) seem to
    // fire selectionchange normally.
    if (activeElement && activeElement.value !== activeElementValue) {
      activeElementValue = activeElement.value;
      return activeElementID;
    }
  }
}


/**
 * SECTION: handle `click` event
 */
function shouldUseClickEvent(elem) {
  // Use the `click` event to detect changes to checkbox and radio inputs.
  // This approach works across all browsers, whereas `change` does not fire
  // until `blur` in IE8.
  return (
    elem.nodeName === 'INPUT' &&
    (elem.type === 'checkbox' || elem.type === 'radio')
  );
}

function getTargetIDForClickEvent(
    topLevelType,
    topLevelTarget,
    topLevelTargetID) {
  if (topLevelType === topLevelTypes.topClick) {
    return topLevelTargetID;
  }
}

/**
 * This plugin creates an `onChange` event that normalizes change events
 * across form elements. This event fires at a time when it's possible to
 * change the element's value without seeing a flicker.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - select
 */
var ChangeEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {

    var getTargetIDFunc, handleEventFunc;
    if (shouldUseChangeEvent(topLevelTarget)) {
      if (doesChangeEventBubble) {
        getTargetIDFunc = getTargetIDForChangeEvent;
      } else {
        handleEventFunc = handleEventsForChangeEventIE8;
      }
    } else if (isTextInputElement(topLevelTarget)) {
      if (isInputEventSupported) {
        getTargetIDFunc = getTargetIDForInputEvent;
      } else {
        getTargetIDFunc = getTargetIDForInputEventIE;
        handleEventFunc = handleEventsForInputEventIE;
      }
    } else if (shouldUseClickEvent(topLevelTarget)) {
      getTargetIDFunc = getTargetIDForClickEvent;
    }

    if (getTargetIDFunc) {
      var targetID = getTargetIDFunc(
        topLevelType,
        topLevelTarget,
        topLevelTargetID
      );
      if (targetID) {
        var event = SyntheticEvent.getPooled(
          eventTypes.change,
          targetID,
          nativeEvent
        );
        EventPropagators.accumulateTwoPhaseDispatches(event);
        return event;
      }
    }

    if (handleEventFunc) {
      handleEventFunc(
        topLevelType,
        topLevelTarget,
        topLevelTargetID
      );
    }
  }

};

module.exports = ChangeEventPlugin;

},{"./EventConstants":20,"./EventPluginHub":22,"./EventPropagators":25,"./ExecutionEnvironment":26,"./SyntheticEvent":72,"./isEventSupported":105,"./isTextInputElement":107,"./keyOf":111}],12:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule CompositionEventPlugin
 * @typechecks static-only
 */

"use strict";

var EventConstants = require("./EventConstants");
var EventPropagators = require("./EventPropagators");
var ExecutionEnvironment = require("./ExecutionEnvironment");
var ReactInputSelection = require("./ReactInputSelection");
var SyntheticCompositionEvent = require("./SyntheticCompositionEvent");

var getTextContentAccessor = require("./getTextContentAccessor");
var keyOf = require("./keyOf");

var END_KEYCODES = [9, 13, 27, 32]; // Tab, Return, Esc, Space
var START_KEYCODE = 229;

var useCompositionEvent = ExecutionEnvironment.canUseDOM &&
  'CompositionEvent' in window;
var topLevelTypes = EventConstants.topLevelTypes;
var currentComposition = null;

// Events and their corresponding property names.
var eventTypes = {
  compositionEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCompositionEnd: null}),
      captured: keyOf({onCompositionEndCapture: null})
    }
  },
  compositionStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCompositionStart: null}),
      captured: keyOf({onCompositionStartCapture: null})
    }
  },
  compositionUpdate: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCompositionUpdate: null}),
      captured: keyOf({onCompositionUpdateCapture: null})
    }
  }
};

/**
 * Translate native top level events into event types.
 *
 * @param {string} topLevelType
 * @return {object}
 */
function getCompositionEventType(topLevelType) {
  switch (topLevelType) {
    case topLevelTypes.topCompositionStart:
      return eventTypes.compositionStart;
    case topLevelTypes.topCompositionEnd:
      return eventTypes.compositionEnd;
    case topLevelTypes.topCompositionUpdate:
      return eventTypes.compositionUpdate;
  }
}

/**
 * Does our fallback best-guess model think this event signifies that
 * composition has begun?
 *
 * @param {string} topLevelType
 * @param {object} nativeEvent
 * @return {boolean}
 */
function isFallbackStart(topLevelType, nativeEvent) {
  return (
    topLevelType === topLevelTypes.topKeyDown &&
    nativeEvent.keyCode === START_KEYCODE
  );
}

/**
 * Does our fallback mode think that this event is the end of composition?
 *
 * @param {string} topLevelType
 * @param {object} nativeEvent
 * @return {boolean}
 */
function isFallbackEnd(topLevelType, nativeEvent) {
  switch (topLevelType) {
    case topLevelTypes.topKeyUp:
      // Command keys insert or clear IME input.
      return (END_KEYCODES.indexOf(nativeEvent.keyCode) !== -1);
    case topLevelTypes.topKeyDown:
      // Expect IME keyCode on each keydown. If we get any other
      // code we must have exited earlier.
      return (nativeEvent.keyCode !== START_KEYCODE);
    case topLevelTypes.topKeyPress:
    case topLevelTypes.topMouseDown:
    case topLevelTypes.topBlur:
      // Events are not possible without cancelling IME.
      return true;
    default:
      return false;
  }
}

/**
 * Helper class stores information about selection and document state
 * so we can figure out what changed at a later date.
 *
 * @param {DOMEventTarget} root
 */
function FallbackCompositionState(root) {
  this.root = root;
  this.startSelection = ReactInputSelection.getSelection(root);
  this.startValue = this.getText();
}

/**
 * Get current text of input.
 *
 * @return {string}
 */
FallbackCompositionState.prototype.getText = function() {
  return this.root.value || this.root[getTextContentAccessor()];
};

/**
 * Text that has changed since the start of composition.
 *
 * @return {string}
 */
FallbackCompositionState.prototype.getData = function() {
  var endValue = this.getText();
  var prefixLength = this.startSelection.start;
  var suffixLength = this.startValue.length - this.startSelection.end;

  return endValue.substr(
    prefixLength,
    endValue.length - suffixLength - prefixLength
  );
};

/**
 * This plugin creates `onCompositionStart`, `onCompositionUpdate` and
 * `onCompositionEnd` events on inputs, textareas and contentEditable
 * nodes.
 */
var CompositionEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {

    var eventType;
    var data;

    if (useCompositionEvent) {
      eventType = getCompositionEventType(topLevelType);
    } else if (!currentComposition) {
      if (isFallbackStart(topLevelType, nativeEvent)) {
        eventType = eventTypes.start;
        currentComposition = new FallbackCompositionState(topLevelTarget);
      }
    } else if (isFallbackEnd(topLevelType, nativeEvent)) {
      eventType = eventTypes.compositionEnd;
      data = currentComposition.getData();
      currentComposition = null;
    }

    if (eventType) {
      var event = SyntheticCompositionEvent.getPooled(
        eventType,
        topLevelTargetID,
        nativeEvent
      );
      if (data) {
        // Inject data generated from fallback path into the synthetic event.
        // This matches the property of native CompositionEventInterface.
        event.data = data;
      }
      EventPropagators.accumulateTwoPhaseDispatches(event);
      return event;
    }
  }
};

module.exports = CompositionEventPlugin;

},{"./EventConstants":20,"./EventPropagators":25,"./ExecutionEnvironment":26,"./ReactInputSelection":53,"./SyntheticCompositionEvent":71,"./getTextContentAccessor":101,"./keyOf":111}],13:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule DOMChildrenOperations
 * @typechecks static-only
 */

"use strict";

var Danger = require("./Danger");
var ReactMultiChildUpdateTypes = require("./ReactMultiChildUpdateTypes");

var getTextContentAccessor = require("./getTextContentAccessor");

/**
 * The DOM property to use when setting text content.
 *
 * @type {string}
 * @private
 */
var textContentAccessor = getTextContentAccessor() || 'NA';

/**
 * Inserts `childNode` as a child of `parentNode` at the `index`.
 *
 * @param {DOMElement} parentNode Parent node in which to insert.
 * @param {DOMElement} childNode Child node to insert.
 * @param {number} index Index at which to insert the child.
 * @internal
 */
function insertChildAt(parentNode, childNode, index) {
  var childNodes = parentNode.childNodes;
  if (childNodes[index] === childNode) {
    return;
  }
  // If `childNode` is already a child of `parentNode`, remove it so that
  // computing `childNodes[index]` takes into account the removal.
  if (childNode.parentNode === parentNode) {
    parentNode.removeChild(childNode);
  }
  if (index >= childNodes.length) {
    parentNode.appendChild(childNode);
  } else {
    parentNode.insertBefore(childNode, childNodes[index]);
  }
}

/**
 * Operations for updating with DOM children.
 */
var DOMChildrenOperations = {

  dangerouslyReplaceNodeWithMarkup: Danger.dangerouslyReplaceNodeWithMarkup,

  /**
   * Updates a component's children by processing a series of updates. The
   * update configurations are each expected to have a `parentNode` property.
   *
   * @param {array<object>} updates List of update configurations.
   * @param {array<string>} markupList List of markup strings.
   * @internal
   */
  processUpdates: function(updates, markupList) {
    var update;
    // Mapping from parent IDs to initial child orderings.
    var initialChildren = null;
    // List of children that will be moved or removed.
    var updatedChildren = null;

    for (var i = 0; update = updates[i]; i++) {
      if (update.type === ReactMultiChildUpdateTypes.MOVE_EXISTING ||
          update.type === ReactMultiChildUpdateTypes.REMOVE_NODE) {
        var updatedIndex = update.fromIndex;
        var updatedChild = update.parentNode.childNodes[updatedIndex];
        var parentID = update.parentID;

        initialChildren = initialChildren || {};
        initialChildren[parentID] = initialChildren[parentID] || [];
        initialChildren[parentID][updatedIndex] = updatedChild;

        updatedChildren = updatedChildren || [];
        updatedChildren.push(updatedChild);
      }
    }

    var renderedMarkup = Danger.dangerouslyRenderMarkup(markupList);

    // Remove updated children first so that `toIndex` is consistent.
    if (updatedChildren) {
      for (var j = 0; j < updatedChildren.length; j++) {
        updatedChildren[j].parentNode.removeChild(updatedChildren[j]);
      }
    }

    for (var k = 0; update = updates[k]; k++) {
      switch (update.type) {
        case ReactMultiChildUpdateTypes.INSERT_MARKUP:
          insertChildAt(
            update.parentNode,
            renderedMarkup[update.markupIndex],
            update.toIndex
          );
          break;
        case ReactMultiChildUpdateTypes.MOVE_EXISTING:
          insertChildAt(
            update.parentNode,
            initialChildren[update.parentID][update.fromIndex],
            update.toIndex
          );
          break;
        case ReactMultiChildUpdateTypes.TEXT_CONTENT:
          update.parentNode[textContentAccessor] = update.textContent;
          break;
        case ReactMultiChildUpdateTypes.REMOVE_NODE:
          // Already removed by the for-loop above.
          break;
      }
    }
  }

};

module.exports = DOMChildrenOperations;

},{"./Danger":16,"./ReactMultiChildUpdateTypes":59,"./getTextContentAccessor":101}],14:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule DOMProperty
 * @typechecks static-only
 */

/*jslint bitwise: true */

"use strict";

var invariant = require("./invariant");

var DOMPropertyInjection = {
  /**
   * Mapping from normalized, camelcased property names to a configuration that
   * specifies how the associated DOM property should be accessed or rendered.
   */
  MUST_USE_ATTRIBUTE: 0x1,
  MUST_USE_PROPERTY: 0x2,
  HAS_SIDE_EFFECTS: 0x4,
  HAS_BOOLEAN_VALUE: 0x8,
  HAS_POSITIVE_NUMERIC_VALUE: 0x10,

  /**
   * Inject some specialized knowledge about the DOM. This takes a config object
   * with the following properties:
   *
   * isCustomAttribute: function that given an attribute name will return true
   * if it can be inserted into the DOM verbatim. Useful for data-* or aria-*
   * attributes where it's impossible to enumerate all of the possible
   * attribute names,
   *
   * Properties: object mapping DOM property name to one of the
   * DOMPropertyInjection constants or null. If your attribute isn't in here,
   * it won't get written to the DOM.
   *
   * DOMAttributeNames: object mapping React attribute name to the DOM
   * attribute name. Attribute names not specified use the **lowercase**
   * normalized name.
   *
   * DOMPropertyNames: similar to DOMAttributeNames but for DOM properties.
   * Property names not specified use the normalized name.
   *
   * DOMMutationMethods: Properties that require special mutation methods. If
   * `value` is undefined, the mutation method should unset the property.
   *
   * @param {object} domPropertyConfig the config as described above.
   */
  injectDOMPropertyConfig: function(domPropertyConfig) {
    var Properties = domPropertyConfig.Properties || {};
    var DOMAttributeNames = domPropertyConfig.DOMAttributeNames || {};
    var DOMPropertyNames = domPropertyConfig.DOMPropertyNames || {};
    var DOMMutationMethods = domPropertyConfig.DOMMutationMethods || {};

    if (domPropertyConfig.isCustomAttribute) {
      DOMProperty._isCustomAttributeFunctions.push(
        domPropertyConfig.isCustomAttribute
      );
    }

    for (var propName in Properties) {
      ("production" !== process.env.NODE_ENV ? invariant(
        !DOMProperty.isStandardName[propName],
        'injectDOMPropertyConfig(...): You\'re trying to inject DOM property ' +
        '\'%s\' which has already been injected. You may be accidentally ' +
        'injecting the same DOM property config twice, or you may be ' +
        'injecting two configs that have conflicting property names.',
        propName
      ) : invariant(!DOMProperty.isStandardName[propName]));

      DOMProperty.isStandardName[propName] = true;

      var lowerCased = propName.toLowerCase();
      DOMProperty.getPossibleStandardName[lowerCased] = propName;

      var attributeName = DOMAttributeNames[propName];
      if (attributeName) {
        DOMProperty.getPossibleStandardName[attributeName] = propName;
      }

      DOMProperty.getAttributeName[propName] = attributeName || lowerCased;

      DOMProperty.getPropertyName[propName] =
        DOMPropertyNames[propName] || propName;

      var mutationMethod = DOMMutationMethods[propName];
      if (mutationMethod) {
        DOMProperty.getMutationMethod[propName] = mutationMethod;
      }

      var propConfig = Properties[propName];
      DOMProperty.mustUseAttribute[propName] =
        propConfig & DOMPropertyInjection.MUST_USE_ATTRIBUTE;
      DOMProperty.mustUseProperty[propName] =
        propConfig & DOMPropertyInjection.MUST_USE_PROPERTY;
      DOMProperty.hasSideEffects[propName] =
        propConfig & DOMPropertyInjection.HAS_SIDE_EFFECTS;
      DOMProperty.hasBooleanValue[propName] =
        propConfig & DOMPropertyInjection.HAS_BOOLEAN_VALUE;
      DOMProperty.hasPositiveNumericValue[propName] =
        propConfig & DOMPropertyInjection.HAS_POSITIVE_NUMERIC_VALUE;

      ("production" !== process.env.NODE_ENV ? invariant(
        !DOMProperty.mustUseAttribute[propName] ||
          !DOMProperty.mustUseProperty[propName],
        'DOMProperty: Cannot require using both attribute and property: %s',
        propName
      ) : invariant(!DOMProperty.mustUseAttribute[propName] ||
        !DOMProperty.mustUseProperty[propName]));
      ("production" !== process.env.NODE_ENV ? invariant(
        DOMProperty.mustUseProperty[propName] ||
          !DOMProperty.hasSideEffects[propName],
        'DOMProperty: Properties that have side effects must use property: %s',
        propName
      ) : invariant(DOMProperty.mustUseProperty[propName] ||
        !DOMProperty.hasSideEffects[propName]));
      ("production" !== process.env.NODE_ENV ? invariant(
        !DOMProperty.hasBooleanValue[propName] ||
          !DOMProperty.hasPositiveNumericValue[propName],
        'DOMProperty: Cannot have both boolean and positive numeric value: %s',
        propName
      ) : invariant(!DOMProperty.hasBooleanValue[propName] ||
        !DOMProperty.hasPositiveNumericValue[propName]));
    }
  }
};
var defaultValueCache = {};

/**
 * DOMProperty exports lookup objects that can be used like functions:
 *
 *   > DOMProperty.isValid['id']
 *   true
 *   > DOMProperty.isValid['foobar']
 *   undefined
 *
 * Although this may be confusing, it performs better in general.
 *
 * @see http://jsperf.com/key-exists
 * @see http://jsperf.com/key-missing
 */
var DOMProperty = {

  /**
   * Checks whether a property name is a standard property.
   * @type {Object}
   */
  isStandardName: {},

  /**
   * Mapping from lowercase property names to the properly cased version, used
   * to warn in the case of missing properties.
   * @type {Object}
   */
  getPossibleStandardName: {},

  /**
   * Mapping from normalized names to attribute names that differ. Attribute
   * names are used when rendering markup or with `*Attribute()`.
   * @type {Object}
   */
  getAttributeName: {},

  /**
   * Mapping from normalized names to properties on DOM node instances.
   * (This includes properties that mutate due to external factors.)
   * @type {Object}
   */
  getPropertyName: {},

  /**
   * Mapping from normalized names to mutation methods. This will only exist if
   * mutation cannot be set simply by the property or `setAttribute()`.
   * @type {Object}
   */
  getMutationMethod: {},

  /**
   * Whether the property must be accessed and mutated as an object property.
   * @type {Object}
   */
  mustUseAttribute: {},

  /**
   * Whether the property must be accessed and mutated using `*Attribute()`.
   * (This includes anything that fails `<propName> in <element>`.)
   * @type {Object}
   */
  mustUseProperty: {},

  /**
   * Whether or not setting a value causes side effects such as triggering
   * resources to be loaded or text selection changes. We must ensure that
   * the value is only set if it has changed.
   * @type {Object}
   */
  hasSideEffects: {},

  /**
   * Whether the property should be removed when set to a falsey value.
   * @type {Object}
   */
  hasBooleanValue: {},

  /**
   * Whether the property must be positive numeric or parse as a positive
   * numeric and should be removed when set to a falsey value.
   * @type {Object}
   */
  hasPositiveNumericValue: {},

  /**
   * All of the isCustomAttribute() functions that have been injected.
   */
  _isCustomAttributeFunctions: [],

  /**
   * Checks whether a property name is a custom attribute.
   * @method
   */
  isCustomAttribute: function(attributeName) {
    return DOMProperty._isCustomAttributeFunctions.some(
      function(isCustomAttributeFn) {
        return isCustomAttributeFn.call(null, attributeName);
      }
    );
  },

  /**
   * Returns the default property value for a DOM property (i.e., not an
   * attribute). Most default values are '' or false, but not all. Worse yet,
   * some (in particular, `type`) vary depending on the type of element.
   *
   * TODO: Is it better to grab all the possible properties when creating an
   * element to avoid having to create the same element twice?
   */
  getDefaultValueForProperty: function(nodeName, prop) {
    var nodeDefaults = defaultValueCache[nodeName];
    var testElement;
    if (!nodeDefaults) {
      defaultValueCache[nodeName] = nodeDefaults = {};
    }
    if (!(prop in nodeDefaults)) {
      testElement = document.createElement(nodeName);
      nodeDefaults[prop] = testElement[prop];
    }
    return nodeDefaults[prop];
  },

  injection: DOMPropertyInjection
};

module.exports = DOMProperty;

},{"./invariant":104,"__browserify_process":124}],15:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule DOMPropertyOperations
 * @typechecks static-only
 */

"use strict";

var DOMProperty = require("./DOMProperty");

var escapeTextForBrowser = require("./escapeTextForBrowser");
var memoizeStringOnly = require("./memoizeStringOnly");

function shouldIgnoreValue(name, value) {
  return value == null ||
    DOMProperty.hasBooleanValue[name] && !value ||
    DOMProperty.hasPositiveNumericValue[name] && (isNaN(value) || value < 1);
}

var processAttributeNameAndPrefix = memoizeStringOnly(function(name) {
  return escapeTextForBrowser(name) + '="';
});

if ("production" !== process.env.NODE_ENV) {
  var reactProps = {
    __owner__: true,
    children: true,
    dangerouslySetInnerHTML: true,
    key: true,
    ref: true
  };
  var warnedProperties = {};

  var warnUnknownProperty = function(name) {
    if (reactProps[name] || warnedProperties[name]) {
      return;
    }

    warnedProperties[name] = true;
    var lowerCasedName = name.toLowerCase();

    // data-* attributes should be lowercase; suggest the lowercase version
    var standardName = DOMProperty.isCustomAttribute(lowerCasedName) ?
      lowerCasedName : DOMProperty.getPossibleStandardName[lowerCasedName];

    // For now, only warn when we have a suggested correction. This prevents
    // logging too much when using transferPropsTo.
    if (standardName != null) {
      console.warn(
        'Unknown DOM property ' + name + '. Did you mean ' + standardName + '?'
      );
    }

  };
}

/**
 * Operations for dealing with DOM properties.
 */
var DOMPropertyOperations = {

  /**
   * Creates markup for a property.
   *
   * @param {string} name
   * @param {*} value
   * @return {?string} Markup string, or null if the property was invalid.
   */
  createMarkupForProperty: function(name, value) {
    if (DOMProperty.isStandardName[name]) {
      if (shouldIgnoreValue(name, value)) {
        return '';
      }
      var attributeName = DOMProperty.getAttributeName[name];
      return processAttributeNameAndPrefix(attributeName) +
        escapeTextForBrowser(value) + '"';
    } else if (DOMProperty.isCustomAttribute(name)) {
      if (value == null) {
        return '';
      }
      return processAttributeNameAndPrefix(name) +
        escapeTextForBrowser(value) + '"';
    } else if ("production" !== process.env.NODE_ENV) {
      warnUnknownProperty(name);
    }
    return null;
  },

  /**
   * Sets the value for a property on a node.
   *
   * @param {DOMElement} node
   * @param {string} name
   * @param {*} value
   */
  setValueForProperty: function(node, name, value) {
    if (DOMProperty.isStandardName[name]) {
      var mutationMethod = DOMProperty.getMutationMethod[name];
      if (mutationMethod) {
        mutationMethod(node, value);
      } else if (shouldIgnoreValue(name, value)) {
        this.deleteValueForProperty(node, name);
      } else if (DOMProperty.mustUseAttribute[name]) {
        node.setAttribute(DOMProperty.getAttributeName[name], '' + value);
      } else {
        var propName = DOMProperty.getPropertyName[name];
        if (!DOMProperty.hasSideEffects[name] || node[propName] !== value) {
          node[propName] = value;
        }
      }
    } else if (DOMProperty.isCustomAttribute(name)) {
      if (value == null) {
        node.removeAttribute(DOMProperty.getAttributeName[name]);
      } else {
        node.setAttribute(name, '' + value);
      }
    } else if ("production" !== process.env.NODE_ENV) {
      warnUnknownProperty(name);
    }
  },

  /**
   * Deletes the value for a property on a node.
   *
   * @param {DOMElement} node
   * @param {string} name
   */
  deleteValueForProperty: function(node, name) {
    if (DOMProperty.isStandardName[name]) {
      var mutationMethod = DOMProperty.getMutationMethod[name];
      if (mutationMethod) {
        mutationMethod(node, undefined);
      } else if (DOMProperty.mustUseAttribute[name]) {
        node.removeAttribute(DOMProperty.getAttributeName[name]);
      } else {
        var propName = DOMProperty.getPropertyName[name];
        var defaultValue = DOMProperty.getDefaultValueForProperty(
          node.nodeName,
          name
        );
        if (!DOMProperty.hasSideEffects[name] ||
            node[propName] !== defaultValue) {
          node[propName] = defaultValue;
        }
      }
    } else if (DOMProperty.isCustomAttribute(name)) {
      node.removeAttribute(name);
    } else if ("production" !== process.env.NODE_ENV) {
      warnUnknownProperty(name);
    }
  }

};

module.exports = DOMPropertyOperations;

},{"./DOMProperty":14,"./escapeTextForBrowser":90,"./memoizeStringOnly":112,"__browserify_process":124}],16:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule Danger
 * @typechecks static-only
 */

/*jslint evil: true, sub: true */

"use strict";

var ExecutionEnvironment = require("./ExecutionEnvironment");

var createNodesFromMarkup = require("./createNodesFromMarkup");
var emptyFunction = require("./emptyFunction");
var getMarkupWrap = require("./getMarkupWrap");
var invariant = require("./invariant");
var mutateHTMLNodeWithMarkup = require("./mutateHTMLNodeWithMarkup");

var OPEN_TAG_NAME_EXP = /^(<[^ \/>]+)/;
var RESULT_INDEX_ATTR = 'data-danger-index';

/**
 * Extracts the `nodeName` from a string of markup.
 *
 * NOTE: Extracting the `nodeName` does not require a regular expression match
 * because we make assumptions about React-generated markup (i.e. there are no
 * spaces surrounding the opening tag and there is at least one attribute).
 *
 * @param {string} markup String of markup.
 * @return {string} Node name of the supplied markup.
 * @see http://jsperf.com/extract-nodename
 */
function getNodeName(markup) {
  return markup.substring(1, markup.indexOf(' '));
}

var Danger = {

  /**
   * Renders markup into an array of nodes. The markup is expected to render
   * into a list of root nodes. Also, the length of `resultList` and
   * `markupList` should be the same.
   *
   * @param {array<string>} markupList List of markup strings to render.
   * @return {array<DOMElement>} List of rendered nodes.
   * @internal
   */
  dangerouslyRenderMarkup: function(markupList) {
    ("production" !== process.env.NODE_ENV ? invariant(
      ExecutionEnvironment.canUseDOM,
      'dangerouslyRenderMarkup(...): Cannot render markup in a Worker ' +
      'thread. This is likely a bug in the framework. Please report ' +
      'immediately.'
    ) : invariant(ExecutionEnvironment.canUseDOM));
    var nodeName;
    var markupByNodeName = {};
    // Group markup by `nodeName` if a wrap is necessary, else by '*'.
    for (var i = 0; i < markupList.length; i++) {
      ("production" !== process.env.NODE_ENV ? invariant(
        markupList[i],
        'dangerouslyRenderMarkup(...): Missing markup.'
      ) : invariant(markupList[i]));
      nodeName = getNodeName(markupList[i]);
      nodeName = getMarkupWrap(nodeName) ? nodeName : '*';
      markupByNodeName[nodeName] = markupByNodeName[nodeName] || [];
      markupByNodeName[nodeName][i] = markupList[i];
    }
    var resultList = [];
    var resultListAssignmentCount = 0;
    for (nodeName in markupByNodeName) {
      if (!markupByNodeName.hasOwnProperty(nodeName)) {
        continue;
      }
      var markupListByNodeName = markupByNodeName[nodeName];

      // This for-in loop skips the holes of the sparse array. The order of
      // iteration should follow the order of assignment, which happens to match
      // numerical index order, but we don't rely on that.
      for (var resultIndex in markupListByNodeName) {
        if (markupListByNodeName.hasOwnProperty(resultIndex)) {
          var markup = markupListByNodeName[resultIndex];

          // Push the requested markup with an additional RESULT_INDEX_ATTR
          // attribute.  If the markup does not start with a < character, it
          // will be discarded below (with an appropriate console.error).
          markupListByNodeName[resultIndex] = markup.replace(
            OPEN_TAG_NAME_EXP,
            // This index will be parsed back out below.
            '$1 ' + RESULT_INDEX_ATTR + '="' + resultIndex + '" '
          );
        }
      }

      // Render each group of markup with similar wrapping `nodeName`.
      var renderNodes = createNodesFromMarkup(
        markupListByNodeName.join(''),
        emptyFunction // Do nothing special with <script> tags.
      );

      for (i = 0; i < renderNodes.length; ++i) {
        var renderNode = renderNodes[i];
        if (renderNode.hasAttribute &&
            renderNode.hasAttribute(RESULT_INDEX_ATTR)) {

          resultIndex = +renderNode.getAttribute(RESULT_INDEX_ATTR);
          renderNode.removeAttribute(RESULT_INDEX_ATTR);

          ("production" !== process.env.NODE_ENV ? invariant(
            !resultList.hasOwnProperty(resultIndex),
            'Danger: Assigning to an already-occupied result index.'
          ) : invariant(!resultList.hasOwnProperty(resultIndex)));

          resultList[resultIndex] = renderNode;

          // This should match resultList.length and markupList.length when
          // we're done.
          resultListAssignmentCount += 1;

        } else if ("production" !== process.env.NODE_ENV) {
          console.error(
            "Danger: Discarding unexpected node:",
            renderNode
          );
        }
      }
    }

    // Although resultList was populated out of order, it should now be a dense
    // array.
    ("production" !== process.env.NODE_ENV ? invariant(
      resultListAssignmentCount === resultList.length,
      'Danger: Did not assign to every index of resultList.'
    ) : invariant(resultListAssignmentCount === resultList.length));

    ("production" !== process.env.NODE_ENV ? invariant(
      resultList.length === markupList.length,
      'Danger: Expected markup to render %s nodes, but rendered %s.',
      markupList.length,
      resultList.length
    ) : invariant(resultList.length === markupList.length));

    return resultList;
  },

  /**
   * Replaces a node with a string of markup at its current position within its
   * parent. The markup must render into a single root node.
   *
   * @param {DOMElement} oldChild Child node to replace.
   * @param {string} markup Markup to render in place of the child node.
   * @internal
   */
  dangerouslyReplaceNodeWithMarkup: function(oldChild, markup) {
    ("production" !== process.env.NODE_ENV ? invariant(
      ExecutionEnvironment.canUseDOM,
      'dangerouslyReplaceNodeWithMarkup(...): Cannot render markup in a ' +
      'worker thread. This is likely a bug in the framework. Please report ' +
      'immediately.'
    ) : invariant(ExecutionEnvironment.canUseDOM));
    ("production" !== process.env.NODE_ENV ? invariant(markup, 'dangerouslyReplaceNodeWithMarkup(...): Missing markup.') : invariant(markup));
    // createNodesFromMarkup() won't work if the markup is rooted by <html>
    // since it has special semantic meaning. So we use an alternatie strategy.
    if (oldChild.tagName.toLowerCase() === 'html') {
      mutateHTMLNodeWithMarkup(oldChild, markup);
      return;
    }
    var newChild = createNodesFromMarkup(markup, emptyFunction)[0];
    oldChild.parentNode.replaceChild(newChild, oldChild);
  }

};

module.exports = Danger;

},{"./ExecutionEnvironment":26,"./createNodesFromMarkup":86,"./emptyFunction":89,"./getMarkupWrap":98,"./invariant":104,"./mutateHTMLNodeWithMarkup":117,"__browserify_process":124}],17:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule DefaultDOMPropertyConfig
 */

/*jslint bitwise: true*/

"use strict";

var DOMProperty = require("./DOMProperty");

var MUST_USE_ATTRIBUTE = DOMProperty.injection.MUST_USE_ATTRIBUTE;
var MUST_USE_PROPERTY = DOMProperty.injection.MUST_USE_PROPERTY;
var HAS_BOOLEAN_VALUE = DOMProperty.injection.HAS_BOOLEAN_VALUE;
var HAS_SIDE_EFFECTS = DOMProperty.injection.HAS_SIDE_EFFECTS;
var HAS_POSITIVE_NUMERIC_VALUE =
  DOMProperty.injection.HAS_POSITIVE_NUMERIC_VALUE;

var DefaultDOMPropertyConfig = {
  isCustomAttribute: RegExp.prototype.test.bind(
    /^(data|aria)-[a-z_][a-z\d_.\-]*$/
  ),
  Properties: {
    /**
     * Standard Properties
     */
    accept: null,
    accessKey: null,
    action: null,
    allowFullScreen: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    allowTransparency: MUST_USE_ATTRIBUTE,
    alt: null,
    async: HAS_BOOLEAN_VALUE,
    autoComplete: null,
    autoFocus: HAS_BOOLEAN_VALUE,
    autoPlay: HAS_BOOLEAN_VALUE,
    cellPadding: null,
    cellSpacing: null,
    charSet: MUST_USE_ATTRIBUTE,
    checked: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    className: MUST_USE_PROPERTY,
    cols: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    colSpan: null,
    content: null,
    contentEditable: null,
    contextMenu: MUST_USE_ATTRIBUTE,
    controls: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    data: null, // For `<object />` acts as `src`.
    dateTime: MUST_USE_ATTRIBUTE,
    defer: HAS_BOOLEAN_VALUE,
    dir: null,
    disabled: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    draggable: null,
    encType: null,
    form: MUST_USE_ATTRIBUTE,
    frameBorder: MUST_USE_ATTRIBUTE,
    height: MUST_USE_ATTRIBUTE,
    hidden: MUST_USE_ATTRIBUTE | HAS_BOOLEAN_VALUE,
    href: null,
    htmlFor: null,
    httpEquiv: null,
    icon: null,
    id: MUST_USE_PROPERTY,
    label: null,
    lang: null,
    list: null,
    loop: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    max: null,
    maxLength: MUST_USE_ATTRIBUTE,
    method: null,
    min: null,
    multiple: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    name: null,
    pattern: null,
    placeholder: null,
    poster: null,
    preload: null,
    radioGroup: null,
    readOnly: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    rel: null,
    required: HAS_BOOLEAN_VALUE,
    role: MUST_USE_ATTRIBUTE,
    rows: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    rowSpan: null,
    scrollLeft: MUST_USE_PROPERTY,
    scrollTop: MUST_USE_PROPERTY,
    selected: MUST_USE_PROPERTY | HAS_BOOLEAN_VALUE,
    size: MUST_USE_ATTRIBUTE | HAS_POSITIVE_NUMERIC_VALUE,
    spellCheck: null,
    src: null,
    step: null,
    style: null,
    tabIndex: null,
    target: null,
    title: null,
    type: null,
    value: MUST_USE_PROPERTY | HAS_SIDE_EFFECTS,
    width: MUST_USE_ATTRIBUTE,
    wmode: MUST_USE_ATTRIBUTE,

    /**
     * Non-standard Properties
     */
    autoCapitalize: null, // Supported in Mobile Safari for keyboard hints
    autoCorrect: null, // Supported in Mobile Safari for keyboard hints

    /**
     * SVG Properties
     */
    cx: MUST_USE_ATTRIBUTE,
    cy: MUST_USE_ATTRIBUTE,
    d: MUST_USE_ATTRIBUTE,
    fill: MUST_USE_ATTRIBUTE,
    fx: MUST_USE_ATTRIBUTE,
    fy: MUST_USE_ATTRIBUTE,
    gradientTransform: MUST_USE_ATTRIBUTE,
    gradientUnits: MUST_USE_ATTRIBUTE,
    offset: MUST_USE_ATTRIBUTE,
    points: MUST_USE_ATTRIBUTE,
    r: MUST_USE_ATTRIBUTE,
    rx: MUST_USE_ATTRIBUTE,
    ry: MUST_USE_ATTRIBUTE,
    spreadMethod: MUST_USE_ATTRIBUTE,
    stopColor: MUST_USE_ATTRIBUTE,
    stopOpacity: MUST_USE_ATTRIBUTE,
    stroke: MUST_USE_ATTRIBUTE,
    strokeLinecap: MUST_USE_ATTRIBUTE,
    strokeWidth: MUST_USE_ATTRIBUTE,
    transform: MUST_USE_ATTRIBUTE,
    version: MUST_USE_ATTRIBUTE,
    viewBox: MUST_USE_ATTRIBUTE,
    x1: MUST_USE_ATTRIBUTE,
    x2: MUST_USE_ATTRIBUTE,
    x: MUST_USE_ATTRIBUTE,
    y1: MUST_USE_ATTRIBUTE,
    y2: MUST_USE_ATTRIBUTE,
    y: MUST_USE_ATTRIBUTE
  },
  DOMAttributeNames: {
    className: 'class',
    gradientTransform: 'gradientTransform',
    gradientUnits: 'gradientUnits',
    htmlFor: 'for',
    spreadMethod: 'spreadMethod',
    stopColor: 'stop-color',
    stopOpacity: 'stop-opacity',
    strokeLinecap: 'stroke-linecap',
    strokeWidth: 'stroke-width',
    viewBox: 'viewBox'
  },
  DOMPropertyNames: {
    autoCapitalize: 'autocapitalize',
    autoComplete: 'autocomplete',
    autoCorrect: 'autocorrect',
    autoFocus: 'autofocus',
    autoPlay: 'autoplay',
    encType: 'enctype',
    radioGroup: 'radiogroup',
    spellCheck: 'spellcheck'
  },
  DOMMutationMethods: {
    /**
     * Setting `className` to null may cause it to be set to the string "null".
     *
     * @param {DOMElement} node
     * @param {*} value
     */
    className: function(node, value) {
      node.className = value || '';
    }
  }
};

module.exports = DefaultDOMPropertyConfig;

},{"./DOMProperty":14}],18:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule DefaultEventPluginOrder
 */

"use strict";

 var keyOf = require("./keyOf");

/**
 * Module that is injectable into `EventPluginHub`, that specifies a
 * deterministic ordering of `EventPlugin`s. A convenient way to reason about
 * plugins, without having to package every one of them. This is better than
 * having plugins be ordered in the same order that they are injected because
 * that ordering would be influenced by the packaging order.
 * `ResponderEventPlugin` must occur before `SimpleEventPlugin` so that
 * preventing default on events is convenient in `SimpleEventPlugin` handlers.
 */
var DefaultEventPluginOrder = [
  keyOf({ResponderEventPlugin: null}),
  keyOf({SimpleEventPlugin: null}),
  keyOf({TapEventPlugin: null}),
  keyOf({EnterLeaveEventPlugin: null}),
  keyOf({ChangeEventPlugin: null}),
  keyOf({SelectEventPlugin: null}),
  keyOf({CompositionEventPlugin: null}),
  keyOf({AnalyticsEventPlugin: null}),
  keyOf({MobileSafariClickEventPlugin: null})
];

module.exports = DefaultEventPluginOrder;

},{"./keyOf":111}],19:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule EnterLeaveEventPlugin
 * @typechecks static-only
 */

"use strict";

var EventConstants = require("./EventConstants");
var EventPropagators = require("./EventPropagators");
var SyntheticMouseEvent = require("./SyntheticMouseEvent");

var ReactMount = require("./ReactMount");
var keyOf = require("./keyOf");

var topLevelTypes = EventConstants.topLevelTypes;
var getFirstReactDOM = ReactMount.getFirstReactDOM;

var eventTypes = {
  mouseEnter: {registrationName: keyOf({onMouseEnter: null})},
  mouseLeave: {registrationName: keyOf({onMouseLeave: null})}
};

var extractedEvents = [null, null];

var EnterLeaveEventPlugin = {

  eventTypes: eventTypes,

  /**
   * For almost every interaction we care about, there will be both a top-level
   * `mouseover` and `mouseout` event that occurs. Only use `mouseout` so that
   * we do not extract duplicate events. However, moving the mouse into the
   * browser from outside will not fire a `mouseout` event. In this case, we use
   * the `mouseover` top-level event.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    if (topLevelType === topLevelTypes.topMouseOver &&
        (nativeEvent.relatedTarget || nativeEvent.fromElement)) {
      return null;
    }
    if (topLevelType !== topLevelTypes.topMouseOut &&
        topLevelType !== topLevelTypes.topMouseOver) {
      // Must not be a mouse in or mouse out - ignoring.
      return null;
    }

    var from, to;
    if (topLevelType === topLevelTypes.topMouseOut) {
      from = topLevelTarget;
      to =
        getFirstReactDOM(nativeEvent.relatedTarget || nativeEvent.toElement) ||
        window;
    } else {
      from = window;
      to = topLevelTarget;
    }

    if (from === to) {
      // Nothing pertains to our managed components.
      return null;
    }

    var fromID = from ? ReactMount.getID(from) : '';
    var toID = to ? ReactMount.getID(to) : '';

    var leave = SyntheticMouseEvent.getPooled(
      eventTypes.mouseLeave,
      fromID,
      nativeEvent
    );
    var enter = SyntheticMouseEvent.getPooled(
      eventTypes.mouseEnter,
      toID,
      nativeEvent
    );

    EventPropagators.accumulateEnterLeaveDispatches(leave, enter, fromID, toID);

    extractedEvents[0] = leave;
    extractedEvents[1] = enter;

    return extractedEvents;
  }

};

module.exports = EnterLeaveEventPlugin;

},{"./EventConstants":20,"./EventPropagators":25,"./ReactMount":56,"./SyntheticMouseEvent":75,"./keyOf":111}],20:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule EventConstants
 */

"use strict";

var keyMirror = require("./keyMirror");

var PropagationPhases = keyMirror({bubbled: null, captured: null});

/**
 * Types of raw signals from the browser caught at the top level.
 */
var topLevelTypes = keyMirror({
  topBlur: null,
  topChange: null,
  topClick: null,
  topCompositionEnd: null,
  topCompositionStart: null,
  topCompositionUpdate: null,
  topContextMenu: null,
  topCopy: null,
  topCut: null,
  topDoubleClick: null,
  topDrag: null,
  topDragEnd: null,
  topDragEnter: null,
  topDragExit: null,
  topDragLeave: null,
  topDragOver: null,
  topDragStart: null,
  topDrop: null,
  topFocus: null,
  topInput: null,
  topKeyDown: null,
  topKeyPress: null,
  topKeyUp: null,
  topMouseDown: null,
  topMouseMove: null,
  topMouseOut: null,
  topMouseOver: null,
  topMouseUp: null,
  topPaste: null,
  topScroll: null,
  topSelectionChange: null,
  topSubmit: null,
  topTouchCancel: null,
  topTouchEnd: null,
  topTouchMove: null,
  topTouchStart: null,
  topWheel: null
});

var EventConstants = {
  topLevelTypes: topLevelTypes,
  PropagationPhases: PropagationPhases
};

module.exports = EventConstants;

},{"./keyMirror":110}],21:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule EventListener
 */

/**
 * Upstream version of event listener. Does not take into account specific
 * nature of platform.
 */
var EventListener = {
  /**
   * Listens to bubbled events on a DOM node.
   *
   * @param {Element} el DOM element to register listener on.
   * @param {string} handlerBaseName 'click'/'mouseover'
   * @param {Function!} cb Callback function
   */
  listen: function(el, handlerBaseName, cb) {
    if (el.addEventListener) {
      el.addEventListener(handlerBaseName, cb, false);
    } else if (el.attachEvent) {
      el.attachEvent('on' + handlerBaseName, cb);
    }
  },

  /**
   * Listens to captured events on a DOM node.
   *
   * @see `EventListener.listen` for params.
   * @throws Exception if addEventListener is not supported.
   */
  capture: function(el, handlerBaseName, cb) {
    if (!el.addEventListener) {
      if ("production" !== process.env.NODE_ENV) {
        console.error(
          'You are attempting to use addEventListener ' +
          'in a browser that does not support it.' +
          'This likely means that you will not receive events that ' +
          'your application relies on (such as scroll).');
      }
      return;
    } else {
      el.addEventListener(handlerBaseName, cb, true);
    }
  }
};

module.exports = EventListener;

},{"__browserify_process":124}],22:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule EventPluginHub
 */

"use strict";

var CallbackRegistry = require("./CallbackRegistry");
var EventPluginRegistry = require("./EventPluginRegistry");
var EventPluginUtils = require("./EventPluginUtils");
var EventPropagators = require("./EventPropagators");
var ExecutionEnvironment = require("./ExecutionEnvironment");

var accumulate = require("./accumulate");
var forEachAccumulated = require("./forEachAccumulated");
var invariant = require("./invariant");

/**
 * Internal queue of events that have accumulated their dispatches and are
 * waiting to have their dispatches executed.
 */
var eventQueue = null;

/**
 * Dispatches an event and releases it back into the pool, unless persistent.
 *
 * @param {?object} event Synthetic event to be dispatched.
 * @private
 */
var executeDispatchesAndRelease = function(event) {
  if (event) {
    var executeDispatch = EventPluginUtils.executeDispatch;
    // Plugins can provide custom behavior when dispatching events.
    var PluginModule = EventPluginRegistry.getPluginModuleForEvent(event);
    if (PluginModule && PluginModule.executeDispatch) {
      executeDispatch = PluginModule.executeDispatch;
    }
    EventPluginUtils.executeDispatchesInOrder(event, executeDispatch);

    if (!event.isPersistent()) {
      event.constructor.release(event);
    }
  }
};

/**
 * This is a unified interface for event plugins to be installed and configured.
 *
 * Event plugins can implement the following properties:
 *
 *   `extractEvents` {function(string, DOMEventTarget, string, object): *}
 *     Required. When a top-level event is fired, this method is expected to
 *     extract synthetic events that will in turn be queued and dispatched.
 *
 *   `eventTypes` {object}
 *     Optional, plugins that fire events must publish a mapping of registration
 *     names that are used to register listeners. Values of this mapping must
 *     be objects that contain `registrationName` or `phasedRegistrationNames`.
 *
 *   `executeDispatch` {function(object, function, string)}
 *     Optional, allows plugins to override how an event gets dispatched. By
 *     default, the listener is simply invoked.
 *
 * Each plugin that is injected into `EventsPluginHub` is immediately operable.
 *
 * @public
 */
var EventPluginHub = {

  /**
   * Methods for injecting dependencies.
   */
  injection: {

    /**
     * @param {object} InjectedInstanceHandle
     * @public
     */
    injectInstanceHandle: EventPropagators.injection.injectInstanceHandle,

    /**
     * @param {array} InjectedEventPluginOrder
     * @public
     */
    injectEventPluginOrder: EventPluginRegistry.injectEventPluginOrder,

    /**
     * @param {object} injectedNamesToPlugins Map from names to plugin modules.
     */
    injectEventPluginsByName: EventPluginRegistry.injectEventPluginsByName

  },

  registrationNames: EventPluginRegistry.registrationNames,

  putListener: CallbackRegistry.putListener,

  getListener: CallbackRegistry.getListener,

  deleteListener: CallbackRegistry.deleteListener,

  deleteAllListeners: CallbackRegistry.deleteAllListeners,

  /**
   * Allows registered plugins an opportunity to extract events from top-level
   * native browser events.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @internal
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    var events;
    var plugins = EventPluginRegistry.plugins;
    for (var i = 0, l = plugins.length; i < l; i++) {
      // Not every plugin in the ordering may be loaded at runtime.
      var possiblePlugin = plugins[i];
      if (possiblePlugin) {
        var extractedEvents = possiblePlugin.extractEvents(
          topLevelType,
          topLevelTarget,
          topLevelTargetID,
          nativeEvent
        );
        if (extractedEvents) {
          events = accumulate(events, extractedEvents);
        }
      }
    }
    return events;
  },

  /**
   * Enqueues a synthetic event that should be dispatched when
   * `processEventQueue` is invoked.
   *
   * @param {*} events An accumulation of synthetic events.
   * @internal
   */
  enqueueEvents: function(events) {
    if (events) {
      eventQueue = accumulate(eventQueue, events);
    }
  },

  /**
   * Dispatches all synthetic events on the event queue.
   *
   * @internal
   */
  processEventQueue: function() {
    // Set `eventQueue` to null before processing it so that we can tell if more
    // events get enqueued while processing.
    var processingEventQueue = eventQueue;
    eventQueue = null;
    forEachAccumulated(processingEventQueue, executeDispatchesAndRelease);
    ("production" !== process.env.NODE_ENV ? invariant(
      !eventQueue,
      'processEventQueue(): Additional events were enqueued while processing ' +
      'an event queue. Support for this has not yet been implemented.'
    ) : invariant(!eventQueue));
  }

};

if (ExecutionEnvironment.canUseDOM) {
  window.EventPluginHub = EventPluginHub;
}

module.exports = EventPluginHub;

},{"./CallbackRegistry":10,"./EventPluginRegistry":23,"./EventPluginUtils":24,"./EventPropagators":25,"./ExecutionEnvironment":26,"./accumulate":81,"./forEachAccumulated":94,"./invariant":104,"__browserify_process":124}],23:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule EventPluginRegistry
 * @typechecks static-only
 */

"use strict";

var invariant = require("./invariant");

/**
 * Injectable ordering of event plugins.
 */
var EventPluginOrder = null;

/**
 * Injectable mapping from names to event plugin modules.
 */
var namesToPlugins = {};

/**
 * Recomputes the plugin list using the injected plugins and plugin ordering.
 *
 * @private
 */
function recomputePluginOrdering() {
  if (!EventPluginOrder) {
    // Wait until an `EventPluginOrder` is injected.
    return;
  }
  for (var pluginName in namesToPlugins) {
    var PluginModule = namesToPlugins[pluginName];
    var pluginIndex = EventPluginOrder.indexOf(pluginName);
    ("production" !== process.env.NODE_ENV ? invariant(
      pluginIndex > -1,
      'EventPluginRegistry: Cannot inject event plugins that do not exist in ' +
      'the plugin ordering, `%s`.',
      pluginName
    ) : invariant(pluginIndex > -1));
    if (EventPluginRegistry.plugins[pluginIndex]) {
      continue;
    }
    ("production" !== process.env.NODE_ENV ? invariant(
      PluginModule.extractEvents,
      'EventPluginRegistry: Event plugins must implement an `extractEvents` ' +
      'method, but `%s` does not.',
      pluginName
    ) : invariant(PluginModule.extractEvents));
    EventPluginRegistry.plugins[pluginIndex] = PluginModule;
    var publishedEvents = PluginModule.eventTypes;
    for (var eventName in publishedEvents) {
      ("production" !== process.env.NODE_ENV ? invariant(
        publishEventForPlugin(publishedEvents[eventName], PluginModule),
        'EventPluginRegistry: Failed to publish event `%s` for plugin `%s`.',
        eventName,
        pluginName
      ) : invariant(publishEventForPlugin(publishedEvents[eventName], PluginModule)));
    }
  }
}

/**
 * Publishes an event so that it can be dispatched by the supplied plugin.
 *
 * @param {object} dispatchConfig Dispatch configuration for the event.
 * @param {object} PluginModule Plugin publishing the event.
 * @return {boolean} True if the event was successfully published.
 * @private
 */
function publishEventForPlugin(dispatchConfig, PluginModule) {
  var phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;
  if (phasedRegistrationNames) {
    for (var phaseName in phasedRegistrationNames) {
      if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
        var phasedRegistrationName = phasedRegistrationNames[phaseName];
        publishRegistrationName(phasedRegistrationName, PluginModule);
      }
    }
    return true;
  } else if (dispatchConfig.registrationName) {
    publishRegistrationName(dispatchConfig.registrationName, PluginModule);
    return true;
  }
  return false;
}

/**
 * Publishes a registration name that is used to identify dispatched events and
 * can be used with `EventPluginHub.putListener` to register listeners.
 *
 * @param {string} registrationName Registration name to add.
 * @param {object} PluginModule Plugin publishing the event.
 * @private
 */
function publishRegistrationName(registrationName, PluginModule) {
  ("production" !== process.env.NODE_ENV ? invariant(
    !EventPluginRegistry.registrationNames[registrationName],
    'EventPluginHub: More than one plugin attempted to publish the same ' +
    'registration name, `%s`.',
    registrationName
  ) : invariant(!EventPluginRegistry.registrationNames[registrationName]));
  EventPluginRegistry.registrationNames[registrationName] = PluginModule;
}

/**
 * Registers plugins so that they can extract and dispatch events.
 *
 * @see {EventPluginHub}
 */
var EventPluginRegistry = {

  /**
   * Ordered list of injected plugins.
   */
  plugins: [],

  /**
   * Mapping from registration names to plugin modules.
   */
  registrationNames: {},

  /**
   * Injects an ordering of plugins (by plugin name). This allows the ordering
   * to be decoupled from injection of the actual plugins so that ordering is
   * always deterministic regardless of packaging, on-the-fly injection, etc.
   *
   * @param {array} InjectedEventPluginOrder
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginOrder}
   */
  injectEventPluginOrder: function(InjectedEventPluginOrder) {
    ("production" !== process.env.NODE_ENV ? invariant(
      !EventPluginOrder,
      'EventPluginRegistry: Cannot inject event plugin ordering more than once.'
    ) : invariant(!EventPluginOrder));
    // Clone the ordering so it cannot be dynamically mutated.
    EventPluginOrder = Array.prototype.slice.call(InjectedEventPluginOrder);
    recomputePluginOrdering();
  },

  /**
   * Injects plugins to be used by `EventPluginHub`. The plugin names must be
   * in the ordering injected by `injectEventPluginOrder`.
   *
   * Plugins can be injected as part of page initialization or on-the-fly.
   *
   * @param {object} injectedNamesToPlugins Map from names to plugin modules.
   * @internal
   * @see {EventPluginHub.injection.injectEventPluginsByName}
   */
  injectEventPluginsByName: function(injectedNamesToPlugins) {
    var isOrderingDirty = false;
    for (var pluginName in injectedNamesToPlugins) {
      if (!injectedNamesToPlugins.hasOwnProperty(pluginName)) {
        continue;
      }
      var PluginModule = injectedNamesToPlugins[pluginName];
      if (namesToPlugins[pluginName] !== PluginModule) {
        ("production" !== process.env.NODE_ENV ? invariant(
          !namesToPlugins[pluginName],
          'EventPluginRegistry: Cannot inject two different event plugins ' +
          'using the same name, `%s`.',
          pluginName
        ) : invariant(!namesToPlugins[pluginName]));
        namesToPlugins[pluginName] = PluginModule;
        isOrderingDirty = true;
      }
    }
    if (isOrderingDirty) {
      recomputePluginOrdering();
    }
  },

  /**
   * Looks up the plugin for the supplied event.
   *
   * @param {object} event A synthetic event.
   * @return {?object} The plugin that created the supplied event.
   * @internal
   */
  getPluginModuleForEvent: function(event) {
    var dispatchConfig = event.dispatchConfig;
    if (dispatchConfig.registrationName) {
      return EventPluginRegistry.registrationNames[
        dispatchConfig.registrationName
      ] || null;
    }
    for (var phase in dispatchConfig.phasedRegistrationNames) {
      if (!dispatchConfig.phasedRegistrationNames.hasOwnProperty(phase)) {
        continue;
      }
      var PluginModule = EventPluginRegistry.registrationNames[
        dispatchConfig.phasedRegistrationNames[phase]
      ];
      if (PluginModule) {
        return PluginModule;
      }
    }
    return null;
  },

  /**
   * Exposed for unit testing.
   * @private
   */
  _resetEventPlugins: function() {
    EventPluginOrder = null;
    for (var pluginName in namesToPlugins) {
      if (namesToPlugins.hasOwnProperty(pluginName)) {
        delete namesToPlugins[pluginName];
      }
    }
    EventPluginRegistry.plugins.length = 0;
    var registrationNames = EventPluginRegistry.registrationNames;
    for (var registrationName in registrationNames) {
      if (registrationNames.hasOwnProperty(registrationName)) {
        delete registrationNames[registrationName];
      }
    }
  }

};

module.exports = EventPluginRegistry;

},{"./invariant":104,"__browserify_process":124}],24:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule EventPluginUtils
 */

"use strict";

var EventConstants = require("./EventConstants");

var invariant = require("./invariant");

var topLevelTypes = EventConstants.topLevelTypes;

function isEndish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseUp ||
         topLevelType === topLevelTypes.topTouchEnd ||
         topLevelType === topLevelTypes.topTouchCancel;
}

function isMoveish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseMove ||
         topLevelType === topLevelTypes.topTouchMove;
}
function isStartish(topLevelType) {
  return topLevelType === topLevelTypes.topMouseDown ||
         topLevelType === topLevelTypes.topTouchStart;
}

var validateEventDispatches;
if ("production" !== process.env.NODE_ENV) {
  validateEventDispatches = function(event) {
    var dispatchListeners = event._dispatchListeners;
    var dispatchIDs = event._dispatchIDs;

    var listenersIsArr = Array.isArray(dispatchListeners);
    var idsIsArr = Array.isArray(dispatchIDs);
    var IDsLen = idsIsArr ? dispatchIDs.length : dispatchIDs ? 1 : 0;
    var listenersLen = listenersIsArr ?
      dispatchListeners.length :
      dispatchListeners ? 1 : 0;

    ("production" !== process.env.NODE_ENV ? invariant(
      idsIsArr === listenersIsArr && IDsLen === listenersLen,
      'EventPluginUtils: Invalid `event`.'
    ) : invariant(idsIsArr === listenersIsArr && IDsLen === listenersLen));
  };
}

/**
 * Invokes `cb(event, listener, id)`. Avoids using call if no scope is
 * provided. The `(listener,id)` pair effectively forms the "dispatch" but are
 * kept separate to conserve memory.
 */
function forEachEventDispatch(event, cb) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchIDs = event._dispatchIDs;
  if ("production" !== process.env.NODE_ENV) {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      // Listeners and IDs are two parallel arrays that are always in sync.
      cb(event, dispatchListeners[i], dispatchIDs[i]);
    }
  } else if (dispatchListeners) {
    cb(event, dispatchListeners, dispatchIDs);
  }
}

/**
 * Default implementation of PluginModule.executeDispatch().
 * @param {SyntheticEvent} SyntheticEvent to handle
 * @param {function} Application-level callback
 * @param {string} domID DOM id to pass to the callback.
 */
function executeDispatch(event, listener, domID) {
  listener(event, domID);
}

/**
 * Standard/simple iteration through an event's collected dispatches.
 */
function executeDispatchesInOrder(event, executeDispatch) {
  forEachEventDispatch(event, executeDispatch);
  event._dispatchListeners = null;
  event._dispatchIDs = null;
}

/**
 * Standard/simple iteration through an event's collected dispatches, but stops
 * at the first dispatch execution returning true, and returns that id.
 *
 * @return id of the first dispatch execution who's listener returns true, or
 * null if no listener returned true.
 */
function executeDispatchesInOrderStopAtTrue(event) {
  var dispatchListeners = event._dispatchListeners;
  var dispatchIDs = event._dispatchIDs;
  if ("production" !== process.env.NODE_ENV) {
    validateEventDispatches(event);
  }
  if (Array.isArray(dispatchListeners)) {
    for (var i = 0; i < dispatchListeners.length; i++) {
      if (event.isPropagationStopped()) {
        break;
      }
      // Listeners and IDs are two parallel arrays that are always in sync.
      if (dispatchListeners[i](event, dispatchIDs[i])) {
        return dispatchIDs[i];
      }
    }
  } else if (dispatchListeners) {
    if (dispatchListeners(event, dispatchIDs)) {
      return dispatchIDs;
    }
  }
  return null;
}

/**
 * Execution of a "direct" dispatch - there must be at most one dispatch
 * accumulated on the event or it is considered an error. It doesn't really make
 * sense for an event with multiple dispatches (bubbled) to keep track of the
 * return values at each dispatch execution, but it does tend to make sense when
 * dealing with "direct" dispatches.
 *
 * @return The return value of executing the single dispatch.
 */
function executeDirectDispatch(event) {
  if ("production" !== process.env.NODE_ENV) {
    validateEventDispatches(event);
  }
  var dispatchListener = event._dispatchListeners;
  var dispatchID = event._dispatchIDs;
  ("production" !== process.env.NODE_ENV ? invariant(
    !Array.isArray(dispatchListener),
    'executeDirectDispatch(...): Invalid `event`.'
  ) : invariant(!Array.isArray(dispatchListener)));
  var res = dispatchListener ?
    dispatchListener(event, dispatchID) :
    null;
  event._dispatchListeners = null;
  event._dispatchIDs = null;
  return res;
}

/**
 * @param {SyntheticEvent} event
 * @return {bool} True iff number of dispatches accumulated is greater than 0.
 */
function hasDispatches(event) {
  return !!event._dispatchListeners;
}

/**
 * General utilities that are useful in creating custom Event Plugins.
 */
var EventPluginUtils = {
  isEndish: isEndish,
  isMoveish: isMoveish,
  isStartish: isStartish,
  executeDispatchesInOrder: executeDispatchesInOrder,
  executeDispatchesInOrderStopAtTrue: executeDispatchesInOrderStopAtTrue,
  executeDirectDispatch: executeDirectDispatch,
  hasDispatches: hasDispatches,
  executeDispatch: executeDispatch
};

module.exports = EventPluginUtils;

},{"./EventConstants":20,"./invariant":104,"__browserify_process":124}],25:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule EventPropagators
 */

"use strict";

var CallbackRegistry = require("./CallbackRegistry");
var EventConstants = require("./EventConstants");

var accumulate = require("./accumulate");
var forEachAccumulated = require("./forEachAccumulated");
var getListener = CallbackRegistry.getListener;
var PropagationPhases = EventConstants.PropagationPhases;

/**
 * Injected dependencies:
 */

/**
 * - `InstanceHandle`: [required] Module that performs logical traversals of DOM
 *   hierarchy given ids of the logical DOM elements involved.
 */
var injection = {
  InstanceHandle: null,
  injectInstanceHandle: function(InjectedInstanceHandle) {
    injection.InstanceHandle = InjectedInstanceHandle;
    if ("production" !== process.env.NODE_ENV) {
      injection.validate();
    }
  },
  validate: function() {
    var invalid = !injection.InstanceHandle||
      !injection.InstanceHandle.traverseTwoPhase ||
      !injection.InstanceHandle.traverseEnterLeave;
    if (invalid) {
      throw new Error('InstanceHandle not injected before use!');
    }
  }
};

/**
 * Some event types have a notion of different registration names for different
 * "phases" of propagation. This finds listeners by a given phase.
 */
function listenerAtPhase(id, event, propagationPhase) {
  var registrationName =
    event.dispatchConfig.phasedRegistrationNames[propagationPhase];
  return getListener(id, registrationName);
}

/**
 * Tags a `SyntheticEvent` with dispatched listeners. Creating this function
 * here, allows us to not have to bind or create functions for each event.
 * Mutating the event's members allows us to not have to create a wrapping
 * "dispatch" object that pairs the event with the listener.
 */
function accumulateDirectionalDispatches(domID, upwards, event) {
  if ("production" !== process.env.NODE_ENV) {
    if (!domID) {
      throw new Error('Dispatching id must not be null');
    }
    injection.validate();
  }
  var phase = upwards ? PropagationPhases.bubbled : PropagationPhases.captured;
  var listener = listenerAtPhase(domID, event, phase);
  if (listener) {
    event._dispatchListeners = accumulate(event._dispatchListeners, listener);
    event._dispatchIDs = accumulate(event._dispatchIDs, domID);
  }
}

/**
 * Collect dispatches (must be entirely collected before dispatching - see unit
 * tests). Lazily allocate the array to conserve memory.  We must loop through
 * each event and perform the traversal for each one. We can not perform a
 * single traversal for the entire collection of events because each event may
 * have a different target.
 */
function accumulateTwoPhaseDispatchesSingle(event) {
  if (event && event.dispatchConfig.phasedRegistrationNames) {
    injection.InstanceHandle.traverseTwoPhase(
      event.dispatchMarker,
      accumulateDirectionalDispatches,
      event
    );
  }
}


/**
 * Accumulates without regard to direction, does not look for phased
 * registration names. Same as `accumulateDirectDispatchesSingle` but without
 * requiring that the `dispatchMarker` be the same as the dispatched ID.
 */
function accumulateDispatches(id, ignoredDirection, event) {
  if (event && event.dispatchConfig.registrationName) {
    var registrationName = event.dispatchConfig.registrationName;
    var listener = getListener(id, registrationName);
    if (listener) {
      event._dispatchListeners = accumulate(event._dispatchListeners, listener);
      event._dispatchIDs = accumulate(event._dispatchIDs, id);
    }
  }
}

/**
 * Accumulates dispatches on an `SyntheticEvent`, but only for the
 * `dispatchMarker`.
 * @param {SyntheticEvent} event
 */
function accumulateDirectDispatchesSingle(event) {
  if (event && event.dispatchConfig.registrationName) {
    accumulateDispatches(event.dispatchMarker, null, event);
  }
}

function accumulateTwoPhaseDispatches(events) {
  if ("production" !== process.env.NODE_ENV) {
    injection.validate();
  }
  forEachAccumulated(events, accumulateTwoPhaseDispatchesSingle);
}

function accumulateEnterLeaveDispatches(leave, enter, fromID, toID) {
  if ("production" !== process.env.NODE_ENV) {
    injection.validate();
  }
  injection.InstanceHandle.traverseEnterLeave(
    fromID,
    toID,
    accumulateDispatches,
    leave,
    enter
  );
}


function accumulateDirectDispatches(events) {
  if ("production" !== process.env.NODE_ENV) {
    injection.validate();
  }
  forEachAccumulated(events, accumulateDirectDispatchesSingle);
}



/**
 * A small set of propagation patterns, each of which will accept a small amount
 * of information, and generate a set of "dispatch ready event objects" - which
 * are sets of events that have already been annotated with a set of dispatched
 * listener functions/ids. The API is designed this way to discourage these
 * propagation strategies from actually executing the dispatches, since we
 * always want to collect the entire set of dispatches before executing event a
 * single one.
 *
 * @constructor EventPropagators
 */
var EventPropagators = {
  accumulateTwoPhaseDispatches: accumulateTwoPhaseDispatches,
  accumulateDirectDispatches: accumulateDirectDispatches,
  accumulateEnterLeaveDispatches: accumulateEnterLeaveDispatches,
  injection: injection
};

module.exports = EventPropagators;

},{"./CallbackRegistry":10,"./EventConstants":20,"./accumulate":81,"./forEachAccumulated":94,"__browserify_process":124}],26:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ExecutionEnvironment
 */

/*jslint evil: true */

"use strict";

var canUseDOM = typeof window !== 'undefined';

/**
 * Simple, lightweight module assisting with the detection and context of
 * Worker. Helps avoid circular dependencies and allows code to reason about
 * whether or not they are in a Worker, even if they never include the main
 * `ReactWorker` dependency.
 */
var ExecutionEnvironment = {

  canUseDOM: canUseDOM,

  canUseWorkers: typeof Worker !== 'undefined',

  isInWorker: !canUseDOM // For now, this is true - might change in the future.

};

module.exports = ExecutionEnvironment;

},{}],27:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule LinkedValueMixin
 * @typechecks static-only
 */

"use strict";

var invariant = require("./invariant");

/**
 * Provide a linked `value` attribute for controlled forms. You should not use
 * this outside of the ReactDOM controlled form components.
 */
var LinkedValueMixin = {
  _assertLink: function() {
    ("production" !== process.env.NODE_ENV ? invariant(
      this.props.value == null && this.props.onChange == null,
      'Cannot provide a valueLink and a value or onChange event. If you ' +
        'want to use value or onChange, you probably don\'t want to use ' +
        'valueLink'
    ) : invariant(this.props.value == null && this.props.onChange == null));
  },

  /**
   * @return {*} current value of the input either from value prop or link.
   */
  getValue: function() {
    if (this.props.valueLink) {
      this._assertLink();
      return this.props.valueLink.value;
    }
    return this.props.value;
  },

  /**
   * @return {function} change callback either from onChange prop or link.
   */
  getOnChange: function() {
    if (this.props.valueLink) {
      this._assertLink();
      return this._handleLinkedValueChange;
    }
    return this.props.onChange;
  },

  /**
   * @param {SyntheticEvent} e change event to handle
   */
  _handleLinkedValueChange: function(e) {
    this.props.valueLink.requestChange(e.target.value);
  }
};

module.exports = LinkedValueMixin;

},{"./invariant":104,"__browserify_process":124}],28:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule MobileSafariClickEventPlugin
 * @typechecks static-only
 */

"use strict";

var EventConstants = require("./EventConstants");

var emptyFunction = require("./emptyFunction");

var topLevelTypes = EventConstants.topLevelTypes;

/**
 * Mobile Safari does not fire properly bubble click events on non-interactive
 * elements, which means delegated click listeners do not fire. The workaround
 * for this bug involves attaching an empty click listener on the target node.
 *
 * This particular plugin works around the bug by attaching an empty click
 * listener on `touchstart` (which does fire on every element).
 */
var MobileSafariClickEventPlugin = {

  eventTypes: null,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    if (topLevelType === topLevelTypes.topTouchStart) {
      var target = nativeEvent.target;
      if (target && !target.onclick) {
        target.onclick = emptyFunction;
      }
    }
  }

};

module.exports = MobileSafariClickEventPlugin;

},{"./EventConstants":20,"./emptyFunction":89}],29:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule PooledClass
 */

"use strict";

/**
 * Static poolers. Several custom versions for each potential number of
 * arguments. A completely generic pooler is easy to implement, but would
 * require accessing the `arguments` object. In each of these, `this` refers to
 * the Class itself, not an instance. If any others are needed, simply add them
 * here, or in their own files.
 */
var oneArgumentPooler = function(copyFieldsFrom) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, copyFieldsFrom);
    return instance;
  } else {
    return new Klass(copyFieldsFrom);
  }
};

var twoArgumentPooler = function(a1, a2) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2);
    return instance;
  } else {
    return new Klass(a1, a2);
  }
};

var threeArgumentPooler = function(a1, a2, a3) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3);
    return instance;
  } else {
    return new Klass(a1, a2, a3);
  }
};

var fiveArgumentPooler = function(a1, a2, a3, a4, a5) {
  var Klass = this;
  if (Klass.instancePool.length) {
    var instance = Klass.instancePool.pop();
    Klass.call(instance, a1, a2, a3, a4, a5);
    return instance;
  } else {
    return new Klass(a1, a2, a3, a4, a5);
  }
};

var standardReleaser = function(instance) {
  var Klass = this;
  if (instance.destructor) {
    instance.destructor();
  }
  if (Klass.instancePool.length < Klass.poolSize) {
    Klass.instancePool.push(instance);
  }
};

var DEFAULT_POOL_SIZE = 10;
var DEFAULT_POOLER = oneArgumentPooler;

/**
 * Augments `CopyConstructor` to be a poolable class, augmenting only the class
 * itself (statically) not adding any prototypical fields. Any CopyConstructor
 * you give this may have a `poolSize` property, and will look for a
 * prototypical `destructor` on instances (optional).
 *
 * @param {Function} CopyConstructor Constructor that can be used to reset.
 * @param {Function} pooler Customizable pooler.
 */
var addPoolingTo = function(CopyConstructor, pooler) {
  var NewKlass = CopyConstructor;
  NewKlass.instancePool = [];
  NewKlass.getPooled = pooler || DEFAULT_POOLER;
  if (!NewKlass.poolSize) {
    NewKlass.poolSize = DEFAULT_POOL_SIZE;
  }
  NewKlass.release = standardReleaser;
  return NewKlass;
};

var PooledClass = {
  addPoolingTo: addPoolingTo,
  oneArgumentPooler: oneArgumentPooler,
  twoArgumentPooler: twoArgumentPooler,
  threeArgumentPooler: threeArgumentPooler,
  fiveArgumentPooler: fiveArgumentPooler
};

module.exports = PooledClass;

},{}],30:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule React
 */

"use strict";

var ReactComponent = require("./ReactComponent");
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactCurrentOwner = require("./ReactCurrentOwner");
var ReactDOM = require("./ReactDOM");
var ReactDOMComponent = require("./ReactDOMComponent");
var ReactDefaultInjection = require("./ReactDefaultInjection");
var ReactInstanceHandles = require("./ReactInstanceHandles");
var ReactMount = require("./ReactMount");
var ReactMultiChild = require("./ReactMultiChild");
var ReactPerf = require("./ReactPerf");
var ReactPropTypes = require("./ReactPropTypes");
var ReactServerRendering = require("./ReactServerRendering");
var ReactTextComponent = require("./ReactTextComponent");

ReactDefaultInjection.inject();

var React = {
  DOM: ReactDOM,
  PropTypes: ReactPropTypes,
  initializeTouchEvents: function(shouldUseTouch) {
    ReactMount.useTouchEvents = shouldUseTouch;
  },
  createClass: ReactCompositeComponent.createClass,
  constructAndRenderComponent: ReactMount.constructAndRenderComponent,
  constructAndRenderComponentByID: ReactMount.constructAndRenderComponentByID,
  renderComponent: ReactPerf.measure(
    'React',
    'renderComponent',
    ReactMount.renderComponent
  ),
  renderComponentToString: ReactServerRendering.renderComponentToString,
  unmountComponentAtNode: ReactMount.unmountComponentAtNode,
  unmountAndReleaseReactRootNode: ReactMount.unmountAndReleaseReactRootNode,
  isValidClass: ReactCompositeComponent.isValidClass,
  isValidComponent: ReactComponent.isValidComponent,
  __internals: {
    Component: ReactComponent,
    CurrentOwner: ReactCurrentOwner,
    DOMComponent: ReactDOMComponent,
    InstanceHandles: ReactInstanceHandles,
    Mount: ReactMount,
    MultiChild: ReactMultiChild,
    TextComponent: ReactTextComponent
  }
};

// Version exists only in the open-source version of React, not in Facebook's
// internal version.
React.version = '0.8.0';

module.exports = React;

},{"./ReactComponent":31,"./ReactCompositeComponent":34,"./ReactCurrentOwner":35,"./ReactDOM":36,"./ReactDOMComponent":38,"./ReactDefaultInjection":47,"./ReactInstanceHandles":54,"./ReactMount":56,"./ReactMultiChild":58,"./ReactPerf":61,"./ReactPropTypes":63,"./ReactServerRendering":65,"./ReactTextComponent":66}],31:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactComponent
 */

"use strict";

var ReactComponentEnvironment = require("./ReactComponentEnvironment");
var ReactCurrentOwner = require("./ReactCurrentOwner");
var ReactOwner = require("./ReactOwner");
var ReactUpdates = require("./ReactUpdates");

var invariant = require("./invariant");
var keyMirror = require("./keyMirror");
var merge = require("./merge");

/**
 * Every React component is in one of these life cycles.
 */
var ComponentLifeCycle = keyMirror({
  /**
   * Mounted components have a DOM node representation and are capable of
   * receiving new props.
   */
  MOUNTED: null,
  /**
   * Unmounted components are inactive and cannot receive new props.
   */
  UNMOUNTED: null
});

/**
 * Warn if there's no key explicitly set on dynamic arrays of children.
 * This allows us to keep track of children between updates.
 */

var ownerHasWarned = {};

/**
 * Warn if the component doesn't have an explicit key assigned to it.
 * This component is in an array. The array could grow and shrink or be
 * reordered. All children, that hasn't already been validated, are required to
 * have a "key" property assigned to it.
 *
 * @internal
 * @param {ReactComponent} component Component that requires a key.
 */
function validateExplicitKey(component) {
  if (component.__keyValidated__ || component.props.key != null) {
    return;
  }
  component.__keyValidated__ = true;

  // We can't provide friendly warnings for top level components.
  if (!ReactCurrentOwner.current) {
    return;
  }

  // Name of the component whose render method tried to pass children.
  var currentName = ReactCurrentOwner.current.constructor.displayName;
  if (ownerHasWarned.hasOwnProperty(currentName)) {
    return;
  }
  ownerHasWarned[currentName] = true;

  var message = 'Each child in an array should have a unique "key" prop. ' +
                'Check the render method of ' + currentName + '.';
  if (!component.isOwnedBy(ReactCurrentOwner.current)) {
    // Name of the component that originally created this child.
    var childOwnerName =
      component.props.__owner__ &&
      component.props.__owner__.constructor.displayName;

    // Usually the current owner is the offender, but if it accepts
    // children as a property, it may be the creator of the child that's
    // responsible for assigning it a key.
    message += ' It was passed a child from ' + childOwnerName + '.';
  }

  console.warn(message);
}

/**
 * Ensure that every component either is passed in a static location or, if
 * if it's passed in an array, has an explicit key property defined.
 *
 * @internal
 * @param {*} component Statically passed child of any type.
 * @return {boolean}
 */
function validateChildKeys(component) {
  if (Array.isArray(component)) {
    for (var i = 0; i < component.length; i++) {
      var child = component[i];
      if (ReactComponent.isValidComponent(child)) {
        validateExplicitKey(child);
      }
    }
  } else if (ReactComponent.isValidComponent(component)) {
    // This component was passed in a valid location.
    component.__keyValidated__ = true;
  }
}

/**
 * Components are the basic units of composition in React.
 *
 * Every component accepts a set of keyed input parameters known as "props" that
 * are initialized by the constructor. Once a component is mounted, the props
 * can be mutated using `setProps` or `replaceProps`.
 *
 * Every component is capable of the following operations:
 *
 *   `mountComponent`
 *     Initializes the component, renders markup, and registers event listeners.
 *
 *   `receiveComponent`
 *     Updates the rendered DOM nodes to match the given component.
 *
 *   `unmountComponent`
 *     Releases any resources allocated by this component.
 *
 * Components can also be "owned" by other components. Being owned by another
 * component means being constructed by that component. This is different from
 * being the child of a component, which means having a DOM representation that
 * is a child of the DOM representation of that component.
 *
 * @class ReactComponent
 */
var ReactComponent = {

  /**
   * @param {?object} object
   * @return {boolean} True if `object` is a valid component.
   * @final
   */
  isValidComponent: function(object) {
    return !!(
      object &&
      typeof object.mountComponentIntoNode === 'function' &&
      typeof object.receiveComponent === 'function'
    );
  },

  /**
   * Generate a key string that identifies a component within a set.
   *
   * @param {*} component A component that could contain a manual key.
   * @param {number} index Index that is used if a manual key is not provided.
   * @return {string}
   * @internal
   */
  getKey: function(component, index) {
    if (component && component.props && component.props.key != null) {
      // Explicit key
      return '{' + component.props.key + '}';
    }
    // Implicit key determined by the index in the set
    return '[' + index + ']';
  },

  /**
   * @internal
   */
  LifeCycle: ComponentLifeCycle,

  /**
   * Injected module that provides ability to mutate individual properties.
   * Injected into the base class because many different subclasses need access
   * to this.
   *
   * @internal
   */
  DOMIDOperations: ReactComponentEnvironment.DOMIDOperations,

  /**
   * Optionally injectable environment dependent cleanup hook. (server vs.
   * browser etc). Example: A browser system caches DOM nodes based on component
   * ID and must remove that cache entry when this instance is unmounted.
   *
   * @private
   */
  unmountIDFromEnvironment: ReactComponentEnvironment.unmountIDFromEnvironment,

  /**
   * The "image" of a component tree, is the platform specific (typically
   * serialized) data that represents a tree of lower level UI building blocks.
   * On the web, this "image" is HTML markup which describes a construction of
   * low level `div` and `span` nodes. Other platforms may have different
   * encoding of this "image". This must be injected.
   *
   * @private
   */
  mountImageIntoNode: ReactComponentEnvironment.mountImageIntoNode,

  /**
   * React references `ReactReconcileTransaction` using this property in order
   * to allow dependency injection.
   *
   * @internal
   */
  ReactReconcileTransaction:
    ReactComponentEnvironment.ReactReconcileTransaction,

  /**
   * Base functionality for every ReactComponent constructor. Mixed into the
   * `ReactComponent` prototype, but exposed statically for easy access.
   *
   * @lends {ReactComponent.prototype}
   */
  Mixin: merge(ReactComponentEnvironment.Mixin, {

    /**
     * Checks whether or not this component is mounted.
     *
     * @return {boolean} True if mounted, false otherwise.
     * @final
     * @protected
     */
    isMounted: function() {
      return this._lifeCycleState === ComponentLifeCycle.MOUNTED;
    },

    /**
     * Sets a subset of the props.
     *
     * @param {object} partialProps Subset of the next props.
     * @param {?function} callback Called after props are updated.
     * @final
     * @public
     */
    setProps: function(partialProps, callback) {
      // Merge with `_pendingProps` if it exists, otherwise with existing props.
      this.replaceProps(
        merge(this._pendingProps || this.props, partialProps),
        callback
      );
    },

    /**
     * Replaces all of the props.
     *
     * @param {object} props New props.
     * @param {?function} callback Called after props are updated.
     * @final
     * @public
     */
    replaceProps: function(props, callback) {
      ("production" !== process.env.NODE_ENV ? invariant(
        !this.props.__owner__,
        'replaceProps(...): You called `setProps` or `replaceProps` on a ' +
        'component with an owner. This is an anti-pattern since props will ' +
        'get reactively updated when rendered. Instead, change the owner\'s ' +
        '`render` method to pass the correct value as props to the component ' +
        'where it is created.'
      ) : invariant(!this.props.__owner__));
      ("production" !== process.env.NODE_ENV ? invariant(
        this.isMounted(),
        'replaceProps(...): Can only update a mounted component.'
      ) : invariant(this.isMounted()));
      this._pendingProps = props;
      ReactUpdates.enqueueUpdate(this, callback);
    },

    /**
     * Base constructor for all React component.
     *
     * Subclasses that override this method should make sure to invoke
     * `ReactComponent.Mixin.construct.call(this, ...)`.
     *
     * @param {?object} initialProps
     * @param {*} children
     * @internal
     */
    construct: function(initialProps, children) {
      this.props = initialProps || {};
      // Record the component responsible for creating this component.
      this.props.__owner__ = ReactCurrentOwner.current;
      // All components start unmounted.
      this._lifeCycleState = ComponentLifeCycle.UNMOUNTED;

      this._pendingProps = null;
      this._pendingCallbacks = null;

      // Children can be more than one argument
      var childrenLength = arguments.length - 1;
      if (childrenLength === 1) {
        if ("production" !== process.env.NODE_ENV) {
          validateChildKeys(children);
        }
        this.props.children = children;
      } else if (childrenLength > 1) {
        var childArray = Array(childrenLength);
        for (var i = 0; i < childrenLength; i++) {
          if ("production" !== process.env.NODE_ENV) {
            validateChildKeys(arguments[i + 1]);
          }
          childArray[i] = arguments[i + 1];
        }
        this.props.children = childArray;
      }
    },

    /**
     * Initializes the component, renders markup, and registers event listeners.
     *
     * NOTE: This does not insert any nodes into the DOM.
     *
     * Subclasses that override this method should make sure to invoke
     * `ReactComponent.Mixin.mountComponent.call(this, ...)`.
     *
     * @param {string} rootID DOM ID of the root node.
     * @param {ReactReconcileTransaction} transaction
     * @param {number} mountDepth number of components in the owner hierarchy.
     * @return {?string} Rendered markup to be inserted into the DOM.
     * @internal
     */
    mountComponent: function(rootID, transaction, mountDepth) {
      ("production" !== process.env.NODE_ENV ? invariant(
        !this.isMounted(),
        'mountComponent(%s, ...): Can only mount an unmounted component.',
        rootID
      ) : invariant(!this.isMounted()));
      var props = this.props;
      if (props.ref != null) {
        ReactOwner.addComponentAsRefTo(this, props.ref, props.__owner__);
      }
      this._rootNodeID = rootID;
      this._lifeCycleState = ComponentLifeCycle.MOUNTED;
      this._mountDepth = mountDepth;
      // Effectively: return '';
    },

    /**
     * Releases any resources allocated by `mountComponent`.
     *
     * NOTE: This does not remove any nodes from the DOM.
     *
     * Subclasses that override this method should make sure to invoke
     * `ReactComponent.Mixin.unmountComponent.call(this)`.
     *
     * @internal
     */
    unmountComponent: function() {
      ("production" !== process.env.NODE_ENV ? invariant(
        this.isMounted(),
        'unmountComponent(): Can only unmount a mounted component.'
      ) : invariant(this.isMounted()));
      var props = this.props;
      if (props.ref != null) {
        ReactOwner.removeComponentAsRefFrom(this, props.ref, props.__owner__);
      }
      ReactComponent.unmountIDFromEnvironment(this._rootNodeID);
      this._rootNodeID = null;
      this._lifeCycleState = ComponentLifeCycle.UNMOUNTED;
    },

    /**
     * Given a new instance of this component, updates the rendered DOM nodes
     * as if that instance was rendered instead.
     *
     * Subclasses that override this method should make sure to invoke
     * `ReactComponent.Mixin.receiveComponent.call(this, ...)`.
     *
     * @param {object} nextComponent Next set of properties.
     * @param {ReactReconcileTransaction} transaction
     * @internal
     */
    receiveComponent: function(nextComponent, transaction) {
      ("production" !== process.env.NODE_ENV ? invariant(
        this.isMounted(),
        'receiveComponent(...): Can only update a mounted component.'
      ) : invariant(this.isMounted()));
      this._pendingProps = nextComponent.props;
      this._performUpdateIfNecessary(transaction);
    },

    /**
     * Call `_performUpdateIfNecessary` within a new transaction.
     *
     * @param {ReactReconcileTransaction} transaction
     * @internal
     */
    performUpdateIfNecessary: function() {
      var transaction = ReactComponent.ReactReconcileTransaction.getPooled();
      transaction.perform(this._performUpdateIfNecessary, this, transaction);
      ReactComponent.ReactReconcileTransaction.release(transaction);
    },

    /**
     * If `_pendingProps` is set, update the component.
     *
     * @param {ReactReconcileTransaction} transaction
     * @internal
     */
    _performUpdateIfNecessary: function(transaction) {
      if (this._pendingProps == null) {
        return;
      }
      var prevProps = this.props;
      this.props = this._pendingProps;
      this._pendingProps = null;
      this.updateComponent(transaction, prevProps);
    },

    /**
     * Updates the component's currently mounted representation.
     *
     * @param {ReactReconcileTransaction} transaction
     * @param {object} prevProps
     * @internal
     */
    updateComponent: function(transaction, prevProps) {
      var props = this.props;
      // If either the owner or a `ref` has changed, make sure the newest owner
      // has stored a reference to `this`, and the previous owner (if different)
      // has forgotten the reference to `this`.
      if (props.__owner__ !== prevProps.__owner__ ||
          props.ref !== prevProps.ref) {
        if (prevProps.ref != null) {
          ReactOwner.removeComponentAsRefFrom(
            this, prevProps.ref, prevProps.__owner__
          );
        }
        // Correct, even if the owner is the same, and only the ref has changed.
        if (props.ref != null) {
          ReactOwner.addComponentAsRefTo(this, props.ref, props.__owner__);
        }
      }
    },

    /**
     * Mounts this component and inserts it into the DOM.
     *
     * @param {string} rootID DOM ID of the root node.
     * @param {DOMElement} container DOM element to mount into.
     * @param {boolean} shouldReuseMarkup If true, do not insert markup
     * @final
     * @internal
     * @see {ReactMount.renderComponent}
     */
    mountComponentIntoNode: function(rootID, container, shouldReuseMarkup) {
      var transaction = ReactComponent.ReactReconcileTransaction.getPooled();
      transaction.perform(
        this._mountComponentIntoNode,
        this,
        rootID,
        container,
        transaction,
        shouldReuseMarkup
      );
      ReactComponent.ReactReconcileTransaction.release(transaction);
    },

    /**
     * @param {string} rootID DOM ID of the root node.
     * @param {DOMElement} container DOM element to mount into.
     * @param {ReactReconcileTransaction} transaction
     * @param {boolean} shouldReuseMarkup If true, do not insert markup
     * @final
     * @private
     */
    _mountComponentIntoNode: function(
        rootID,
        container,
        transaction,
        shouldReuseMarkup) {
      var markup = this.mountComponent(rootID, transaction, 0);
      ReactComponent.mountImageIntoNode(markup, container, shouldReuseMarkup);
    },

    /**
     * Checks if this component is owned by the supplied `owner` component.
     *
     * @param {ReactComponent} owner Component to check.
     * @return {boolean} True if `owners` owns this component.
     * @final
     * @internal
     */
    isOwnedBy: function(owner) {
      return this.props.__owner__ === owner;
    },

    /**
     * Gets another component, that shares the same owner as this one, by ref.
     *
     * @param {string} ref of a sibling Component.
     * @return {?ReactComponent} the actual sibling Component.
     * @final
     * @internal
     */
    getSiblingByRef: function(ref) {
      var owner = this.props.__owner__;
      if (!owner || !owner.refs) {
        return null;
      }
      return owner.refs[ref];
    }
  })
};

module.exports = ReactComponent;

},{"./ReactComponentEnvironment":33,"./ReactCurrentOwner":35,"./ReactOwner":60,"./ReactUpdates":67,"./invariant":104,"./keyMirror":110,"./merge":113,"__browserify_process":124}],32:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactComponentBrowserEnvironment
 */

/*jslint evil: true */

"use strict";

var ReactDOMIDOperations = require("./ReactDOMIDOperations");
var ReactMarkupChecksum = require("./ReactMarkupChecksum");
var ReactMount = require("./ReactMount");
var ReactReconcileTransaction = require("./ReactReconcileTransaction");

var getReactRootElementInContainer = require("./getReactRootElementInContainer");
var invariant = require("./invariant");
var mutateHTMLNodeWithMarkup = require("./mutateHTMLNodeWithMarkup");


var ELEMENT_NODE_TYPE = 1;
var DOC_NODE_TYPE = 9;


/**
 * Abstracts away all functionality of `ReactComponent` requires knowledge of
 * the browser context.
 */
var ReactComponentBrowserEnvironment = {
  /**
   * Mixed into every component instance.
   */
  Mixin: {
    /**
     * Returns the DOM node rendered by this component.
     *
     * @return {DOMElement} The root node of this component.
     * @final
     * @protected
     */
    getDOMNode: function() {
      ("production" !== process.env.NODE_ENV ? invariant(
        this.isMounted(),
        'getDOMNode(): A component must be mounted to have a DOM node.'
      ) : invariant(this.isMounted()));
      return ReactMount.getNode(this._rootNodeID);
    }
  },

  ReactReconcileTransaction: ReactReconcileTransaction,

  DOMIDOperations: ReactDOMIDOperations,

  /**
   * If a particular environment requires that some resources be cleaned up,
   * specify this in the injected Mixin. In the DOM, we would likely want to
   * purge any cached node ID lookups.
   *
   * @private
   */
  unmountIDFromEnvironment: function(rootNodeID) {
    ReactMount.purgeID(rootNodeID);
  },

  /**
   * @param {string} markup Markup string to place into the DOM Element.
   * @param {DOMElement} container DOM Element to insert markup into.
   * @param {boolean} shouldReuseMarkup Should reuse the existing markup in the
   * container if possible.
   */
  mountImageIntoNode: function(markup, container, shouldReuseMarkup) {
    ("production" !== process.env.NODE_ENV ? invariant(
      container && (
        container.nodeType === ELEMENT_NODE_TYPE ||
        container.nodeType === DOC_NODE_TYPE && ReactMount.allowFullPageRender
      ),
      'mountComponentIntoNode(...): Target container is not valid.'
    ) : invariant(container && (
      container.nodeType === ELEMENT_NODE_TYPE ||
      container.nodeType === DOC_NODE_TYPE && ReactMount.allowFullPageRender
    )));
    if (shouldReuseMarkup) {
      if (ReactMarkupChecksum.canReuseMarkup(
            markup,
            getReactRootElementInContainer(container))) {
        return;
      } else {
        if ("production" !== process.env.NODE_ENV) {
          console.warn(
            'React attempted to use reuse markup in a container but the ' +
            'checksum was invalid. This generally means that you are using ' +
            'server rendering and the markup generated on the server was ' +
            'not what the client was expecting. React injected new markup ' +
            'to compensate which works but you have lost many of the ' +
            'benefits of server rendering. Instead, figure out why the ' +
            'markup being generated is different on the client or server.'
          );
        }
      }
    }

    // You can't naively set the innerHTML of the entire document. You need
    // to mutate documentElement which requires doing some crazy tricks. See
    // mutateHTMLNodeWithMarkup()
    if (container.nodeType === DOC_NODE_TYPE) {
      mutateHTMLNodeWithMarkup(container.documentElement, markup);
      return;
    }

    // Asynchronously inject markup by ensuring that the container is not in
    // the document when settings its `innerHTML`.
    var parent = container.parentNode;
    if (parent) {
      var next = container.nextSibling;
      parent.removeChild(container);
      container.innerHTML = markup;
      if (next) {
        parent.insertBefore(container, next);
      } else {
        parent.appendChild(container);
      }
    } else {
      container.innerHTML = markup;
    }
  }
};

module.exports = ReactComponentBrowserEnvironment;

},{"./ReactDOMIDOperations":40,"./ReactMarkupChecksum":55,"./ReactMount":56,"./ReactReconcileTransaction":64,"./getReactRootElementInContainer":100,"./invariant":104,"./mutateHTMLNodeWithMarkup":117,"__browserify_process":124}],33:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactComponentEnvironment
 */

var ReactComponentBrowserEnvironment =
  require("./ReactComponentBrowserEnvironment");

var ReactComponentEnvironment = ReactComponentBrowserEnvironment;

module.exports = ReactComponentEnvironment;

},{"./ReactComponentBrowserEnvironment":32}],34:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactCompositeComponent
 */

"use strict";

var ReactComponent = require("./ReactComponent");
var ReactCurrentOwner = require("./ReactCurrentOwner");
var ReactErrorUtils = require("./ReactErrorUtils");
var ReactOwner = require("./ReactOwner");
var ReactPerf = require("./ReactPerf");
var ReactPropTransferer = require("./ReactPropTransferer");
var ReactUpdates = require("./ReactUpdates");

var invariant = require("./invariant");
var keyMirror = require("./keyMirror");
var merge = require("./merge");
var mixInto = require("./mixInto");
var objMap = require("./objMap");

/**
 * Policies that describe methods in `ReactCompositeComponentInterface`.
 */
var SpecPolicy = keyMirror({
  /**
   * These methods may be defined only once by the class specification or mixin.
   */
  DEFINE_ONCE: null,
  /**
   * These methods may be defined by both the class specification and mixins.
   * Subsequent definitions will be chained. These methods must return void.
   */
  DEFINE_MANY: null,
  /**
   * These methods are overriding the base ReactCompositeComponent class.
   */
  OVERRIDE_BASE: null,
  /**
   * These methods are similar to DEFINE_MANY, except we assume they return
   * objects. We try to merge the keys of the return values of all the mixed in
   * functions. If there is a key conflict we throw.
   */
  DEFINE_MANY_MERGED: null
});

/**
 * Composite components are higher-level components that compose other composite
 * or native components.
 *
 * To create a new type of `ReactCompositeComponent`, pass a specification of
 * your new class to `React.createClass`. The only requirement of your class
 * specification is that you implement a `render` method.
 *
 *   var MyComponent = React.createClass({
 *     render: function() {
 *       return <div>Hello World</div>;
 *     }
 *   });
 *
 * The class specification supports a specific protocol of methods that have
 * special meaning (e.g. `render`). See `ReactCompositeComponentInterface` for
 * more the comprehensive protocol. Any other properties and methods in the
 * class specification will available on the prototype.
 *
 * @interface ReactCompositeComponentInterface
 * @internal
 */
var ReactCompositeComponentInterface = {

  /**
   * An array of Mixin objects to include when defining your component.
   *
   * @type {array}
   * @optional
   */
  mixins: SpecPolicy.DEFINE_MANY,

  /**
   * Definition of prop types for this component.
   *
   * @type {object}
   * @optional
   */
  propTypes: SpecPolicy.DEFINE_ONCE,



  // ==== Definition methods ====

  /**
   * Invoked when the component is mounted. Values in the mapping will be set on
   * `this.props` if that prop is not specified (i.e. using an `in` check).
   *
   * This method is invoked before `getInitialState` and therefore cannot rely
   * on `this.state` or use `this.setState`.
   *
   * @return {object}
   * @optional
   */
  getDefaultProps: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * Invoked once before the component is mounted. The return value will be used
   * as the initial value of `this.state`.
   *
   *   getInitialState: function() {
   *     return {
   *       isOn: false,
   *       fooBaz: new BazFoo()
   *     }
   *   }
   *
   * @return {object}
   * @optional
   */
  getInitialState: SpecPolicy.DEFINE_MANY_MERGED,

  /**
   * Uses props from `this.props` and state from `this.state` to render the
   * structure of the component.
   *
   * No guarantees are made about when or how often this method is invoked, so
   * it must not have side effects.
   *
   *   render: function() {
   *     var name = this.props.name;
   *     return <div>Hello, {name}!</div>;
   *   }
   *
   * @return {ReactComponent}
   * @nosideeffects
   * @required
   */
  render: SpecPolicy.DEFINE_ONCE,



  // ==== Delegate methods ====

  /**
   * Invoked when the component is initially created and about to be mounted.
   * This may have side effects, but any external subscriptions or data created
   * by this method must be cleaned up in `componentWillUnmount`.
   *
   * @optional
   */
  componentWillMount: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component has been mounted and has a DOM representation.
   * However, there is no guarantee that the DOM node is in the document.
   *
   * Use this as an opportunity to operate on the DOM when the component has
   * been mounted (initialized and rendered) for the first time.
   *
   * @param {DOMElement} rootNode DOM element representing the component.
   * @optional
   */
  componentDidMount: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked before the component receives new props.
   *
   * Use this as an opportunity to react to a prop transition by updating the
   * state using `this.setState`. Current props are accessed via `this.props`.
   *
   *   componentWillReceiveProps: function(nextProps) {
   *     this.setState({
   *       likesIncreasing: nextProps.likeCount > this.props.likeCount
   *     });
   *   }
   *
   * NOTE: There is no equivalent `componentWillReceiveState`. An incoming prop
   * transition may cause a state change, but the opposite is not true. If you
   * need it, you are probably looking for `componentWillUpdate`.
   *
   * @param {object} nextProps
   * @optional
   */
  componentWillReceiveProps: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked while deciding if the component should be updated as a result of
   * receiving new props and state.
   *
   * Use this as an opportunity to `return false` when you're certain that the
   * transition to the new props and state will not require a component update.
   *
   *   shouldComponentUpdate: function(nextProps, nextState) {
   *     return !equal(nextProps, this.props) || !equal(nextState, this.state);
   *   }
   *
   * @param {object} nextProps
   * @param {?object} nextState
   * @return {boolean} True if the component should update.
   * @optional
   */
  shouldComponentUpdate: SpecPolicy.DEFINE_ONCE,

  /**
   * Invoked when the component is about to update due to a transition from
   * `this.props` and `this.state` to `nextProps` and `nextState`.
   *
   * Use this as an opportunity to perform preparation before an update occurs.
   *
   * NOTE: You **cannot** use `this.setState()` in this method.
   *
   * @param {object} nextProps
   * @param {?object} nextState
   * @param {ReactReconcileTransaction} transaction
   * @optional
   */
  componentWillUpdate: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component's DOM representation has been updated.
   *
   * Use this as an opportunity to operate on the DOM when the component has
   * been updated.
   *
   * @param {object} prevProps
   * @param {?object} prevState
   * @param {DOMElement} rootNode DOM element representing the component.
   * @optional
   */
  componentDidUpdate: SpecPolicy.DEFINE_MANY,

  /**
   * Invoked when the component is about to be removed from its parent and have
   * its DOM representation destroyed.
   *
   * Use this as an opportunity to deallocate any external resources.
   *
   * NOTE: There is no `componentDidUnmount` since your component will have been
   * destroyed by that point.
   *
   * @optional
   */
  componentWillUnmount: SpecPolicy.DEFINE_MANY,



  // ==== Advanced methods ====

  /**
   * Updates the component's currently mounted DOM representation.
   *
   * By default, this implements React's rendering and reconciliation algorithm.
   * Sophisticated clients may wish to override this.
   *
   * @param {ReactReconcileTransaction} transaction
   * @internal
   * @overridable
   */
  updateComponent: SpecPolicy.OVERRIDE_BASE

};

/**
 * Mapping from class specification keys to special processing functions.
 *
 * Although these are declared in the specification when defining classes
 * using `React.createClass`, they will not be on the component's prototype.
 */
var RESERVED_SPEC_KEYS = {
  displayName: function(Constructor, displayName) {
    Constructor.displayName = displayName;
  },
  mixins: function(Constructor, mixins) {
    if (mixins) {
      for (var i = 0; i < mixins.length; i++) {
        mixSpecIntoComponent(Constructor, mixins[i]);
      }
    }
  },
  propTypes: function(Constructor, propTypes) {
    Constructor.propTypes = propTypes;
  }
};

function validateMethodOverride(proto, name) {
  var specPolicy = ReactCompositeComponentInterface[name];

  // Disallow overriding of base class methods unless explicitly allowed.
  if (ReactCompositeComponentMixin.hasOwnProperty(name)) {
    ("production" !== process.env.NODE_ENV ? invariant(
      specPolicy === SpecPolicy.OVERRIDE_BASE,
      'ReactCompositeComponentInterface: You are attempting to override ' +
      '`%s` from your class specification. Ensure that your method names ' +
      'do not overlap with React methods.',
      name
    ) : invariant(specPolicy === SpecPolicy.OVERRIDE_BASE));
  }

  // Disallow defining methods more than once unless explicitly allowed.
  if (proto.hasOwnProperty(name)) {
    ("production" !== process.env.NODE_ENV ? invariant(
      specPolicy === SpecPolicy.DEFINE_MANY ||
      specPolicy === SpecPolicy.DEFINE_MANY_MERGED,
      'ReactCompositeComponentInterface: You are attempting to define ' +
      '`%s` on your component more than once. This conflict may be due ' +
      'to a mixin.',
      name
    ) : invariant(specPolicy === SpecPolicy.DEFINE_MANY ||
    specPolicy === SpecPolicy.DEFINE_MANY_MERGED));
  }
}


function validateLifeCycleOnReplaceState(instance) {
  var compositeLifeCycleState = instance._compositeLifeCycleState;
  ("production" !== process.env.NODE_ENV ? invariant(
    instance.isMounted() ||
      compositeLifeCycleState === CompositeLifeCycle.MOUNTING,
    'replaceState(...): Can only update a mounted or mounting component.'
  ) : invariant(instance.isMounted() ||
    compositeLifeCycleState === CompositeLifeCycle.MOUNTING));
  ("production" !== process.env.NODE_ENV ? invariant(compositeLifeCycleState !== CompositeLifeCycle.RECEIVING_STATE,
    'replaceState(...): Cannot update during an existing state transition ' +
    '(such as within `render`). This could potentially cause an infinite ' +
    'loop so it is forbidden.'
  ) : invariant(compositeLifeCycleState !== CompositeLifeCycle.RECEIVING_STATE));
  ("production" !== process.env.NODE_ENV ? invariant(compositeLifeCycleState !== CompositeLifeCycle.UNMOUNTING,
    'replaceState(...): Cannot update while unmounting component. This ' +
    'usually means you called setState() on an unmounted component.'
  ) : invariant(compositeLifeCycleState !== CompositeLifeCycle.UNMOUNTING));
}

/**
 * Custom version of `mixInto` which handles policy validation and reserved
 * specification keys when building `ReactCompositeComponent` classses.
 */
function mixSpecIntoComponent(Constructor, spec) {
  var proto = Constructor.prototype;
  for (var name in spec) {
    var property = spec[name];
    if (!spec.hasOwnProperty(name) || !property) {
      continue;
    }
    validateMethodOverride(proto, name);

    if (RESERVED_SPEC_KEYS.hasOwnProperty(name)) {
      RESERVED_SPEC_KEYS[name](Constructor, property);
    } else {
      // Setup methods on prototype:
      // The following member methods should not be automatically bound:
      // 1. Expected ReactCompositeComponent methods (in the "interface").
      // 2. Overridden methods (that were mixed in).
      var isCompositeComponentMethod = name in ReactCompositeComponentInterface;
      var isInherited = name in proto;
      var markedDontBind = property.__reactDontBind;
      var isFunction = typeof property === 'function';
      var shouldAutoBind =
        isFunction &&
        !isCompositeComponentMethod &&
        !isInherited &&
        !markedDontBind;

      if (shouldAutoBind) {
        if (!proto.__reactAutoBindMap) {
          proto.__reactAutoBindMap = {};
        }
        proto.__reactAutoBindMap[name] = property;
        proto[name] = property;
      } else {
        if (isInherited) {
          // For methods which are defined more than once, call the existing
          // methods before calling the new property.
          if (ReactCompositeComponentInterface[name] ===
              SpecPolicy.DEFINE_MANY_MERGED) {
            proto[name] = createMergedResultFunction(proto[name], property);
          } else {
            proto[name] = createChainedFunction(proto[name], property);
          }
        } else {
          proto[name] = property;
        }
      }
    }
  }
}

/**
 * Merge two objects, but throw if both contain the same key.
 *
 * @param {object} one The first object, which is mutated.
 * @param {object} two The second object
 * @return {object} one after it has been mutated to contain everything in two.
 */
function mergeObjectsWithNoDuplicateKeys(one, two) {
  ("production" !== process.env.NODE_ENV ? invariant(
    one && two && typeof one === 'object' && typeof two === 'object',
    'mergeObjectsWithNoDuplicateKeys(): Cannot merge non-objects'
  ) : invariant(one && two && typeof one === 'object' && typeof two === 'object'));

  objMap(two, function(value, key) {
    ("production" !== process.env.NODE_ENV ? invariant(
      one[key] === undefined,
      'mergeObjectsWithNoDuplicateKeys(): ' +
      'Tried to merge two objects with the same key: %s',
      key
    ) : invariant(one[key] === undefined));
    one[key] = value;
  });
  return one;
}

/**
 * Creates a function that invokes two functions and merges their return values.
 *
 * @param {function} one Function to invoke first.
 * @param {function} two Function to invoke second.
 * @return {function} Function that invokes the two argument functions.
 * @private
 */
function createMergedResultFunction(one, two) {
  return function mergedResult() {
    return mergeObjectsWithNoDuplicateKeys(
      one.apply(this, arguments),
      two.apply(this, arguments)
    );
  };
}

/**
 * Creates a function that invokes two functions and ignores their return vales.
 *
 * @param {function} one Function to invoke first.
 * @param {function} two Function to invoke second.
 * @return {function} Function that invokes the two argument functions.
 * @private
 */
function createChainedFunction(one, two) {
  return function chainedFunction() {
    one.apply(this, arguments);
    two.apply(this, arguments);
  };
}

/**
 * `ReactCompositeComponent` maintains an auxiliary life cycle state in
 * `this._compositeLifeCycleState` (which can be null).
 *
 * This is different from the life cycle state maintained by `ReactComponent` in
 * `this._lifeCycleState`. The following diagram shows how the states overlap in
 * time. There are times when the CompositeLifeCycle is null - at those times it
 * is only meaningful to look at ComponentLifeCycle alone.
 *
 * Top Row: ReactComponent.ComponentLifeCycle
 * Low Row: ReactComponent.CompositeLifeCycle
 *
 * +-------+------------------------------------------------------+--------+
 * |  UN   |                    MOUNTED                           |   UN   |
 * |MOUNTED|                                                      | MOUNTED|
 * +-------+------------------------------------------------------+--------+
 * |       ^--------+   +------+   +------+   +------+   +--------^        |
 * |       |        |   |      |   |      |   |      |   |        |        |
 * |    0--|MOUNTING|-0-|RECEIV|-0-|RECEIV|-0-|RECEIV|-0-|   UN   |--->0   |
 * |       |        |   |PROPS |   | PROPS|   | STATE|   |MOUNTING|        |
 * |       |        |   |      |   |      |   |      |   |        |        |
 * |       |        |   |      |   |      |   |      |   |        |        |
 * |       +--------+   +------+   +------+   +------+   +--------+        |
 * |       |                                                      |        |
 * +-------+------------------------------------------------------+--------+
 */
var CompositeLifeCycle = keyMirror({
  /**
   * Components in the process of being mounted respond to state changes
   * differently.
   */
  MOUNTING: null,
  /**
   * Components in the process of being unmounted are guarded against state
   * changes.
   */
  UNMOUNTING: null,
  /**
   * Components that are mounted and receiving new props respond to state
   * changes differently.
   */
  RECEIVING_PROPS: null,
  /**
   * Components that are mounted and receiving new state are guarded against
   * additional state changes.
   */
  RECEIVING_STATE: null
});

/**
 * @lends {ReactCompositeComponent.prototype}
 */
var ReactCompositeComponentMixin = {

  /**
   * Base constructor for all composite component.
   *
   * @param {?object} initialProps
   * @param {*} children
   * @final
   * @internal
   */
  construct: function(initialProps, children) {
    // Children can be either an array or more than one argument
    ReactComponent.Mixin.construct.apply(this, arguments);
    this.state = null;
    this._pendingState = null;
    this._compositeLifeCycleState = null;
  },

  /**
   * Checks whether or not this composite component is mounted.
   * @return {boolean} True if mounted, false otherwise.
   * @protected
   * @final
   */
  isMounted: function() {
    return ReactComponent.Mixin.isMounted.call(this) &&
      this._compositeLifeCycleState !== CompositeLifeCycle.MOUNTING;
  },

  /**
   * Initializes the component, renders markup, and registers event listeners.
   *
   * @param {string} rootID DOM ID of the root node.
   * @param {ReactReconcileTransaction} transaction
   * @param {number} mountDepth number of components in the owner hierarchy
   * @return {?string} Rendered markup to be inserted into the DOM.
   * @final
   * @internal
   */
  mountComponent: ReactPerf.measure(
    'ReactCompositeComponent',
    'mountComponent',
    function(rootID, transaction, mountDepth) {
      ReactComponent.Mixin.mountComponent.call(
        this,
        rootID,
        transaction,
        mountDepth
      );
      this._compositeLifeCycleState = CompositeLifeCycle.MOUNTING;

      this._defaultProps = this.getDefaultProps ? this.getDefaultProps() : null;
      this._processProps(this.props);

      if (this.__reactAutoBindMap) {
        this._bindAutoBindMethods();
      }

      this.state = this.getInitialState ? this.getInitialState() : null;
      this._pendingState = null;
      this._pendingForceUpdate = false;

      if (this.componentWillMount) {
        this.componentWillMount();
        // When mounting, calls to `setState` by `componentWillMount` will set
        // `this._pendingState` without triggering a re-render.
        if (this._pendingState) {
          this.state = this._pendingState;
          this._pendingState = null;
        }
      }

      this._renderedComponent = this._renderValidatedComponent();

      // Done with mounting, `setState` will now trigger UI changes.
      this._compositeLifeCycleState = null;
      var markup = this._renderedComponent.mountComponent(
        rootID,
        transaction,
        mountDepth + 1
      );
      if (this.componentDidMount) {
        transaction.getReactMountReady().enqueue(this, this.componentDidMount);
      }
      return markup;
    }
  ),

  /**
   * Releases any resources allocated by `mountComponent`.
   *
   * @final
   * @internal
   */
  unmountComponent: function() {
    this._compositeLifeCycleState = CompositeLifeCycle.UNMOUNTING;
    if (this.componentWillUnmount) {
      this.componentWillUnmount();
    }
    this._compositeLifeCycleState = null;

    this._defaultProps = null;

    ReactComponent.Mixin.unmountComponent.call(this);
    this._renderedComponent.unmountComponent();
    this._renderedComponent = null;

    if (this.refs) {
      this.refs = null;
    }

    // Some existing components rely on this.props even after they've been
    // destroyed (in event handlers).
    // TODO: this.props = null;
    // TODO: this.state = null;
  },

  /**
   * Sets a subset of the state. Always use this or `replaceState` to mutate
   * state. You should treat `this.state` as immutable.
   *
   * There is no guarantee that `this.state` will be immediately updated, so
   * accessing `this.state` after calling this method may return the old value.
   *
   * There is no guarantee that calls to `setState` will run synchronously,
   * as they may eventually be batched together.  You can provide an optional
   * callback that will be executed when the call to setState is actually
   * completed.
   *
   * @param {object} partialState Next partial state to be merged with state.
   * @param {?function} callback Called after state is updated.
   * @final
   * @protected
   */
  setState: function(partialState, callback) {
    // Merge with `_pendingState` if it exists, otherwise with existing state.
    this.replaceState(
      merge(this._pendingState || this.state, partialState),
      callback
    );
  },

  /**
   * Replaces all of the state. Always use this or `setState` to mutate state.
   * You should treat `this.state` as immutable.
   *
   * There is no guarantee that `this.state` will be immediately updated, so
   * accessing `this.state` after calling this method may return the old value.
   *
   * @param {object} completeState Next state.
   * @param {?function} callback Called after state is updated.
   * @final
   * @protected
   */
  replaceState: function(completeState, callback) {
    validateLifeCycleOnReplaceState(this);
    this._pendingState = completeState;
    ReactUpdates.enqueueUpdate(this, callback);
  },

  /**
   * Processes props by setting default values for unspecified props and
   * asserting that the props are valid.
   *
   * @param {object} props
   * @private
   */
  _processProps: function(props) {
    var propName;
    var defaultProps = this._defaultProps;
    for (propName in defaultProps) {
      if (!(propName in props)) {
        props[propName] = defaultProps[propName];
      }
    }
    var propTypes = this.constructor.propTypes;
    if (propTypes) {
      var componentName = this.constructor.displayName;
      for (propName in propTypes) {
        var checkProp = propTypes[propName];
        if (checkProp) {
          checkProp(props, propName, componentName);
        }
      }
    }
  },

  performUpdateIfNecessary: function() {
    var compositeLifeCycleState = this._compositeLifeCycleState;
    // Do not trigger a state transition if we are in the middle of mounting or
    // receiving props because both of those will already be doing this.
    if (compositeLifeCycleState === CompositeLifeCycle.MOUNTING ||
        compositeLifeCycleState === CompositeLifeCycle.RECEIVING_PROPS) {
      return;
    }
    ReactComponent.Mixin.performUpdateIfNecessary.call(this);
  },

  /**
   * If any of `_pendingProps`, `_pendingState`, or `_pendingForceUpdate` is
   * set, update the component.
   *
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  _performUpdateIfNecessary: function(transaction) {
    if (this._pendingProps == null &&
        this._pendingState == null &&
        !this._pendingForceUpdate) {
      return;
    }

    var nextProps = this.props;
    if (this._pendingProps != null) {
      nextProps = this._pendingProps;
      this._processProps(nextProps);
      this._pendingProps = null;

      this._compositeLifeCycleState = CompositeLifeCycle.RECEIVING_PROPS;
      if (this.componentWillReceiveProps) {
        this.componentWillReceiveProps(nextProps, transaction);
      }
    }

    this._compositeLifeCycleState = CompositeLifeCycle.RECEIVING_STATE;

    var nextState = this._pendingState || this.state;
    this._pendingState = null;

    if (this._pendingForceUpdate ||
        !this.shouldComponentUpdate ||
        this.shouldComponentUpdate(nextProps, nextState)) {
      this._pendingForceUpdate = false;
      // Will set `this.props` and `this.state`.
      this._performComponentUpdate(nextProps, nextState, transaction);
    } else {
      // If it's determined that a component should not update, we still want
      // to set props and state.
      this.props = nextProps;
      this.state = nextState;
    }

    this._compositeLifeCycleState = null;
  },

  /**
   * Merges new props and state, notifies delegate methods of update and
   * performs update.
   *
   * @param {object} nextProps Next object to set as properties.
   * @param {?object} nextState Next object to set as state.
   * @param {ReactReconcileTransaction} transaction
   * @private
   */
  _performComponentUpdate: function(nextProps, nextState, transaction) {
    var prevProps = this.props;
    var prevState = this.state;

    if (this.componentWillUpdate) {
      this.componentWillUpdate(nextProps, nextState, transaction);
    }

    this.props = nextProps;
    this.state = nextState;

    this.updateComponent(transaction, prevProps, prevState);

    if (this.componentDidUpdate) {
      transaction.getReactMountReady().enqueue(
        this,
        this.componentDidUpdate.bind(this, prevProps, prevState)
      );
    }
  },

  /**
   * Updates the component's currently mounted DOM representation.
   *
   * By default, this implements React's rendering and reconciliation algorithm.
   * Sophisticated clients may wish to override this.
   *
   * @param {ReactReconcileTransaction} transaction
   * @param {object} prevProps
   * @param {?object} prevState
   * @internal
   * @overridable
   */
  updateComponent: ReactPerf.measure(
    'ReactCompositeComponent',
    'updateComponent',
    function(transaction, prevProps, prevState) {
      ReactComponent.Mixin.updateComponent.call(this, transaction, prevProps);
      var currentComponent = this._renderedComponent;
      var nextComponent = this._renderValidatedComponent();
      if (currentComponent.constructor === nextComponent.constructor) {
        currentComponent.receiveComponent(nextComponent, transaction);
      } else {
        // These two IDs are actually the same! But nothing should rely on that.
        var thisID = this._rootNodeID;
        var currentComponentID = currentComponent._rootNodeID;
        currentComponent.unmountComponent();
        this._renderedComponent = nextComponent;
        var nextMarkup = nextComponent.mountComponent(
          thisID,
          transaction,
          this._mountDepth + 1
        );
        ReactComponent.DOMIDOperations.dangerouslyReplaceNodeWithMarkupByID(
          currentComponentID,
          nextMarkup
        );
      }
    }
  ),

  /**
   * Forces an update. This should only be invoked when it is known with
   * certainty that we are **not** in a DOM transaction.
   *
   * You may want to call this when you know that some deeper aspect of the
   * component's state has changed but `setState` was not called.
   *
   * This will not invoke `shouldUpdateComponent`, but it will invoke
   * `componentWillUpdate` and `componentDidUpdate`.
   *
   * @param {?function} callback Called after update is complete.
   * @final
   * @protected
   */
  forceUpdate: function(callback) {
    var compositeLifeCycleState = this._compositeLifeCycleState;
    ("production" !== process.env.NODE_ENV ? invariant(
      this.isMounted() ||
        compositeLifeCycleState === CompositeLifeCycle.MOUNTING,
      'forceUpdate(...): Can only force an update on mounted or mounting ' +
        'components.'
    ) : invariant(this.isMounted() ||
      compositeLifeCycleState === CompositeLifeCycle.MOUNTING));
    ("production" !== process.env.NODE_ENV ? invariant(
      compositeLifeCycleState !== CompositeLifeCycle.RECEIVING_STATE &&
      compositeLifeCycleState !== CompositeLifeCycle.UNMOUNTING,
      'forceUpdate(...): Cannot force an update while unmounting component ' +
      'or during an existing state transition (such as within `render`).'
    ) : invariant(compositeLifeCycleState !== CompositeLifeCycle.RECEIVING_STATE &&
    compositeLifeCycleState !== CompositeLifeCycle.UNMOUNTING));
    this._pendingForceUpdate = true;
    ReactUpdates.enqueueUpdate(this, callback);
  },

  /**
   * @private
   */
  _renderValidatedComponent: function() {
    var renderedComponent;
    ReactCurrentOwner.current = this;
    try {
      renderedComponent = this.render();
    } catch (error) {
      // IE8 requires `catch` in order to use `finally`.
      throw error;
    } finally {
      ReactCurrentOwner.current = null;
    }
    ("production" !== process.env.NODE_ENV ? invariant(
      ReactComponent.isValidComponent(renderedComponent),
      '%s.render(): A valid ReactComponent must be returned. You may have ' +
      'returned null, undefined, an array, or some other invalid object.',
      this.constructor.displayName || 'ReactCompositeComponent'
    ) : invariant(ReactComponent.isValidComponent(renderedComponent)));
    return renderedComponent;
  },

  /**
   * @private
   */
  _bindAutoBindMethods: function() {
    for (var autoBindKey in this.__reactAutoBindMap) {
      if (!this.__reactAutoBindMap.hasOwnProperty(autoBindKey)) {
        continue;
      }
      var method = this.__reactAutoBindMap[autoBindKey];
      this[autoBindKey] = this._bindAutoBindMethod(ReactErrorUtils.guard(
        method,
        this.constructor.displayName + '.' + autoBindKey
      ));
    }
  },

  /**
   * Binds a method to the component.
   *
   * @param {function} method Method to be bound.
   * @private
   */
  _bindAutoBindMethod: function(method) {
    var component = this;
    var boundMethod = function() {
      return method.apply(component, arguments);
    };
    if ("production" !== process.env.NODE_ENV) {
      boundMethod.__reactBoundContext = component;
      boundMethod.__reactBoundMethod = method;
      boundMethod.__reactBoundArguments = null;
      var componentName = component.constructor.displayName;
      var _bind = boundMethod.bind;
      boundMethod.bind = function(newThis) {
        // User is trying to bind() an autobound method; we effectively will
        // ignore the value of "this" that the user is trying to use, so
        // let's warn.
        if (newThis !== component && newThis !== null) {
          console.warn(
            'bind(): React component methods may only be bound to the ' +
            'component instance. See ' + componentName
          );
        } else if (arguments.length === 1) {
          console.warn(
            'bind(): You are binding a component method to the component. ' +
            'React does this for you automatically in a high-performance ' +
            'way, so you can safely remove this call. See ' + componentName
          );
          return boundMethod;
        }
        var reboundMethod = _bind.apply(boundMethod, arguments);
        reboundMethod.__reactBoundContext = component;
        reboundMethod.__reactBoundMethod = method;
        reboundMethod.__reactBoundArguments =
          Array.prototype.slice.call(arguments, 1);
        return reboundMethod;
      };
    }
    return boundMethod;
  }
};

var ReactCompositeComponentBase = function() {};
mixInto(ReactCompositeComponentBase, ReactComponent.Mixin);
mixInto(ReactCompositeComponentBase, ReactOwner.Mixin);
mixInto(ReactCompositeComponentBase, ReactPropTransferer.Mixin);
mixInto(ReactCompositeComponentBase, ReactCompositeComponentMixin);

/**
 * Module for creating composite components.
 *
 * @class ReactCompositeComponent
 * @extends ReactComponent
 * @extends ReactOwner
 * @extends ReactPropTransferer
 */
var ReactCompositeComponent = {

  LifeCycle: CompositeLifeCycle,

  Base: ReactCompositeComponentBase,

  /**
   * Creates a composite component class given a class specification.
   *
   * @param {object} spec Class specification (which must define `render`).
   * @return {function} Component constructor function.
   * @public
   */
  createClass: function(spec) {
    var Constructor = function() {};
    Constructor.prototype = new ReactCompositeComponentBase();
    Constructor.prototype.constructor = Constructor;
    mixSpecIntoComponent(Constructor, spec);

    ("production" !== process.env.NODE_ENV ? invariant(
      Constructor.prototype.render,
      'createClass(...): Class specification must implement a `render` method.'
    ) : invariant(Constructor.prototype.render));

    if ("production" !== process.env.NODE_ENV) {
      if (Constructor.prototype.componentShouldUpdate) {
        console.warn(
          (spec.displayName || 'A component') + ' has a method called ' +
          'componentShouldUpdate(). Did you mean shouldComponentUpdate()? ' +
          'The name is phrased as a question because the function is ' +
          'expected to return a value.'
         );
      }
    }

    // Reduce time spent doing lookups by setting these on the prototype.
    for (var methodName in ReactCompositeComponentInterface) {
      if (!Constructor.prototype[methodName]) {
        Constructor.prototype[methodName] = null;
      }
    }

    var ConvenienceConstructor = function(props, children) {
      var instance = new Constructor();
      instance.construct.apply(instance, arguments);
      return instance;
    };
    ConvenienceConstructor.componentConstructor = Constructor;
    ConvenienceConstructor.originalSpec = spec;
    return ConvenienceConstructor;
  },

  /**
   * Checks if a value is a valid component constructor.
   *
   * @param {*}
   * @return {boolean}
   * @public
   */
  isValidClass: function(componentClass) {
    return componentClass instanceof Function &&
           'componentConstructor' in componentClass &&
           componentClass.componentConstructor instanceof Function;
  }
};

module.exports = ReactCompositeComponent;

},{"./ReactComponent":31,"./ReactCurrentOwner":35,"./ReactErrorUtils":49,"./ReactOwner":60,"./ReactPerf":61,"./ReactPropTransferer":62,"./ReactUpdates":67,"./invariant":104,"./keyMirror":110,"./merge":113,"./mixInto":116,"./objMap":118,"__browserify_process":124}],35:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactCurrentOwner
 */

"use strict";

/**
 * Keeps track of the current owner.
 *
 * The current owner is the component who should own any components that are
 * currently being constructed.
 *
 * The depth indicate how many composite components are above this render level.
 */
var ReactCurrentOwner = {

  /**
   * @internal
   * @type {ReactComponent}
   */
  current: null

};

module.exports = ReactCurrentOwner;

},{}],36:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOM
 * @typechecks static-only
 */

"use strict";

var ReactDOMComponent = require("./ReactDOMComponent");

var mergeInto = require("./mergeInto");
var objMapKeyVal = require("./objMapKeyVal");

/**
 * Creates a new React class that is idempotent and capable of containing other
 * React components. It accepts event listeners and DOM properties that are
 * valid according to `DOMProperty`.
 *
 *  - Event listeners: `onClick`, `onMouseDown`, etc.
 *  - DOM properties: `className`, `name`, `title`, etc.
 *
 * The `style` property functions differently from the DOM API. It accepts an
 * object mapping of style properties to values.
 *
 * @param {string} tag Tag name (e.g. `div`).
 * @param {boolean} omitClose True if the close tag should be omitted.
 * @private
 */
function createDOMComponentClass(tag, omitClose) {
  var Constructor = function() {};
  Constructor.prototype = new ReactDOMComponent(tag, omitClose);
  Constructor.prototype.constructor = Constructor;
  Constructor.displayName = tag;

  var ConvenienceConstructor = function(props, children) {
    var instance = new Constructor();
    instance.construct.apply(instance, arguments);
    return instance;
  };
  ConvenienceConstructor.componentConstructor = Constructor;
  return ConvenienceConstructor;
}

/**
 * Creates a mapping from supported HTML tags to `ReactDOMComponent` classes.
 * This is also accessible via `React.DOM`.
 *
 * @public
 */
var ReactDOM = objMapKeyVal({
  a: false,
  abbr: false,
  address: false,
  area: false,
  article: false,
  aside: false,
  audio: false,
  b: false,
  base: false,
  bdi: false,
  bdo: false,
  big: false,
  blockquote: false,
  body: false,
  br: true,
  button: false,
  canvas: false,
  caption: false,
  cite: false,
  code: false,
  col: true,
  colgroup: false,
  data: false,
  datalist: false,
  dd: false,
  del: false,
  details: false,
  dfn: false,
  div: false,
  dl: false,
  dt: false,
  em: false,
  embed: true,
  fieldset: false,
  figcaption: false,
  figure: false,
  footer: false,
  form: false, // NOTE: Injected, see `ReactDOMForm`.
  h1: false,
  h2: false,
  h3: false,
  h4: false,
  h5: false,
  h6: false,
  head: false,
  header: false,
  hr: true,
  html: false,
  i: false,
  iframe: false,
  img: true,
  input: true,
  ins: false,
  kbd: false,
  keygen: true,
  label: false,
  legend: false,
  li: false,
  link: false,
  main: false,
  map: false,
  mark: false,
  menu: false,
  menuitem: false, // NOTE: Close tag should be omitted, but causes problems.
  meta: true,
  meter: false,
  nav: false,
  noscript: false,
  object: false,
  ol: false,
  optgroup: false,
  option: false,
  output: false,
  p: false,
  param: true,
  pre: false,
  progress: false,
  q: false,
  rp: false,
  rt: false,
  ruby: false,
  s: false,
  samp: false,
  script: false,
  section: false,
  select: false,
  small: false,
  source: false,
  span: false,
  strong: false,
  style: false,
  sub: false,
  summary: false,
  sup: false,
  table: false,
  tbody: false,
  td: false,
  textarea: false, // NOTE: Injected, see `ReactDOMTextarea`.
  tfoot: false,
  th: false,
  thead: false,
  time: false,
  title: false,
  tr: false,
  track: true,
  u: false,
  ul: false,
  'var': false,
  video: false,
  wbr: false,

  // SVG
  circle: false,
  g: false,
  line: false,
  path: false,
  polyline: false,
  rect: false,
  svg: false,
  text: false
}, createDOMComponentClass);

var injection = {
  injectComponentClasses: function(componentClasses) {
    mergeInto(ReactDOM, componentClasses);
  }
};

ReactDOM.injection = injection;

module.exports = ReactDOM;

},{"./ReactDOMComponent":38,"./mergeInto":115,"./objMapKeyVal":119}],37:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOMButton
 */

"use strict";

var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");

var keyMirror = require("./keyMirror");

// Store a reference to the <button> `ReactDOMComponent`.
var button = ReactDOM.button;

var mouseListenerNames = keyMirror({
  onClick: true,
  onDoubleClick: true,
  onMouseDown: true,
  onMouseMove: true,
  onMouseUp: true,
  onClickCapture: true,
  onDoubleClickCapture: true,
  onMouseDownCapture: true,
  onMouseMoveCapture: true,
  onMouseUpCapture: true
});

/**
 * Implements a <button> native component that does not receive mouse events
 * when `disabled` is set.
 */
var ReactDOMButton = ReactCompositeComponent.createClass({

  render: function() {
    var props = {};

    // Copy the props; except the mouse listeners if we're disabled
    for (var key in this.props) {
      if (this.props.hasOwnProperty(key) &&
          (!this.props.disabled || !mouseListenerNames[key])) {
        props[key] = this.props[key];
      }
    }

    return button(props, this.props.children);
  }

});

module.exports = ReactDOMButton;

},{"./ReactCompositeComponent":34,"./ReactDOM":36,"./keyMirror":110}],38:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOMComponent
 * @typechecks static-only
 */

"use strict";

var CSSPropertyOperations = require("./CSSPropertyOperations");
var DOMProperty = require("./DOMProperty");
var DOMPropertyOperations = require("./DOMPropertyOperations");
var ReactComponent = require("./ReactComponent");
var ReactEventEmitter = require("./ReactEventEmitter");
var ReactMultiChild = require("./ReactMultiChild");
var ReactMount = require("./ReactMount");
var ReactPerf = require("./ReactPerf");

var escapeTextForBrowser = require("./escapeTextForBrowser");
var invariant = require("./invariant");
var keyOf = require("./keyOf");
var merge = require("./merge");
var mixInto = require("./mixInto");

var putListener = ReactEventEmitter.putListener;
var deleteListener = ReactEventEmitter.deleteListener;
var registrationNames = ReactEventEmitter.registrationNames;

// For quickly matching children type, to test if can be treated as content.
var CONTENT_TYPES = {'string': true, 'number': true};

var STYLE = keyOf({style: null});

/**
 * @param {?object} props
 */
function assertValidProps(props) {
  if (!props) {
    return;
  }
  // Note the use of `==` which checks for null or undefined.
  ("production" !== process.env.NODE_ENV ? invariant(
    props.children == null || props.dangerouslySetInnerHTML == null,
    'Can only set one of `children` or `props.dangerouslySetInnerHTML`.'
  ) : invariant(props.children == null || props.dangerouslySetInnerHTML == null));
  ("production" !== process.env.NODE_ENV ? invariant(
    props.style == null || typeof props.style === 'object',
    'The `style` prop expects a mapping from style properties to values, ' +
    'not a string.'
  ) : invariant(props.style == null || typeof props.style === 'object'));
}

/**
 * @constructor ReactDOMComponent
 * @extends ReactComponent
 * @extends ReactMultiChild
 */
function ReactDOMComponent(tag, omitClose) {
  this._tagOpen = '<' + tag;
  this._tagClose = omitClose ? '' : '</' + tag + '>';
  this.tagName = tag.toUpperCase();
}

ReactDOMComponent.Mixin = {

  /**
   * Generates root tag markup then recurses. This method has side effects and
   * is not idempotent.
   *
   * @internal
   * @param {string} rootID The root DOM ID for this node.
   * @param {ReactReconcileTransaction} transaction
   * @param {number} mountDepth number of components in the owner hierarchy
   * @return {string} The computed markup.
   */
  mountComponent: ReactPerf.measure(
    'ReactDOMComponent',
    'mountComponent',
    function(rootID, transaction, mountDepth) {
      ReactComponent.Mixin.mountComponent.call(
        this,
        rootID,
        transaction,
        mountDepth
      );
      assertValidProps(this.props);
      return (
        this._createOpenTagMarkup() +
        this._createContentMarkup(transaction) +
        this._tagClose
      );
    }
  ),

  /**
   * Creates markup for the open tag and all attributes.
   *
   * This method has side effects because events get registered.
   *
   * Iterating over object properties is faster than iterating over arrays.
   * @see http://jsperf.com/obj-vs-arr-iteration
   *
   * @private
   * @return {string} Markup of opening tag.
   */
  _createOpenTagMarkup: function() {
    var props = this.props;
    var ret = this._tagOpen;

    for (var propKey in props) {
      if (!props.hasOwnProperty(propKey)) {
        continue;
      }
      var propValue = props[propKey];
      if (propValue == null) {
        continue;
      }
      if (registrationNames[propKey]) {
        putListener(this._rootNodeID, propKey, propValue);
      } else {
        if (propKey === STYLE) {
          if (propValue) {
            propValue = props.style = merge(props.style);
          }
          propValue = CSSPropertyOperations.createMarkupForStyles(propValue);
        }
        var markup =
          DOMPropertyOperations.createMarkupForProperty(propKey, propValue);
        if (markup) {
          ret += ' ' + markup;
        }
      }
    }

    var escapedID = escapeTextForBrowser(this._rootNodeID);
    return ret + ' ' + ReactMount.ATTR_NAME + '="' + escapedID + '">';
  },

  /**
   * Creates markup for the content between the tags.
   *
   * @private
   * @param {ReactReconcileTransaction} transaction
   * @return {string} Content markup.
   */
  _createContentMarkup: function(transaction) {
    // Intentional use of != to avoid catching zero/false.
    var innerHTML = this.props.dangerouslySetInnerHTML;
    if (innerHTML != null) {
      if (innerHTML.__html != null) {
        return innerHTML.__html;
      }
    } else {
      var contentToUse =
        CONTENT_TYPES[typeof this.props.children] ? this.props.children : null;
      var childrenToUse = contentToUse != null ? null : this.props.children;
      if (contentToUse != null) {
        return escapeTextForBrowser(contentToUse);
      } else if (childrenToUse != null) {
        var mountImages = this.mountChildren(
          childrenToUse,
          transaction
        );
        return mountImages.join('');
      }
    }
    return '';
  },

  receiveComponent: function(nextComponent, transaction) {
    assertValidProps(nextComponent.props);
    ReactComponent.Mixin.receiveComponent.call(
      this,
      nextComponent,
      transaction
    );
  },

  /**
   * Updates a native DOM component after it has already been allocated and
   * attached to the DOM. Reconciles the root DOM node, then recurses.
   *
   * @param {ReactReconcileTransaction} transaction
   * @param {object} prevProps
   * @internal
   * @overridable
   */
  updateComponent: ReactPerf.measure(
    'ReactDOMComponent',
    'updateComponent',
    function(transaction, prevProps) {
      ReactComponent.Mixin.updateComponent.call(this, transaction, prevProps);
      this._updateDOMProperties(prevProps);
      this._updateDOMChildren(prevProps, transaction);
    }
  ),

  /**
   * Reconciles the properties by detecting differences in property values and
   * updating the DOM as necessary. This function is probably the single most
   * critical path for performance optimization.
   *
   * TODO: Benchmark whether checking for changed values in memory actually
   *       improves performance (especially statically positioned elements).
   * TODO: Benchmark the effects of putting this at the top since 99% of props
   *       do not change for a given reconciliation.
   * TODO: Benchmark areas that can be improved with caching.
   *
   * @private
   * @param {object} lastProps
   */
  _updateDOMProperties: function(lastProps) {
    var nextProps = this.props;
    var propKey;
    var styleName;
    var styleUpdates;
    for (propKey in lastProps) {
      if (nextProps.hasOwnProperty(propKey) ||
         !lastProps.hasOwnProperty(propKey)) {
        continue;
      }
      if (propKey === STYLE) {
        var lastStyle = lastProps[propKey];
        for (styleName in lastStyle) {
          if (lastStyle.hasOwnProperty(styleName)) {
            styleUpdates = styleUpdates || {};
            styleUpdates[styleName] = '';
          }
        }
      } else if (registrationNames[propKey]) {
        deleteListener(this._rootNodeID, propKey);
      } else if (
          DOMProperty.isStandardName[propKey] ||
          DOMProperty.isCustomAttribute(propKey)) {
        ReactComponent.DOMIDOperations.deletePropertyByID(
          this._rootNodeID,
          propKey
        );
      }
    }
    for (propKey in nextProps) {
      var nextProp = nextProps[propKey];
      var lastProp = lastProps[propKey];
      if (!nextProps.hasOwnProperty(propKey) || nextProp === lastProp) {
        continue;
      }
      if (propKey === STYLE) {
        if (nextProp) {
          nextProp = nextProps.style = merge(nextProp);
        }
        if (lastProp) {
          // Unset styles on `lastProp` but not on `nextProp`.
          for (styleName in lastProp) {
            if (lastProp.hasOwnProperty(styleName) &&
                !nextProp.hasOwnProperty(styleName)) {
              styleUpdates = styleUpdates || {};
              styleUpdates[styleName] = '';
            }
          }
          // Update styles that changed since `lastProp`.
          for (styleName in nextProp) {
            if (nextProp.hasOwnProperty(styleName) &&
                lastProp[styleName] !== nextProp[styleName]) {
              styleUpdates = styleUpdates || {};
              styleUpdates[styleName] = nextProp[styleName];
            }
          }
        } else {
          // Relies on `updateStylesByID` not mutating `styleUpdates`.
          styleUpdates = nextProp;
        }
      } else if (registrationNames[propKey]) {
        putListener(this._rootNodeID, propKey, nextProp);
      } else if (
          DOMProperty.isStandardName[propKey] ||
          DOMProperty.isCustomAttribute(propKey)) {
        ReactComponent.DOMIDOperations.updatePropertyByID(
          this._rootNodeID,
          propKey,
          nextProp
        );
      }
    }
    if (styleUpdates) {
      ReactComponent.DOMIDOperations.updateStylesByID(
        this._rootNodeID,
        styleUpdates
      );
    }
  },

  /**
   * Reconciles the children with the various properties that affect the
   * children content.
   *
   * @param {object} lastProps
   * @param {ReactReconcileTransaction} transaction
   */
  _updateDOMChildren: function(lastProps, transaction) {
    var nextProps = this.props;

    var lastContent =
      CONTENT_TYPES[typeof lastProps.children] ? lastProps.children : null;
    var nextContent =
      CONTENT_TYPES[typeof nextProps.children] ? nextProps.children : null;

    var lastHtml =
      lastProps.dangerouslySetInnerHTML &&
      lastProps.dangerouslySetInnerHTML.__html;
    var nextHtml =
      nextProps.dangerouslySetInnerHTML &&
      nextProps.dangerouslySetInnerHTML.__html;

    // Note the use of `!=` which checks for null or undefined.
    var lastChildren = lastContent != null ? null : lastProps.children;
    var nextChildren = nextContent != null ? null : nextProps.children;

    // If we're switching from children to content/html or vice versa, remove
    // the old content
    var lastHasContentOrHtml = lastContent != null || lastHtml != null;
    var nextHasContentOrHtml = nextContent != null || nextHtml != null;
    if (lastChildren != null && nextChildren == null) {
      this.updateChildren(null, transaction);
    } else if (lastHasContentOrHtml && !nextHasContentOrHtml) {
      this.updateTextContent('');
    }

    if (nextContent != null) {
      if (lastContent !== nextContent) {
        this.updateTextContent('' + nextContent);
      }
    } else if (nextHtml != null) {
      if (lastHtml !== nextHtml) {
        ReactComponent.DOMIDOperations.updateInnerHTMLByID(
          this._rootNodeID,
          nextHtml
        );
      }
    } else if (nextChildren != null) {
      this.updateChildren(nextChildren, transaction);
    }
  },

  /**
   * Destroys all event registrations for this instance. Does not remove from
   * the DOM. That must be done by the parent.
   *
   * @internal
   */
  unmountComponent: function() {
    ReactEventEmitter.deleteAllListeners(this._rootNodeID);
    ReactComponent.Mixin.unmountComponent.call(this);
    this.unmountChildren();
  }

};

mixInto(ReactDOMComponent, ReactComponent.Mixin);
mixInto(ReactDOMComponent, ReactDOMComponent.Mixin);
mixInto(ReactDOMComponent, ReactMultiChild.Mixin);

module.exports = ReactDOMComponent;

},{"./CSSPropertyOperations":9,"./DOMProperty":14,"./DOMPropertyOperations":15,"./ReactComponent":31,"./ReactEventEmitter":50,"./ReactMount":56,"./ReactMultiChild":58,"./ReactPerf":61,"./escapeTextForBrowser":90,"./invariant":104,"./keyOf":111,"./merge":113,"./mixInto":116,"__browserify_process":124}],39:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOMForm
 */

"use strict";

var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");
var ReactEventEmitter = require("./ReactEventEmitter");
var EventConstants = require("./EventConstants");

// Store a reference to the <form> `ReactDOMComponent`.
var form = ReactDOM.form;

/**
 * Since onSubmit doesn't bubble OR capture on the top level in IE8, we need
 * to capture it on the <form> element itself. There are lots of hacks we could
 * do to accomplish this, but the most reliable is to make <form> a
 * composite component and use `componentDidMount` to attach the event handlers.
 */
var ReactDOMForm = ReactCompositeComponent.createClass({
  render: function() {
    // TODO: Instead of using `ReactDOM` directly, we should use JSX. However,
    // `jshint` fails to parse JSX so in order for linting to work in the open
    // source repo, we need to just use `ReactDOM.form`.
    return this.transferPropsTo(form(null, this.props.children));
  },

  componentDidMount: function(node) {
    ReactEventEmitter.trapBubbledEvent(
      EventConstants.topLevelTypes.topSubmit,
      'submit',
      node
    );
  }
});

module.exports = ReactDOMForm;

},{"./EventConstants":20,"./ReactCompositeComponent":34,"./ReactDOM":36,"./ReactEventEmitter":50}],40:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOMIDOperations
 * @typechecks static-only
 */

/*jslint evil: true */

"use strict";

var CSSPropertyOperations = require("./CSSPropertyOperations");
var DOMChildrenOperations = require("./DOMChildrenOperations");
var DOMPropertyOperations = require("./DOMPropertyOperations");
var ReactMount = require("./ReactMount");

var getTextContentAccessor = require("./getTextContentAccessor");
var invariant = require("./invariant");

/**
 * Errors for properties that should not be updated with `updatePropertyById()`.
 *
 * @type {object}
 * @private
 */
var INVALID_PROPERTY_ERRORS = {
  dangerouslySetInnerHTML:
    '`dangerouslySetInnerHTML` must be set using `updateInnerHTMLByID()`.',
  style: '`style` must be set using `updateStylesByID()`.'
};

/**
 * The DOM property to use when setting text content.
 *
 * @type {string}
 * @private
 */
var textContentAccessor = getTextContentAccessor() || 'NA';

var LEADING_SPACE = /^ /;

/**
 * Operations used to process updates to DOM nodes. This is made injectable via
 * `ReactComponent.DOMIDOperations`.
 */
var ReactDOMIDOperations = {

  /**
   * Updates a DOM node with new property values. This should only be used to
   * update DOM properties in `DOMProperty`.
   *
   * @param {string} id ID of the node to update.
   * @param {string} name A valid property name, see `DOMProperty`.
   * @param {*} value New value of the property.
   * @internal
   */
  updatePropertyByID: function(id, name, value) {
    var node = ReactMount.getNode(id);
    ("production" !== process.env.NODE_ENV ? invariant(
      !INVALID_PROPERTY_ERRORS.hasOwnProperty(name),
      'updatePropertyByID(...): %s',
      INVALID_PROPERTY_ERRORS[name]
    ) : invariant(!INVALID_PROPERTY_ERRORS.hasOwnProperty(name)));

    // If we're updating to null or undefined, we should remove the property
    // from the DOM node instead of inadvertantly setting to a string. This
    // brings us in line with the same behavior we have on initial render.
    if (value != null) {
      DOMPropertyOperations.setValueForProperty(node, name, value);
    } else {
      DOMPropertyOperations.deleteValueForProperty(node, name);
    }
  },

  /**
   * Updates a DOM node to remove a property. This should only be used to remove
   * DOM properties in `DOMProperty`.
   *
   * @param {string} id ID of the node to update.
   * @param {string} name A property name to remove, see `DOMProperty`.
   * @internal
   */
  deletePropertyByID: function(id, name, value) {
    var node = ReactMount.getNode(id);
    ("production" !== process.env.NODE_ENV ? invariant(
      !INVALID_PROPERTY_ERRORS.hasOwnProperty(name),
      'updatePropertyByID(...): %s',
      INVALID_PROPERTY_ERRORS[name]
    ) : invariant(!INVALID_PROPERTY_ERRORS.hasOwnProperty(name)));
    DOMPropertyOperations.deleteValueForProperty(node, name, value);
  },

  /**
   * Updates a DOM node with new style values. If a value is specified as '',
   * the corresponding style property will be unset.
   *
   * @param {string} id ID of the node to update.
   * @param {object} styles Mapping from styles to values.
   * @internal
   */
  updateStylesByID: function(id, styles) {
    var node = ReactMount.getNode(id);
    CSSPropertyOperations.setValueForStyles(node, styles);
  },

  /**
   * Updates a DOM node's innerHTML.
   *
   * @param {string} id ID of the node to update.
   * @param {string} html An HTML string.
   * @internal
   */
  updateInnerHTMLByID: function(id, html) {
    var node = ReactMount.getNode(id);
    // HACK: IE8- normalize whitespace in innerHTML, removing leading spaces.
    // @see quirksmode.org/bugreports/archives/2004/11/innerhtml_and_t.html
    node.innerHTML = html.replace(LEADING_SPACE, '&nbsp;');
  },

  /**
   * Updates a DOM node's text content set by `props.content`.
   *
   * @param {string} id ID of the node to update.
   * @param {string} content Text content.
   * @internal
   */
  updateTextContentByID: function(id, content) {
    var node = ReactMount.getNode(id);
    node[textContentAccessor] = content;
  },

  /**
   * Replaces a DOM node that exists in the document with markup.
   *
   * @param {string} id ID of child to be replaced.
   * @param {string} markup Dangerous markup to inject in place of child.
   * @internal
   * @see {Danger.dangerouslyReplaceNodeWithMarkup}
   */
  dangerouslyReplaceNodeWithMarkupByID: function(id, markup) {
    var node = ReactMount.getNode(id);
    DOMChildrenOperations.dangerouslyReplaceNodeWithMarkup(node, markup);
  },

  /**
   * Updates a component's children by processing a series of updates.
   *
   * @param {array<object>} updates List of update configurations.
   * @param {array<string>} markup List of markup strings.
   * @internal
   */
  dangerouslyProcessChildrenUpdates: function(updates, markup) {
    for (var i = 0; i < updates.length; i++) {
      updates[i].parentNode = ReactMount.getNode(updates[i].parentID);
    }
    DOMChildrenOperations.processUpdates(updates, markup);
  }

};

module.exports = ReactDOMIDOperations;

},{"./CSSPropertyOperations":9,"./DOMChildrenOperations":13,"./DOMPropertyOperations":15,"./ReactMount":56,"./getTextContentAccessor":101,"./invariant":104,"__browserify_process":124}],41:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOMInput
 */

"use strict";

var DOMPropertyOperations = require("./DOMPropertyOperations");
var LinkedValueMixin = require("./LinkedValueMixin");
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");
var ReactMount = require("./ReactMount");

var invariant = require("./invariant");
var merge = require("./merge");

// Store a reference to the <input> `ReactDOMComponent`.
var input = ReactDOM.input;

var instancesByReactID = {};

/**
 * Implements an <input> native component that allows setting these optional
 * props: `checked`, `value`, `defaultChecked`, and `defaultValue`.
 *
 * If `checked` or `value` are not supplied (or null/undefined), user actions
 * that affect the checked state or value will trigger updates to the element.
 *
 * If they are supplied (and not null/undefined), the rendered element will not
 * trigger updates to the element. Instead, the props must change in order for
 * the rendered element to be updated.
 *
 * The rendered element will be initialized as unchecked (or `defaultChecked`)
 * with an empty value (or `defaultValue`).
 *
 * @see http://www.w3.org/TR/2012/WD-html5-20121025/the-input-element.html
 */
var ReactDOMInput = ReactCompositeComponent.createClass({
  mixins: [LinkedValueMixin],

  getInitialState: function() {
    var defaultValue = this.props.defaultValue;
    return {
      checked: this.props.defaultChecked || false,
      value: defaultValue != null ? defaultValue : null
    };
  },

  shouldComponentUpdate: function() {
    // Defer any updates to this component during the `onChange` handler.
    return !this._isChanging;
  },

  render: function() {
    // Clone `this.props` so we don't mutate the input.
    var props = merge(this.props);

    props.defaultChecked = null;
    props.defaultValue = null;
    props.checked =
      this.props.checked != null ? this.props.checked : this.state.checked;

    var value = this.getValue();
    props.value = value != null ? value : this.state.value;

    props.onChange = this._handleChange;

    return input(props, this.props.children);
  },

  componentDidMount: function(rootNode) {
    var id = ReactMount.getID(rootNode);
    instancesByReactID[id] = this;
  },

  componentWillUnmount: function() {
    var rootNode = this.getDOMNode();
    var id = ReactMount.getID(rootNode);
    delete instancesByReactID[id];
  },

  componentDidUpdate: function(prevProps, prevState, rootNode) {
    if (this.props.checked != null) {
      DOMPropertyOperations.setValueForProperty(
        rootNode,
        'checked',
        this.props.checked || false
      );
    }

    var value = this.getValue();
    if (value != null) {
      // Cast `value` to a string to ensure the value is set correctly. While
      // browsers typically do this as necessary, jsdom doesn't.
      DOMPropertyOperations.setValueForProperty(rootNode, 'value', '' + value);
    }
  },

  _handleChange: function(event) {
    var returnValue;
    var onChange = this.getOnChange();
    if (onChange) {
      this._isChanging = true;
      returnValue = onChange(event);
      this._isChanging = false;
    }
    this.setState({
      checked: event.target.checked,
      value: event.target.value
    });

    var name = this.props.name;
    if (this.props.type === 'radio' && name != null) {
      var rootNode = this.getDOMNode();
      // If `rootNode.form` was non-null, then we could try `form.elements`,
      // but that sometimes behaves strangely in IE8. We could also try using
      // `form.getElementsByName`, but that will only return direct children
      // and won't include inputs that use the HTML5 `form=` attribute. Since
      // the input might not even be in a form, let's just use the global
      // `getElementsByName` to ensure we don't miss anything.
      var group = document.getElementsByName(name);
      for (var i = 0, groupLen = group.length; i < groupLen; i++) {
        var otherNode = group[i];
        if (otherNode === rootNode ||
            otherNode.nodeName !== 'INPUT' || otherNode.type !== 'radio' ||
            otherNode.form !== rootNode.form) {
          continue;
        }
        var otherID = ReactMount.getID(otherNode);
        ("production" !== process.env.NODE_ENV ? invariant(
          otherID,
          'ReactDOMInput: Mixing React and non-React radio inputs with the ' +
          'same `name` is not supported.'
        ) : invariant(otherID));
        var otherInstance = instancesByReactID[otherID];
        ("production" !== process.env.NODE_ENV ? invariant(
          otherInstance,
          'ReactDOMInput: Unknown radio button ID %s.',
          otherID
        ) : invariant(otherInstance));
        // In some cases, this will actually change the `checked` state value.
        // In other cases, there's no change but this forces a reconcile upon
        // which componentDidUpdate will reset the DOM property to whatever it
        // should be.
        otherInstance.setState({
          checked: false
        });
      }
    }

    return returnValue;
  }

});

module.exports = ReactDOMInput;

},{"./DOMPropertyOperations":15,"./LinkedValueMixin":27,"./ReactCompositeComponent":34,"./ReactDOM":36,"./ReactMount":56,"./invariant":104,"./merge":113,"__browserify_process":124}],42:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOMOption
 */

"use strict";

var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");

// Store a reference to the <option> `ReactDOMComponent`.
var option = ReactDOM.option;

/**
 * Implements an <option> native component that warns when `selected` is set.
 */
var ReactDOMOption = ReactCompositeComponent.createClass({

  componentWillMount: function() {
    // TODO (yungsters): Remove support for `selected` in <option>.
    if (this.props.selected != null) {
      if ("production" !== process.env.NODE_ENV) {
        console.warn(
          'Use the `defaultValue` or `value` props on <select> instead of ' +
          'setting `selected` on <option>.'
        );
      }
    }
  },

  render: function() {
    return option(this.props, this.props.children);
  }

});

module.exports = ReactDOMOption;

},{"./ReactCompositeComponent":34,"./ReactDOM":36,"__browserify_process":124}],43:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOMSelect
 */

"use strict";

var LinkedValueMixin = require("./LinkedValueMixin");
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");

var invariant = require("./invariant");
var merge = require("./merge");

// Store a reference to the <select> `ReactDOMComponent`.
var select = ReactDOM.select;

/**
 * Validation function for `value` and `defaultValue`.
 * @private
 */
function selectValueType(props, propName, componentName) {
  if (props[propName] == null) {
    return;
  }
  if (props.multiple) {
    ("production" !== process.env.NODE_ENV ? invariant(
      Array.isArray(props[propName]),
      'The `%s` prop supplied to <select> must be an array if `multiple` is ' +
      'true.',
      propName
    ) : invariant(Array.isArray(props[propName])));
  } else {
    ("production" !== process.env.NODE_ENV ? invariant(
      !Array.isArray(props[propName]),
      'The `%s` prop supplied to <select> must be a scalar value if ' +
      '`multiple` is false.',
      propName
    ) : invariant(!Array.isArray(props[propName])));
  }
}

/**
 * If `value` is supplied, updates <option> elements on mount and update.
 * @private
 */
function updateOptions() {
  /*jshint validthis:true */
  var propValue = this.getValue();
  var value = propValue != null ? propValue : this.state.value;
  var options = this.getDOMNode().options;
  var selectedValue = '' + value;

  for (var i = 0, l = options.length; i < l; i++) {
    var selected = this.props.multiple ?
      selectedValue.indexOf(options[i].value) >= 0 :
      selected = options[i].value === selectedValue;

    if (selected !== options[i].selected) {
      options[i].selected = selected;
    }
  }
}

/**
 * Implements a <select> native component that allows optionally setting the
 * props `value` and `defaultValue`. If `multiple` is false, the prop must be a
 * string. If `multiple` is true, the prop must be an array of strings.
 *
 * If `value` is not supplied (or null/undefined), user actions that change the
 * selected option will trigger updates to the rendered options.
 *
 * If it is supplied (and not null/undefined), the rendered options will not
 * update in response to user actions. Instead, the `value` prop must change in
 * order for the rendered options to update.
 *
 * If `defaultValue` is provided, any options with the supplied values will be
 * selected.
 */
var ReactDOMSelect = ReactCompositeComponent.createClass({
  mixins: [LinkedValueMixin],

  propTypes: {
    defaultValue: selectValueType,
    value: selectValueType
  },

  getInitialState: function() {
    return {value: this.props.defaultValue || (this.props.multiple ? [] : '')};
  },

  componentWillReceiveProps: function(nextProps) {
    if (!this.props.multiple && nextProps.multiple) {
      this.setState({value: [this.state.value]});
    } else if (this.props.multiple && !nextProps.multiple) {
      this.setState({value: this.state.value[0]});
    }
  },

  shouldComponentUpdate: function() {
    // Defer any updates to this component during the `onChange` handler.
    return !this._isChanging;
  },

  render: function() {
    // Clone `this.props` so we don't mutate the input.
    var props = merge(this.props);

    props.onChange = this._handleChange;
    props.value = null;

    return select(props, this.props.children);
  },

  componentDidMount: updateOptions,

  componentDidUpdate: updateOptions,

  _handleChange: function(event) {
    var returnValue;
    var onChange = this.getOnChange();
    if (onChange) {
      this._isChanging = true;
      returnValue = onChange(event);
      this._isChanging = false;
    }

    var selectedValue;
    if (this.props.multiple) {
      selectedValue = [];
      var options = event.target.options;
      for (var i = 0, l = options.length; i < l; i++) {
        if (options[i].selected) {
          selectedValue.push(options[i].value);
        }
      }
    } else {
      selectedValue = event.target.value;
    }

    this.setState({value: selectedValue});
    return returnValue;
  }

});

module.exports = ReactDOMSelect;

},{"./LinkedValueMixin":27,"./ReactCompositeComponent":34,"./ReactDOM":36,"./invariant":104,"./merge":113,"__browserify_process":124}],44:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOMSelection
 */

"use strict";

var getNodeForCharacterOffset = require("./getNodeForCharacterOffset");
var getTextContentAccessor = require("./getTextContentAccessor");

/**
 * Get the appropriate anchor and focus node/offset pairs for IE.
 *
 * The catch here is that IE's selection API doesn't provide information
 * about whether the selection is forward or backward, so we have to
 * behave as though it's always forward.
 *
 * IE text differs from modern selection in that it behaves as though
 * block elements end with a new line. This means character offsets will
 * differ between the two APIs.
 *
 * @param {DOMElement} node
 * @return {object}
 */
function getIEOffsets(node) {
  var selection = document.selection;
  var selectedRange = selection.createRange();
  var selectedLength = selectedRange.text.length;

  // Duplicate selection so we can move range without breaking user selection.
  var fromStart = selectedRange.duplicate();
  fromStart.moveToElementText(node);
  fromStart.setEndPoint('EndToStart', selectedRange);

  var startOffset = fromStart.text.length;
  var endOffset = startOffset + selectedLength;

  return {
    start: startOffset,
    end: endOffset
  };
}

/**
 * @param {DOMElement} node
 * @return {?object}
 */
function getModernOffsets(node) {
  var selection = window.getSelection();

  if (selection.rangeCount === 0) {
    return null;
  }

  var anchorNode = selection.anchorNode;
  var anchorOffset = selection.anchorOffset;
  var focusNode = selection.focusNode;
  var focusOffset = selection.focusOffset;

  var currentRange = selection.getRangeAt(0);
  var rangeLength = currentRange.toString().length;

  var tempRange = currentRange.cloneRange();
  tempRange.selectNodeContents(node);
  tempRange.setEnd(currentRange.startContainer, currentRange.startOffset);

  var start = tempRange.toString().length;
  var end = start + rangeLength;

  // Detect whether the selection is backward.
  var detectionRange = document.createRange();
  detectionRange.setStart(anchorNode, anchorOffset);
  detectionRange.setEnd(focusNode, focusOffset);
  var isBackward = detectionRange.collapsed;
  detectionRange.detach();

  return {
    start: isBackward ? end : start,
    end: isBackward ? start : end
  };
}

/**
 * @param {DOMElement|DOMTextNode} node
 * @param {object} offsets
 */
function setIEOffsets(node, offsets) {
  var range = document.selection.createRange().duplicate();
  var start, end;

  if (typeof offsets.end === 'undefined') {
    start = offsets.start;
    end = start;
  } else if (offsets.start > offsets.end) {
    start = offsets.end;
    end = offsets.start;
  } else {
    start = offsets.start;
    end = offsets.end;
  }

  range.moveToElementText(node);
  range.moveStart('character', start);
  range.setEndPoint('EndToStart', range);
  range.moveEnd('character', end - start);
  range.select();
}

/**
 * In modern non-IE browsers, we can support both forward and backward
 * selections.
 *
 * Note: IE10+ supports the Selection object, but it does not support
 * the `extend` method, which means that even in modern IE, it's not possible
 * to programatically create a backward selection. Thus, for all IE
 * versions, we use the old IE API to create our selections.
 *
 * @param {DOMElement|DOMTextNode} node
 * @param {object} offsets
 */
function setModernOffsets(node, offsets) {
  var selection = window.getSelection();

  var length = node[getTextContentAccessor()].length;
  var start = Math.min(offsets.start, length);
  var end = typeof offsets.end === 'undefined' ?
            start : Math.min(offsets.end, length);

  // IE 11 uses modern selection, but doesn't support the extend method.
  // Flip backward selections, so we can set with a single range.
  if (!selection.extend && start > end) {
    var temp = end;
    end = start;
    start = temp;
  }

  var startMarker = getNodeForCharacterOffset(node, start);
  var endMarker = getNodeForCharacterOffset(node, end);

  if (startMarker && endMarker) {
    var range = document.createRange();
    range.setStart(startMarker.node, startMarker.offset);
    selection.removeAllRanges();

    if (start > end) {
      selection.addRange(range);
      selection.extend(endMarker.node, endMarker.offset);
    } else {
      range.setEnd(endMarker.node, endMarker.offset);
      selection.addRange(range);
    }

    range.detach();
  }
}

var ReactDOMSelection = {
  /**
   * @param {DOMElement} node
   */
  getOffsets: function(node) {
    var getOffsets = document.selection ? getIEOffsets : getModernOffsets;
    return getOffsets(node);
  },

  /**
   * @param {DOMElement|DOMTextNode} node
   * @param {object} offsets
   */
  setOffsets: function(node, offsets) {
    var setOffsets = document.selection ? setIEOffsets : setModernOffsets;
    setOffsets(node, offsets);
  }
};

module.exports = ReactDOMSelection;

},{"./getNodeForCharacterOffset":99,"./getTextContentAccessor":101}],45:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDOMTextarea
 */

"use strict";

var DOMPropertyOperations = require("./DOMPropertyOperations");
var LinkedValueMixin = require("./LinkedValueMixin");
var ReactCompositeComponent = require("./ReactCompositeComponent");
var ReactDOM = require("./ReactDOM");

var invariant = require("./invariant");
var merge = require("./merge");

// Store a reference to the <textarea> `ReactDOMComponent`.
var textarea = ReactDOM.textarea;

/**
 * Implements a <textarea> native component that allows setting `value`, and
 * `defaultValue`. This differs from the traditional DOM API because value is
 * usually set as PCDATA children.
 *
 * If `value` is not supplied (or null/undefined), user actions that affect the
 * value will trigger updates to the element.
 *
 * If `value` is supplied (and not null/undefined), the rendered element will
 * not trigger updates to the element. Instead, the `value` prop must change in
 * order for the rendered element to be updated.
 *
 * The rendered element will be initialized with an empty value, the prop
 * `defaultValue` if specified, or the children content (deprecated).
 */
var ReactDOMTextarea = ReactCompositeComponent.createClass({
  mixins: [LinkedValueMixin],

  getInitialState: function() {
    var defaultValue = this.props.defaultValue;
    // TODO (yungsters): Remove support for children content in <textarea>.
    var children = this.props.children;
    if (children != null) {
      if ("production" !== process.env.NODE_ENV) {
        console.warn(
          'Use the `defaultValue` or `value` props instead of setting ' +
          'children on <textarea>.'
        );
      }
      ("production" !== process.env.NODE_ENV ? invariant(
        defaultValue == null,
        'If you supply `defaultValue` on a <textarea>, do not pass children.'
      ) : invariant(defaultValue == null));
      if (Array.isArray(children)) {
        ("production" !== process.env.NODE_ENV ? invariant(
          children.length <= 1,
          '<textarea> can only have at most one child.'
        ) : invariant(children.length <= 1));
        children = children[0];
      }

      defaultValue = '' + children;
    }
    if (defaultValue == null) {
      defaultValue = '';
    }
    var value = this.getValue();
    return {
      // We save the initial value so that `ReactDOMComponent` doesn't update
      // `textContent` (unnecessary since we update value).
      // The initial value can be a boolean or object so that's why it's
      // forced to be a string.
      initialValue: '' + (value != null ? value : defaultValue),
      value: defaultValue
    };
  },

  shouldComponentUpdate: function() {
    // Defer any updates to this component during the `onChange` handler.
    return !this._isChanging;
  },

  render: function() {
    // Clone `this.props` so we don't mutate the input.
    var props = merge(this.props);
    var value = this.getValue();

    ("production" !== process.env.NODE_ENV ? invariant(
      props.dangerouslySetInnerHTML == null,
      '`dangerouslySetInnerHTML` does not make sense on <textarea>.'
    ) : invariant(props.dangerouslySetInnerHTML == null));

    props.defaultValue = null;
    props.value = value != null ? value : this.state.value;
    props.onChange = this._handleChange;

    // Always set children to the same thing. In IE9, the selection range will
    // get reset if `textContent` is mutated.
    return textarea(props, this.state.initialValue);
  },

  componentDidUpdate: function(prevProps, prevState, rootNode) {
    var value = this.getValue();
    if (value != null) {
      // Cast `value` to a string to ensure the value is set correctly. While
      // browsers typically do this as necessary, jsdom doesn't.
      DOMPropertyOperations.setValueForProperty(rootNode, 'value', '' + value);
    }
  },

  _handleChange: function(event) {
    var returnValue;
    var onChange = this.getOnChange();
    if (onChange) {
      this._isChanging = true;
      returnValue = onChange(event);
      this._isChanging = false;
    }
    this.setState({value: event.target.value});
    return returnValue;
  }

});

module.exports = ReactDOMTextarea;

},{"./DOMPropertyOperations":15,"./LinkedValueMixin":27,"./ReactCompositeComponent":34,"./ReactDOM":36,"./invariant":104,"./merge":113,"__browserify_process":124}],46:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDefaultBatchingStrategy
 */

"use strict";

var ReactUpdates = require("./ReactUpdates");
var Transaction = require("./Transaction");

var emptyFunction = require("./emptyFunction");
var mixInto = require("./mixInto");

var RESET_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: function() {
    ReactDefaultBatchingStrategy.isBatchingUpdates = false;
  }
};

var FLUSH_BATCHED_UPDATES = {
  initialize: emptyFunction,
  close: ReactUpdates.flushBatchedUpdates.bind(ReactUpdates)
};

var TRANSACTION_WRAPPERS = [FLUSH_BATCHED_UPDATES, RESET_BATCHED_UPDATES];

function ReactDefaultBatchingStrategyTransaction() {
  this.reinitializeTransaction();
}

mixInto(ReactDefaultBatchingStrategyTransaction, Transaction.Mixin);
mixInto(ReactDefaultBatchingStrategyTransaction, {
  getTransactionWrappers: function() {
    return TRANSACTION_WRAPPERS;
  }
});

var transaction = new ReactDefaultBatchingStrategyTransaction();

var ReactDefaultBatchingStrategy = {
  isBatchingUpdates: false,

  /**
   * Call the provided function in a context within which calls to `setState`
   * and friends are batched such that components aren't updated unnecessarily.
   */
  batchedUpdates: function(callback, param) {
    var alreadyBatchingUpdates = ReactDefaultBatchingStrategy.isBatchingUpdates;

    ReactDefaultBatchingStrategy.isBatchingUpdates = true;

    // The code is written this way to avoid extra allocations
    if (alreadyBatchingUpdates) {
      callback(param);
    } else {
      transaction.perform(callback, null, param);
    }
  }
};

module.exports = ReactDefaultBatchingStrategy;

},{"./ReactUpdates":67,"./Transaction":79,"./emptyFunction":89,"./mixInto":116}],47:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDefaultInjection
 */

"use strict";

var ReactDOM = require("./ReactDOM");
var ReactDOMButton = require("./ReactDOMButton");
var ReactDOMForm = require("./ReactDOMForm");
var ReactDOMInput = require("./ReactDOMInput");
var ReactDOMOption = require("./ReactDOMOption");
var ReactDOMSelect = require("./ReactDOMSelect");
var ReactDOMTextarea = require("./ReactDOMTextarea");
var ReactEventEmitter = require("./ReactEventEmitter");
var ReactEventTopLevelCallback = require("./ReactEventTopLevelCallback");
var ReactPerf = require("./ReactPerf");

var DefaultDOMPropertyConfig = require("./DefaultDOMPropertyConfig");
var DOMProperty = require("./DOMProperty");

var ChangeEventPlugin = require("./ChangeEventPlugin");
var CompositionEventPlugin = require("./CompositionEventPlugin");
var DefaultEventPluginOrder = require("./DefaultEventPluginOrder");
var EnterLeaveEventPlugin = require("./EnterLeaveEventPlugin");
var EventPluginHub = require("./EventPluginHub");
var MobileSafariClickEventPlugin = require("./MobileSafariClickEventPlugin");
var ReactInstanceHandles = require("./ReactInstanceHandles");
var SelectEventPlugin = require("./SelectEventPlugin");
var SimpleEventPlugin = require("./SimpleEventPlugin");

var ReactDefaultBatchingStrategy = require("./ReactDefaultBatchingStrategy");
var ReactUpdates = require("./ReactUpdates");

function inject() {
  ReactEventEmitter.TopLevelCallbackCreator = ReactEventTopLevelCallback;
  /**
   * Inject module for resolving DOM hierarchy and plugin ordering.
   */
  EventPluginHub.injection.injectEventPluginOrder(DefaultEventPluginOrder);
  EventPluginHub.injection.injectInstanceHandle(ReactInstanceHandles);

  /**
   * Some important event plugins included by default (without having to require
   * them).
   */
  EventPluginHub.injection.injectEventPluginsByName({
    SimpleEventPlugin: SimpleEventPlugin,
    EnterLeaveEventPlugin: EnterLeaveEventPlugin,
    ChangeEventPlugin: ChangeEventPlugin,
    CompositionEventPlugin: CompositionEventPlugin,
    MobileSafariClickEventPlugin: MobileSafariClickEventPlugin,
    SelectEventPlugin: SelectEventPlugin
  });

  ReactDOM.injection.injectComponentClasses({
    button: ReactDOMButton,
    form: ReactDOMForm,
    input: ReactDOMInput,
    option: ReactDOMOption,
    select: ReactDOMSelect,
    textarea: ReactDOMTextarea
  });

  DOMProperty.injection.injectDOMPropertyConfig(DefaultDOMPropertyConfig);

  if ("production" !== process.env.NODE_ENV) {
    ReactPerf.injection.injectMeasure(require("./ReactDefaultPerf").measure);
  }

  ReactUpdates.injection.injectBatchingStrategy(
    ReactDefaultBatchingStrategy
  );
}

module.exports = {
  inject: inject
};

},{"./ChangeEventPlugin":11,"./CompositionEventPlugin":12,"./DOMProperty":14,"./DefaultDOMPropertyConfig":17,"./DefaultEventPluginOrder":18,"./EnterLeaveEventPlugin":19,"./EventPluginHub":22,"./MobileSafariClickEventPlugin":28,"./ReactDOM":36,"./ReactDOMButton":37,"./ReactDOMForm":39,"./ReactDOMInput":41,"./ReactDOMOption":42,"./ReactDOMSelect":43,"./ReactDOMTextarea":45,"./ReactDefaultBatchingStrategy":46,"./ReactDefaultPerf":48,"./ReactEventEmitter":50,"./ReactEventTopLevelCallback":52,"./ReactInstanceHandles":54,"./ReactPerf":61,"./ReactUpdates":67,"./SelectEventPlugin":68,"./SimpleEventPlugin":69,"__browserify_process":124}],48:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactDefaultPerf
 * @typechecks static-only
 */

"use strict";

var performanceNow = require("./performanceNow");

var ReactDefaultPerf = {};

if ("production" !== process.env.NODE_ENV) {
  ReactDefaultPerf = {
    /**
     * Gets the stored information for a given object's function.
     *
     * @param {string} objName
     * @param {string} fnName
     * @return {?object}
     */
    getInfo: function(objName, fnName) {
      if (!this.info[objName] || !this.info[objName][fnName]) {
        return null;
      }
      return this.info[objName][fnName];
    },

    /**
     * Gets the logs pertaining to a given object's function.
     *
     * @param {string} objName
     * @param {string} fnName
     * @return {?array<object>}
     */
    getLogs: function(objName, fnName) {
      if (!this.getInfo(objName, fnName)) {
        return null;
      }
      return this.logs.filter(function(log) {
        return log.objName === objName && log.fnName === fnName;
      });
    },

    /**
     * Runs through the logs and builds an array of arrays, where each array
     * walks through the mounting/updating of each component underneath.
     *
     * @param {string} rootID The reactID of the root node, e.g. '.r[2cpyq]'
     * @return {array<array>}
     */
    getRawRenderHistory: function(rootID) {
      var history = [];
      /**
       * Since logs are added after the method returns, the logs are in a sense
       * upside-down: the inner-most elements from mounting/updating are logged
       * first, and the last addition to the log is the top renderComponent.
       * Therefore, we flip the logs upside down for ease of processing, and
       * reverse the history array at the end so the earliest event has index 0.
       */
      var logs = this.logs.filter(function(log) {
        return log.reactID.indexOf(rootID) === 0;
      }).reverse();

      var subHistory = [];
      logs.forEach(function(log, i) {
        if (i && log.reactID === rootID && logs[i - 1].reactID !== rootID) {
          subHistory.length && history.push(subHistory);
          subHistory = [];
        }
        subHistory.push(log);
      });
      if (subHistory.length) {
        history.push(subHistory);
      }
      return history.reverse();
    },

    /**
     * Runs through the logs and builds an array of strings, where each string
     * is a multiline formatted way of walking through the mounting/updating
     * underneath.
     *
     * @param {string} rootID The reactID of the root node, e.g. '.r[2cpyq]'
     * @return {array<string>}
     */
    getRenderHistory: function(rootID) {
      var history = this.getRawRenderHistory(rootID);

      return history.map(function(subHistory) {
        var headerString = (
          'log# Component (execution time) [bloat from logging]\n' +
          '================================================================\n'
        );
        return headerString + subHistory.map(function(log) {
          // Add two spaces for every layer in the reactID.
          var indents = '\t' + Array(log.reactID.split('.[').length).join('  ');
          var delta = _microTime(log.timing.delta);
          var bloat = _microTime(log.timing.timeToLog);

          return log.index + indents + log.name + ' (' + delta + 'ms)' +
            ' [' + bloat + 'ms]';
        }).join('\n');
      });
    },

    /**
     * Print the render history from `getRenderHistory` using console.log.
     * This is currently the best way to display perf data from
     * any React component; working on that.
     *
     * @param {string} rootID The reactID of the root node, e.g. '.r[2cpyq]'
     * @param {number} index
     */
    printRenderHistory: function(rootID, index) {
      var history = this.getRenderHistory(rootID);
      if (!history[index]) {
        console.warn(
          'Index', index, 'isn\'t available! ' +
          'The render history is', history.length, 'long.'
        );
        return;
      }
      console.log(
        'Loading render history #' + (index + 1) +
        ' of ' + history.length + ':\n' + history[index]
      );
    },

    /**
     * Prints the heatmap legend to console, showing how the colors correspond
     * with render times. This relies on console.log styles.
     */
    printHeatmapLegend: function() {
      if (!this.options.heatmap.enabled) {
        return;
      }
      var max = this.info.React
        && this.info.React.renderComponent
        && this.info.React.renderComponent.max;
      if (max) {
        var logStr = 'Heatmap: ';
        for (var ii = 0; ii <= 10 * max; ii += max) {
          logStr += '%c ' + (Math.round(ii) / 10) + 'ms ';
        }
        console.log(
          logStr,
          'background-color: hsla(100, 100%, 50%, 0.6);',
          'background-color: hsla( 90, 100%, 50%, 0.6);',
          'background-color: hsla( 80, 100%, 50%, 0.6);',
          'background-color: hsla( 70, 100%, 50%, 0.6);',
          'background-color: hsla( 60, 100%, 50%, 0.6);',
          'background-color: hsla( 50, 100%, 50%, 0.6);',
          'background-color: hsla( 40, 100%, 50%, 0.6);',
          'background-color: hsla( 30, 100%, 50%, 0.6);',
          'background-color: hsla( 20, 100%, 50%, 0.6);',
          'background-color: hsla( 10, 100%, 50%, 0.6);',
          'background-color: hsla(  0, 100%, 50%, 0.6);'
        );
      }
    },

    /**
     * Measure a given function with logging information, and calls a callback
     * if there is one.
     *
     * @param {string} objName
     * @param {string} fnName
     * @param {function} func
     * @return {function}
     */
    measure: function(objName, fnName, func) {
      var info = _getNewInfo(objName, fnName);

      var fnArgs = _getFnArguments(func);

      return function() {
        var timeBeforeFn = performanceNow();
        var fnReturn = func.apply(this, arguments);
        var timeAfterFn = performanceNow();

        /**
         * Hold onto arguments in a readable way: args[1] -> args.component.
         * args is also passed to the callback, so if you want to save an
         * argument in the log, do so in the callback.
         */
        var args = {};
        for (var i = 0; i < arguments.length; i++) {
          args[fnArgs[i]] = arguments[i];
        }

        var log = {
          index: ReactDefaultPerf.logs.length,
          fnName: fnName,
          objName: objName,
          timing: {
            before: timeBeforeFn,
            after: timeAfterFn,
            delta: timeAfterFn - timeBeforeFn
          }
        };

        ReactDefaultPerf.logs.push(log);

        /**
         * The callback gets:
         * - this (the component)
         * - the original method's arguments
         * - what the method returned
         * - the log object, and
         * - the wrapped method's info object.
         */
        var callback = _getCallback(objName, fnName);
        callback && callback(this, args, fnReturn, log, info);

        log.timing.timeToLog = performanceNow() - timeAfterFn;

        return fnReturn;
      };
    },

    /**
     * Holds information on wrapped objects/methods.
     * For instance, ReactDefaultPerf.info.React.renderComponent
     */
    info: {},

    /**
     * Holds all of the logs. Filter this to pull desired information.
     */
    logs: [],

    /**
     * Toggle settings for ReactDefaultPerf
     */
    options: {
      /**
       * The heatmap sets the background color of the React containers
       * according to how much total time has been spent rendering them.
       * The most temporally expensive component is set as pure red,
       * and the others are colored from green to red as a fraction
       * of that max component time.
       */
      heatmap: {
        enabled: true
      }
    }
  };

  /**
   * Gets a info area for a given object's function, adding a new one if
   * necessary.
   *
   * @param {string} objName
   * @param {string} fnName
   * @return {object}
   */
  var _getNewInfo = function(objName, fnName) {
    var info = ReactDefaultPerf.getInfo(objName, fnName);
    if (info) {
      return info;
    }
    ReactDefaultPerf.info[objName] = ReactDefaultPerf.info[objName] || {};

    return ReactDefaultPerf.info[objName][fnName] = {
      getLogs: function() {
        return ReactDefaultPerf.getLogs(objName, fnName);
      }
    };
  };

  /**
   * Gets a list of the argument names from a function's definition.
   * This is useful for storing arguments by their names within wrapFn().
   *
   * @param {function} fn
   * @return {array<string>}
   */
  var _getFnArguments = function(fn) {
    var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var fnStr = fn.toString().replace(STRIP_COMMENTS, '');
    fnStr = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'));
    return fnStr.match(/([^\s,]+)/g);
  };

  /**
   * Store common callbacks within ReactDefaultPerf.
   *
   * @param {string} objName
   * @param {string} fnName
   * @return {?function}
   */
  var _getCallback = function(objName, fnName) {
    switch (objName + '.' + fnName) {
      case 'React.renderComponent':
        return _renderComponentCallback;
      case 'ReactDOMComponent.mountComponent':
      case 'ReactDOMComponent.updateComponent':
        return _nativeComponentCallback;
      case 'ReactCompositeComponent.mountComponent':
      case 'ReactCompositeComponent.updateComponent':
        return _compositeComponentCallback;
      default:
        return null;
    }
  };

  /**
   * Callback function for React.renderComponent
   *
   * @param {object} component
   * @param {object} args
   * @param {?object} fnReturn
   * @param {object} log
   * @param {object} info
   */
  var _renderComponentCallback =
    function(component, args, fnReturn, log, info) {
    log.name = args.nextComponent.constructor.displayName || '[unknown]';
    log.reactID = fnReturn._rootNodeID || null;

    if (ReactDefaultPerf.options.heatmap.enabled) {
      var container = args.container;
      if (!container.loggedByReactDefaultPerf) {
        container.loggedByReactDefaultPerf = true;
        info.components = info.components || [];
        info.components.push(container);
      }

      container.count = container.count || 0;
      container.count += log.timing.delta;
      info.max = info.max || 0;
      if (container.count > info.max) {
        info.max = container.count;
        info.components.forEach(function(component) {
          _setHue(component, 100 - 100 * component.count / info.max);
        });
      } else {
        _setHue(container, 100 - 100 * container.count / info.max);
      }
    }
  };

  /**
   * Callback function for ReactDOMComponent
   *
   * @param {object} component
   * @param {object} args
   * @param {?object} fnReturn
   * @param {object} log
   * @param {object} info
   */
  var _nativeComponentCallback =
    function(component, args, fnReturn, log, info) {
    log.name = component.tagName || '[unknown]';
    log.reactID = component._rootNodeID;
  };

  /**
   * Callback function for ReactCompositeComponent
   *
   * @param {object} component
   * @param {object} args
   * @param {?object} fnReturn
   * @param {object} log
   * @param {object} info
   */
  var _compositeComponentCallback =
    function(component, args, fnReturn, log, info) {
    log.name = component.constructor.displayName || '[unknown]';
    log.reactID = component._rootNodeID;
  };

  /**
   * Using the hsl() background-color attribute, colors an element.
   *
   * @param {DOMElement} el
   * @param {number} hue [0 for red, 120 for green, 240 for blue]
   */
  var _setHue = function(el, hue) {
    el.style.backgroundColor = 'hsla(' + hue + ', 100%, 50%, 0.6)';
  };

  /**
   * Round to the thousandth place.
   * @param {number} time
   * @return {number}
   */
  var _microTime = function(time) {
    return Math.round(time * 1000) / 1000;
  };
}

module.exports = ReactDefaultPerf;

},{"./performanceNow":120,"__browserify_process":124}],49:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactErrorUtils
 * @typechecks
 */

var ReactErrorUtils = {
  /**
   * Creates a guarded version of a function. This is supposed to make debugging
   * of event handlers easier. This implementation provides only basic error
   * logging and re-throws the error.
   *
   * @param {function} func Function to be executed
   * @param {string} name The name of the guard
   * @return {function}
   */
  guard: function(func, name) {
    if ("production" !== process.env.NODE_ENV) {
      return function guarded() {
        try {
          return func.apply(this, arguments);
        } catch(ex) {
          console.error(name + ': ' + ex.message);
          throw ex;
        }
      };
    } else {
      return func;
    }
  }
};

module.exports = ReactErrorUtils;

},{"__browserify_process":124}],50:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactEventEmitter
 * @typechecks static-only
 */

"use strict";

var EventConstants = require("./EventConstants");
var EventListener = require("./EventListener");
var EventPluginHub = require("./EventPluginHub");
var ExecutionEnvironment = require("./ExecutionEnvironment");
var ReactEventEmitterMixin = require("./ReactEventEmitterMixin");
var ViewportMetrics = require("./ViewportMetrics");

var invariant = require("./invariant");
var isEventSupported = require("./isEventSupported");
var merge = require("./merge");

/**
 * Summary of `ReactEventEmitter` event handling:
 *
 *  - Top-level delegation is used to trap native browser events. We normalize
 *    and de-duplicate events to account for browser quirks.
 *
 *  - Forward these native events (with the associated top-level type used to
 *    trap it) to `EventPluginHub`, which in turn will ask plugins if they want
 *    to extract any synthetic events.
 *
 *  - The `EventPluginHub` will then process each event by annotating them with
 *    "dispatches", a sequence of listeners and IDs that care about that event.
 *
 *  - The `EventPluginHub` then dispatches the events.
 *
 * Overview of React and the event system:
 *
 *                   .
 * +------------+    .
 * |    DOM     |    .
 * +------------+    .                         +-----------+
 *       +           .               +--------+|SimpleEvent|
 *       |           .               |         |Plugin     |
 * +-----|------+    .               v         +-----------+
 * |     |      |    .    +--------------+                    +------------+
 * |     +-----------.--->|EventPluginHub|                    |    Event   |
 * |            |    .    |              |     +-----------+  | Propagators|
 * | ReactEvent |    .    |              |     |TapEvent   |  |------------|
 * |  Emitter   |    .    |              |<---+|Plugin     |  |other plugin|
 * |            |    .    |              |     +-----------+  |  utilities |
 * |     +-----------.---------+         |                    +------------+
 * |     |      |    .    +----|---------+
 * +-----|------+    .         |      ^        +-----------+
 *       |           .         |      |        |Enter/Leave|
 *       +           .         |      +-------+|Plugin     |
 * +-------------+   .         v               +-----------+
 * | application |   .    +----------+
 * |-------------|   .    | callback |
 * |             |   .    | registry |
 * |             |   .    +----------+
 * +-------------+   .
 *                   .
 *    React Core     .  General Purpose Event Plugin System
 */

/**
 * Traps top-level events by using event bubbling.
 *
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {string} handlerBaseName Event name (e.g. "click").
 * @param {DOMEventTarget} element Element on which to attach listener.
 * @internal
 */
function trapBubbledEvent(topLevelType, handlerBaseName, element) {
  EventListener.listen(
    element,
    handlerBaseName,
    ReactEventEmitter.TopLevelCallbackCreator.createTopLevelCallback(
      topLevelType
    )
  );
}

/**
 * Traps a top-level event by using event capturing.
 *
 * @param {string} topLevelType Record from `EventConstants`.
 * @param {string} handlerBaseName Event name (e.g. "click").
 * @param {DOMEventTarget} element Element on which to attach listener.
 * @internal
 */
function trapCapturedEvent(topLevelType, handlerBaseName, element) {
  EventListener.capture(
    element,
    handlerBaseName,
    ReactEventEmitter.TopLevelCallbackCreator.createTopLevelCallback(
      topLevelType
    )
  );
}

/**
 * Listens to window scroll and resize events. We cache scroll values so that
 * application code can access them without triggering reflows.
 *
 * NOTE: Scroll events do not bubble.
 *
 * @private
 * @see http://www.quirksmode.org/dom/events/scroll.html
 */
function registerScrollValueMonitoring() {
  var refresh = ViewportMetrics.refreshScrollValues;
  EventListener.listen(window, 'scroll', refresh);
  EventListener.listen(window, 'resize', refresh);
}

/**
 * `ReactEventEmitter` is used to attach top-level event listeners. For example:
 *
 *   ReactEventEmitter.putListener('myID', 'onClick', myFunction);
 *
 * This would allocate a "registration" of `('onClick', myFunction)` on 'myID'.
 *
 * @internal
 */
var ReactEventEmitter = merge(ReactEventEmitterMixin, {

  /**
   * React references `ReactEventTopLevelCallback` using this property in order
   * to allow dependency injection.
   */
  TopLevelCallbackCreator: null,

  /**
   * Ensures that top-level event delegation listeners are installed.
   *
   * There are issues with listening to both touch events and mouse events on
   * the top-level, so we make the caller choose which one to listen to. (If
   * there's a touch top-level listeners, anchors don't receive clicks for some
   * reason, and only in some cases).
   *
   * @param {boolean} touchNotMouse Listen to touch events instead of mouse.
   * @param {DOMDocument} contentDocument DOM document to listen on
   */
  ensureListening: function(touchNotMouse, contentDocument) {
    ("production" !== process.env.NODE_ENV ? invariant(
      ExecutionEnvironment.canUseDOM,
      'ensureListening(...): Cannot toggle event listening in a Worker ' +
      'thread. This is likely a bug in the framework. Please report ' +
      'immediately.'
    ) : invariant(ExecutionEnvironment.canUseDOM));
    ("production" !== process.env.NODE_ENV ? invariant(
      ReactEventEmitter.TopLevelCallbackCreator,
      'ensureListening(...): Cannot be called without a top level callback ' +
      'creator being injected.'
    ) : invariant(ReactEventEmitter.TopLevelCallbackCreator));
    // Call out to base implementation.
    ReactEventEmitterMixin.ensureListening.call(
      ReactEventEmitter,
      {
        touchNotMouse: touchNotMouse,
        contentDocument: contentDocument
      }
    );
  },

  /**
   * Sets whether or not any created callbacks should be enabled.
   *
   * @param {boolean} enabled True if callbacks should be enabled.
   */
  setEnabled: function(enabled) {
    ("production" !== process.env.NODE_ENV ? invariant(
      ExecutionEnvironment.canUseDOM,
      'setEnabled(...): Cannot toggle event listening in a Worker thread. ' +
      'This is likely a bug in the framework. Please report immediately.'
    ) : invariant(ExecutionEnvironment.canUseDOM));
    if (ReactEventEmitter.TopLevelCallbackCreator) {
      ReactEventEmitter.TopLevelCallbackCreator.setEnabled(enabled);
    }
  },

  /**
   * @return {boolean} True if callbacks are enabled.
   */
  isEnabled: function() {
    return !!(
      ReactEventEmitter.TopLevelCallbackCreator &&
      ReactEventEmitter.TopLevelCallbackCreator.isEnabled()
    );
  },

  /**
   * We listen for bubbled touch events on the document object.
   *
   * Firefox v8.01 (and possibly others) exhibited strange behavior when
   * mounting `onmousemove` events at some node that was not the document
   * element. The symptoms were that if your mouse is not moving over something
   * contained within that mount point (for example on the background) the
   * top-level listeners for `onmousemove` won't be called. However, if you
   * register the `mousemove` on the document object, then it will of course
   * catch all `mousemove`s. This along with iOS quirks, justifies restricting
   * top-level listeners to the document object only, at least for these
   * movement types of events and possibly all events.
   *
   * @see http://www.quirksmode.org/blog/archives/2010/09/click_event_del.html
   *
   * Also, `keyup`/`keypress`/`keydown` do not bubble to the window on IE, but
   * they bubble to document.
   *
   * @param {boolean} touchNotMouse Listen to touch events instead of mouse.
   * @param {DOMDocument} contentDocument Document which owns the container
   * @private
   * @see http://www.quirksmode.org/dom/events/keys.html.
   */
  listenAtTopLevel: function(touchNotMouse, contentDocument) {
    ("production" !== process.env.NODE_ENV ? invariant(
      !contentDocument._isListening,
      'listenAtTopLevel(...): Cannot setup top-level listener more than once.'
    ) : invariant(!contentDocument._isListening));
    var topLevelTypes = EventConstants.topLevelTypes;
    var mountAt = contentDocument;

    registerScrollValueMonitoring();
    trapBubbledEvent(topLevelTypes.topMouseOver, 'mouseover', mountAt);
    trapBubbledEvent(topLevelTypes.topMouseDown, 'mousedown', mountAt);
    trapBubbledEvent(topLevelTypes.topMouseUp, 'mouseup', mountAt);
    trapBubbledEvent(topLevelTypes.topMouseMove, 'mousemove', mountAt);
    trapBubbledEvent(topLevelTypes.topMouseOut, 'mouseout', mountAt);
    trapBubbledEvent(topLevelTypes.topClick, 'click', mountAt);
    trapBubbledEvent(topLevelTypes.topDoubleClick, 'dblclick', mountAt);
    trapBubbledEvent(topLevelTypes.topContextMenu, 'contextmenu', mountAt);
    if (touchNotMouse) {
      trapBubbledEvent(topLevelTypes.topTouchStart, 'touchstart', mountAt);
      trapBubbledEvent(topLevelTypes.topTouchEnd, 'touchend', mountAt);
      trapBubbledEvent(topLevelTypes.topTouchMove, 'touchmove', mountAt);
      trapBubbledEvent(topLevelTypes.topTouchCancel, 'touchcancel', mountAt);
    }
    trapBubbledEvent(topLevelTypes.topKeyUp, 'keyup', mountAt);
    trapBubbledEvent(topLevelTypes.topKeyPress, 'keypress', mountAt);
    trapBubbledEvent(topLevelTypes.topKeyDown, 'keydown', mountAt);
    trapBubbledEvent(topLevelTypes.topInput, 'input', mountAt);
    trapBubbledEvent(topLevelTypes.topChange, 'change', mountAt);
    trapBubbledEvent(
      topLevelTypes.topSelectionChange,
      'selectionchange',
      mountAt
    );

    trapBubbledEvent(
      topLevelTypes.topCompositionEnd,
      'compositionend',
      mountAt
    );
    trapBubbledEvent(
      topLevelTypes.topCompositionStart,
      'compositionstart',
      mountAt
    );
    trapBubbledEvent(
      topLevelTypes.topCompositionUpdate,
      'compositionupdate',
      mountAt
    );

    if (isEventSupported('drag')) {
      trapBubbledEvent(topLevelTypes.topDrag, 'drag', mountAt);
      trapBubbledEvent(topLevelTypes.topDragEnd, 'dragend', mountAt);
      trapBubbledEvent(topLevelTypes.topDragEnter, 'dragenter', mountAt);
      trapBubbledEvent(topLevelTypes.topDragExit, 'dragexit', mountAt);
      trapBubbledEvent(topLevelTypes.topDragLeave, 'dragleave', mountAt);
      trapBubbledEvent(topLevelTypes.topDragOver, 'dragover', mountAt);
      trapBubbledEvent(topLevelTypes.topDragStart, 'dragstart', mountAt);
      trapBubbledEvent(topLevelTypes.topDrop, 'drop', mountAt);
    }

    if (isEventSupported('wheel')) {
      trapBubbledEvent(topLevelTypes.topWheel, 'wheel', mountAt);
    } else if (isEventSupported('mousewheel')) {
      trapBubbledEvent(topLevelTypes.topWheel, 'mousewheel', mountAt);
    } else {
      // Firefox needs to capture a different mouse scroll event.
      // @see http://www.quirksmode.org/dom/events/tests/scroll.html
      trapBubbledEvent(topLevelTypes.topWheel, 'DOMMouseScroll', mountAt);
    }

    // IE<9 does not support capturing so just trap the bubbled event there.
    if (isEventSupported('scroll', true)) {
      trapCapturedEvent(topLevelTypes.topScroll, 'scroll', mountAt);
    } else {
      trapBubbledEvent(topLevelTypes.topScroll, 'scroll', window);
    }

    if (isEventSupported('focus', true)) {
      trapCapturedEvent(topLevelTypes.topFocus, 'focus', mountAt);
      trapCapturedEvent(topLevelTypes.topBlur, 'blur', mountAt);
    } else if (isEventSupported('focusin')) {
      // IE has `focusin` and `focusout` events which bubble.
      // @see
      // http://www.quirksmode.org/blog/archives/2008/04/delegating_the.html
      trapBubbledEvent(topLevelTypes.topFocus, 'focusin', mountAt);
      trapBubbledEvent(topLevelTypes.topBlur, 'focusout', mountAt);
    }

    if (isEventSupported('copy')) {
      trapBubbledEvent(topLevelTypes.topCopy, 'copy', mountAt);
      trapBubbledEvent(topLevelTypes.topCut, 'cut', mountAt);
      trapBubbledEvent(topLevelTypes.topPaste, 'paste', mountAt);
    }
  },

  registrationNames: EventPluginHub.registrationNames,

  putListener: EventPluginHub.putListener,

  getListener: EventPluginHub.getListener,

  deleteListener: EventPluginHub.deleteListener,

  deleteAllListeners: EventPluginHub.deleteAllListeners,

  trapBubbledEvent: trapBubbledEvent,

  trapCapturedEvent: trapCapturedEvent

});


module.exports = ReactEventEmitter;

},{"./EventConstants":20,"./EventListener":21,"./EventPluginHub":22,"./ExecutionEnvironment":26,"./ReactEventEmitterMixin":51,"./ViewportMetrics":80,"./invariant":104,"./isEventSupported":105,"./merge":113,"__browserify_process":124}],51:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactEventEmitterMixin
 */

"use strict";

var EventPluginHub = require("./EventPluginHub");
var ReactUpdates = require("./ReactUpdates");

function runEventQueueInBatch(events) {
  EventPluginHub.enqueueEvents(events);
  EventPluginHub.processEventQueue();
}

var ReactEventEmitterMixin = {
  /**
   * Whether or not `ensureListening` has been invoked.
   * @type {boolean}
   * @private
   */
  _isListening: false,

  /**
   * Function, must be implemented. Listens to events on the top level of the
   * application.
   *
   * @abstract
   *
   * listenAtTopLevel: null,
   */

  /**
   * Ensures that top-level event delegation listeners are installed.
   *
   * There are issues with listening to both touch events and mouse events on
   * the top-level, so we make the caller choose which one to listen to. (If
   * there's a touch top-level listeners, anchors don't receive clicks for some
   * reason, and only in some cases).
   *
   * @param {*} config Configuration passed through to `listenAtTopLevel`.
   */
  ensureListening: function(config) {
    if (!config.contentDocument._reactIsListening) {
      this.listenAtTopLevel(config.touchNotMouse, config.contentDocument);
      config.contentDocument._reactIsListening = true;
    }
  },

  /**
   * Streams a fired top-level event to `EventPluginHub` where plugins have the
   * opportunity to create `ReactEvent`s to be dispatched.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {object} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native environment event.
   */
  handleTopLevel: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    var events = EventPluginHub.extractEvents(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent
    );

    // Event queue being processed in the same cycle allows `preventDefault`.
    ReactUpdates.batchedUpdates(runEventQueueInBatch, events);
  }
};

module.exports = ReactEventEmitterMixin;

},{"./EventPluginHub":22,"./ReactUpdates":67}],52:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactEventTopLevelCallback
 * @typechecks static-only
 */

"use strict";

var ReactEventEmitter = require("./ReactEventEmitter");
var ReactMount = require("./ReactMount");

var getEventTarget = require("./getEventTarget");

/**
 * @type {boolean}
 * @private
 */
var _topLevelListenersEnabled = true;

/**
 * Top-level callback creator used to implement event handling using delegation.
 * This is used via dependency injection.
 */
var ReactEventTopLevelCallback = {

  /**
   * Sets whether or not any created callbacks should be enabled.
   *
   * @param {boolean} enabled True if callbacks should be enabled.
   */
  setEnabled: function(enabled) {
    _topLevelListenersEnabled = !!enabled;
  },

  /**
   * @return {boolean} True if callbacks are enabled.
   */
  isEnabled: function() {
    return _topLevelListenersEnabled;
  },

  /**
   * Creates a callback for the supplied `topLevelType` that could be added as
   * a listener to the document. The callback computes a `topLevelTarget` which
   * should be the root node of a mounted React component where the listener
   * is attached.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @return {function} Callback for handling top-level events.
   */
  createTopLevelCallback: function(topLevelType) {
    return function(nativeEvent) {
      if (!_topLevelListenersEnabled) {
        return;
      }
      // TODO: Remove when synthetic events are ready, this is for IE<9.
      if (nativeEvent.srcElement &&
          nativeEvent.srcElement !== nativeEvent.target) {
        nativeEvent.target = nativeEvent.srcElement;
      }
      var topLevelTarget = ReactMount.getFirstReactDOM(
        getEventTarget(nativeEvent)
      ) || window;
      var topLevelTargetID = ReactMount.getID(topLevelTarget) || '';
      ReactEventEmitter.handleTopLevel(
        topLevelType,
        topLevelTarget,
        topLevelTargetID,
        nativeEvent
      );
    };
  }

};

module.exports = ReactEventTopLevelCallback;

},{"./ReactEventEmitter":50,"./ReactMount":56,"./getEventTarget":97}],53:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactInputSelection
 */

"use strict";

var ReactDOMSelection = require("./ReactDOMSelection");

var containsNode = require("./containsNode");
var getActiveElement = require("./getActiveElement");

function isInDocument(node) {
  return containsNode(document.documentElement, node);
}

/**
 * @ReactInputSelection: React input selection module. Based on Selection.js,
 * but modified to be suitable for react and has a couple of bug fixes (doesn't
 * assume buttons have range selections allowed).
 * Input selection module for React.
 */
var ReactInputSelection = {

  hasSelectionCapabilities: function(elem) {
    return elem && (
      (elem.nodeName === 'INPUT' && elem.type === 'text') ||
      elem.nodeName === 'TEXTAREA' ||
      elem.contentEditable === 'true'
    );
  },

  getSelectionInformation: function() {
    var focusedElem = getActiveElement();
    return {
      focusedElem: focusedElem,
      selectionRange:
          ReactInputSelection.hasSelectionCapabilities(focusedElem) ?
          ReactInputSelection.getSelection(focusedElem) :
          null
    };
  },

  /**
   * @restoreSelection: If any selection information was potentially lost,
   * restore it. This is useful when performing operations that could remove dom
   * nodes and place them back in, resulting in focus being lost.
   */
  restoreSelection: function(priorSelectionInformation) {
    var curFocusedElem = getActiveElement();
    var priorFocusedElem = priorSelectionInformation.focusedElem;
    var priorSelectionRange = priorSelectionInformation.selectionRange;
    if (curFocusedElem !== priorFocusedElem &&
        isInDocument(priorFocusedElem)) {
      if (ReactInputSelection.hasSelectionCapabilities(priorFocusedElem)) {
        ReactInputSelection.setSelection(
          priorFocusedElem,
          priorSelectionRange
        );
      }
      priorFocusedElem.focus();
    }
  },

  /**
   * @getSelection: Gets the selection bounds of a focused textarea, input or
   * contentEditable node.
   * -@input: Look up selection bounds of this input
   * -@return {start: selectionStart, end: selectionEnd}
   */
  getSelection: function(input) {
    var selection;

    if ('selectionStart' in input) {
      // Modern browser with input or textarea.
      selection = {
        start: input.selectionStart,
        end: input.selectionEnd
      };
    } else if (document.selection && input.nodeName === 'INPUT') {
      // IE8 input.
      var range = document.selection.createRange();
      // There can only be one selection per document in IE, so it must
      // be in our element.
      if (range.parentElement() === input) {
        selection = {
          start: -range.moveStart('character', -input.value.length),
          end: -range.moveEnd('character', -input.value.length)
        };
      }
    } else {
      // Content editable or old IE textarea.
      selection = ReactDOMSelection.getOffsets(input);
    }

    return selection || {start: 0, end: 0};
  },

  /**
   * @setSelection: Sets the selection bounds of a textarea or input and focuses
   * the input.
   * -@input     Set selection bounds of this input or textarea
   * -@offsets   Object of same form that is returned from get*
   */
  setSelection: function(input, offsets) {
    var start = offsets.start;
    var end = offsets.end;
    if (typeof end === 'undefined') {
      end = start;
    }

    if ('selectionStart' in input) {
      input.selectionStart = start;
      input.selectionEnd = Math.min(end, input.value.length);
    } else if (document.selection && input.nodeName === 'INPUT') {
      var range = input.createTextRange();
      range.collapse(true);
      range.moveStart('character', start);
      range.moveEnd('character', end - start);
      range.select();
    } else {
      ReactDOMSelection.setOffsets(input, offsets);
    }
  }
};

module.exports = ReactInputSelection;

},{"./ReactDOMSelection":44,"./containsNode":83,"./getActiveElement":96}],54:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactInstanceHandles
 * @typechecks static-only
 */

"use strict";

var invariant = require("./invariant");

var SEPARATOR = '.';
var SEPARATOR_LENGTH = SEPARATOR.length;

/**
 * Maximum depth of traversals before we consider the possibility of a bad ID.
 */
var MAX_TREE_DEPTH = 100;

/**
 * Size of the reactRoot ID space. We generate random numbers for React root
 * IDs and if there's a collision the events and DOM update system will
 * get confused. If we assume 100 React components per page, and a user
 * loads 1 page per minute 24/7 for 50 years, with a mount point space of
 * 9,999,999 the likelihood of never having a collision is 99.997%.
 */
var GLOBAL_MOUNT_POINT_MAX = 9999999;

/**
 * Creates a DOM ID prefix to use when mounting React components.
 *
 * @param {number} index A unique integer
 * @return {string} React root ID.
 * @internal
 */
function getReactRootIDString(index) {
  return SEPARATOR + 'r[' + index.toString(36) + ']';
}

/**
 * Checks if a character in the supplied ID is a separator or the end.
 *
 * @param {string} id A React DOM ID.
 * @param {number} index Index of the character to check.
 * @return {boolean} True if the character is a separator or end of the ID.
 * @private
 */
function isBoundary(id, index) {
  return id.charAt(index) === SEPARATOR || index === id.length;
}

/**
 * Checks if the supplied string is a valid React DOM ID.
 *
 * @param {string} id A React DOM ID, maybe.
 * @return {boolean} True if the string is a valid React DOM ID.
 * @private
 */
function isValidID(id) {
  return id === '' || (
    id.charAt(0) === SEPARATOR && id.charAt(id.length - 1) !== SEPARATOR
  );
}

/**
 * Checks if the first ID is an ancestor of or equal to the second ID.
 *
 * @param {string} ancestorID
 * @param {string} descendantID
 * @return {boolean} True if `ancestorID` is an ancestor of `descendantID`.
 * @internal
 */
function isAncestorIDOf(ancestorID, descendantID) {
  return (
    descendantID.indexOf(ancestorID) === 0 &&
    isBoundary(descendantID, ancestorID.length)
  );
}

/**
 * Gets the parent ID of the supplied React DOM ID, `id`.
 *
 * @param {string} id ID of a component.
 * @return {string} ID of the parent, or an empty string.
 * @private
 */
function getParentID(id) {
  return id ? id.substr(0, id.lastIndexOf(SEPARATOR)) : '';
}

/**
 * Gets the next DOM ID on the tree path from the supplied `ancestorID` to the
 * supplied `destinationID`. If they are equal, the ID is returned.
 *
 * @param {string} ancestorID ID of an ancestor node of `destinationID`.
 * @param {string} destinationID ID of the destination node.
 * @return {string} Next ID on the path from `ancestorID` to `destinationID`.
 * @private
 */
function getNextDescendantID(ancestorID, destinationID) {
  ("production" !== process.env.NODE_ENV ? invariant(
    isValidID(ancestorID) && isValidID(destinationID),
    'getNextDescendantID(%s, %s): Received an invalid React DOM ID.',
    ancestorID,
    destinationID
  ) : invariant(isValidID(ancestorID) && isValidID(destinationID)));
  ("production" !== process.env.NODE_ENV ? invariant(
    isAncestorIDOf(ancestorID, destinationID),
    'getNextDescendantID(...): React has made an invalid assumption about ' +
    'the DOM hierarchy. Expected `%s` to be an ancestor of `%s`.',
    ancestorID,
    destinationID
  ) : invariant(isAncestorIDOf(ancestorID, destinationID)));
  if (ancestorID === destinationID) {
    return ancestorID;
  }
  // Skip over the ancestor and the immediate separator. Traverse until we hit
  // another separator or we reach the end of `destinationID`.
  var start = ancestorID.length + SEPARATOR_LENGTH;
  for (var i = start; i < destinationID.length; i++) {
    if (isBoundary(destinationID, i)) {
      break;
    }
  }
  return destinationID.substr(0, i);
}

/**
 * Gets the nearest common ancestor ID of two IDs.
 *
 * Using this ID scheme, the nearest common ancestor ID is the longest common
 * prefix of the two IDs that immediately preceded a "marker" in both strings.
 *
 * @param {string} oneID
 * @param {string} twoID
 * @return {string} Nearest common ancestor ID, or the empty string if none.
 * @private
 */
function getFirstCommonAncestorID(oneID, twoID) {
  var minLength = Math.min(oneID.length, twoID.length);
  if (minLength === 0) {
    return '';
  }
  var lastCommonMarkerIndex = 0;
  // Use `<=` to traverse until the "EOL" of the shorter string.
  for (var i = 0; i <= minLength; i++) {
    if (isBoundary(oneID, i) && isBoundary(twoID, i)) {
      lastCommonMarkerIndex = i;
    } else if (oneID.charAt(i) !== twoID.charAt(i)) {
      break;
    }
  }
  var longestCommonID = oneID.substr(0, lastCommonMarkerIndex);
  ("production" !== process.env.NODE_ENV ? invariant(
    isValidID(longestCommonID),
    'getFirstCommonAncestorID(%s, %s): Expected a valid React DOM ID: %s',
    oneID,
    twoID,
    longestCommonID
  ) : invariant(isValidID(longestCommonID)));
  return longestCommonID;
}

/**
 * Traverses the parent path between two IDs (either up or down). The IDs must
 * not be the same, and there must exist a parent path between them.
 *
 * @param {?string} start ID at which to start traversal.
 * @param {?string} stop ID at which to end traversal.
 * @param {function} cb Callback to invoke each ID with.
 * @param {?boolean} skipFirst Whether or not to skip the first node.
 * @param {?boolean} skipLast Whether or not to skip the last node.
 * @private
 */
function traverseParentPath(start, stop, cb, arg, skipFirst, skipLast) {
  start = start || '';
  stop = stop || '';
  ("production" !== process.env.NODE_ENV ? invariant(
    start !== stop,
    'traverseParentPath(...): Cannot traverse from and to the same ID, `%s`.',
    start
  ) : invariant(start !== stop));
  var traverseUp = isAncestorIDOf(stop, start);
  ("production" !== process.env.NODE_ENV ? invariant(
    traverseUp || isAncestorIDOf(start, stop),
    'traverseParentPath(%s, %s, ...): Cannot traverse from two IDs that do ' +
    'not have a parent path.',
    start,
    stop
  ) : invariant(traverseUp || isAncestorIDOf(start, stop)));
  // Traverse from `start` to `stop` one depth at a time.
  var depth = 0;
  var traverse = traverseUp ? getParentID : getNextDescendantID;
  for (var id = start; /* until break */; id = traverse(id, stop)) {
    if ((!skipFirst || id !== start) && (!skipLast || id !== stop)) {
      cb(id, traverseUp, arg);
    }
    if (id === stop) {
      // Only break //after// visiting `stop`.
      break;
    }
    ("production" !== process.env.NODE_ENV ? invariant(
      depth++ < MAX_TREE_DEPTH,
      'traverseParentPath(%s, %s, ...): Detected an infinite loop while ' +
      'traversing the React DOM ID tree. This may be due to malformed IDs: %s',
      start, stop
    ) : invariant(depth++ < MAX_TREE_DEPTH));
  }
}

/**
 * Manages the IDs assigned to DOM representations of React components. This
 * uses a specific scheme in order to traverse the DOM efficiently (e.g. in
 * order to simulate events).
 *
 * @internal
 */
var ReactInstanceHandles = {

  createReactRootID: function() {
    return getReactRootIDString(
      Math.ceil(Math.random() * GLOBAL_MOUNT_POINT_MAX)
    );
  },

  /**
   * Constructs a React ID by joining a root ID with a name.
   *
   * @param {string} rootID Root ID of a parent component.
   * @param {string} name A component's name (as flattened children).
   * @return {string} A React ID.
   * @internal
   */
  createReactID: function(rootID, name) {
    return rootID + SEPARATOR + name;
  },

  /**
   * Gets the DOM ID of the React component that is the root of the tree that
   * contains the React component with the supplied DOM ID.
   *
   * @param {string} id DOM ID of a React component.
   * @return {?string} DOM ID of the React component that is the root.
   * @internal
   */
  getReactRootIDFromNodeID: function(id) {
    var regexResult = /\.r\[[^\]]+\]/.exec(id);
    return regexResult && regexResult[0];
  },

  /**
   * Traverses the ID hierarchy and invokes the supplied `cb` on any IDs that
   * should would receive a `mouseEnter` or `mouseLeave` event.
   *
   * NOTE: Does not invoke the callback on the nearest common ancestor because
   * nothing "entered" or "left" that element.
   *
   * @param {string} leaveID ID being left.
   * @param {string} enterID ID being entered.
   * @param {function} cb Callback to invoke on each entered/left ID.
   * @param {*} upArg Argument to invoke the callback with on left IDs.
   * @param {*} downArg Argument to invoke the callback with on entered IDs.
   * @internal
   */
  traverseEnterLeave: function(leaveID, enterID, cb, upArg, downArg) {
    var ancestorID = getFirstCommonAncestorID(leaveID, enterID);
    if (ancestorID !== leaveID) {
      traverseParentPath(leaveID, ancestorID, cb, upArg, false, true);
    }
    if (ancestorID !== enterID) {
      traverseParentPath(ancestorID, enterID, cb, downArg, true, false);
    }
  },

  /**
   * Simulates the traversal of a two-phase, capture/bubble event dispatch.
   *
   * NOTE: This traversal happens on IDs without touching the DOM.
   *
   * @param {string} targetID ID of the target node.
   * @param {function} cb Callback to invoke.
   * @param {*} arg Argument to invoke the callback with.
   * @internal
   */
  traverseTwoPhase: function(targetID, cb, arg) {
    if (targetID) {
      traverseParentPath('', targetID, cb, arg, true, false);
      traverseParentPath(targetID, '', cb, arg, false, true);
    }
  },

  /**
   * Exposed for unit testing.
   * @private
   */
  _getFirstCommonAncestorID: getFirstCommonAncestorID,

  /**
   * Exposed for unit testing.
   * @private
   */
  _getNextDescendantID: getNextDescendantID,

  isAncestorIDOf: isAncestorIDOf,

  SEPARATOR: SEPARATOR

};

module.exports = ReactInstanceHandles;

},{"./invariant":104,"__browserify_process":124}],55:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactMarkupChecksum
 */

"use strict";

var adler32 = require("./adler32");

var ReactMarkupChecksum = {
  CHECKSUM_ATTR_NAME: 'data-react-checksum',

  /**
   * @param {string} markup Markup string
   * @return {string} Markup string with checksum attribute attached
   */
  addChecksumToMarkup: function(markup) {
    var checksum = adler32(markup);
    return markup.replace(
      '>',
      ' ' + ReactMarkupChecksum.CHECKSUM_ATTR_NAME + '="' + checksum + '">'
    );
  },

  /**
   * @param {string} markup to use
   * @param {DOMElement} element root React element
   * @returns {boolean} whether or not the markup is the same
   */
  canReuseMarkup: function(markup, element) {
    var existingChecksum = element.getAttribute(
      ReactMarkupChecksum.CHECKSUM_ATTR_NAME
    );
    existingChecksum = existingChecksum && parseInt(existingChecksum, 10);
    var markupChecksum = adler32(markup);
    return markupChecksum === existingChecksum;
  }
};

module.exports = ReactMarkupChecksum;

},{"./adler32":82}],56:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactMount
 */

"use strict";

var ReactEventEmitter = require("./ReactEventEmitter");
var ReactInstanceHandles = require("./ReactInstanceHandles");

var $ = require("./$");
var containsNode = require("./containsNode");
var getReactRootElementInContainer = require("./getReactRootElementInContainer");
var invariant = require("./invariant");

var SEPARATOR = ReactInstanceHandles.SEPARATOR;

var ATTR_NAME = 'data-reactid';
var nodeCache = {};

var ELEMENT_NODE_TYPE = 1;
var DOC_NODE_TYPE = 9;

/** Mapping from reactRootID to React component instance. */
var instancesByReactRootID = {};

/** Mapping from reactRootID to `container` nodes. */
var containersByReactRootID = {};

if ("production" !== process.env.NODE_ENV) {
  /** __DEV__-only mapping from reactRootID to root elements. */
  var rootElementsByReactRootID = {};
}

/**
 * @param {DOMElement} container DOM element that may contain a React component.
 * @return {?string} A "reactRoot" ID, if a React component is rendered.
 */
function getReactRootID(container) {
  var rootElement = getReactRootElementInContainer(container);
  return rootElement && ReactMount.getID(rootElement);
}

/**
 * Accessing node[ATTR_NAME] or calling getAttribute(ATTR_NAME) on a form
 * element can return its control whose name or ID equals ATTR_NAME. All
 * DOM nodes support `getAttributeNode` but this can also get called on
 * other objects so just return '' if we're given something other than a
 * DOM node (such as window).
 *
 * @param {?DOMElement|DOMWindow|DOMDocument|DOMTextNode} node DOM node.
 * @return {string} ID of the supplied `domNode`.
 */
function getID(node) {
  var id = internalGetID(node);
  if (id) {
    if (nodeCache.hasOwnProperty(id)) {
      var cached = nodeCache[id];
      if (cached !== node) {
        ("production" !== process.env.NODE_ENV ? invariant(
          !isValid(cached, id),
          'ReactMount: Two valid but unequal nodes with the same `%s`: %s',
          ATTR_NAME, id
        ) : invariant(!isValid(cached, id)));

        nodeCache[id] = node;
      }
    } else {
      nodeCache[id] = node;
    }
  }

  return id;
}

function internalGetID(node) {
  // If node is something like a window, document, or text node, none of
  // which support attributes or a .getAttribute method, gracefully return
  // the empty string, as if the attribute were missing.
  return node && node.getAttribute && node.getAttribute(ATTR_NAME) || '';
}

/**
 * Sets the React-specific ID of the given node.
 *
 * @param {DOMElement} node The DOM node whose ID will be set.
 * @param {string} id The value of the ID attribute.
 */
function setID(node, id) {
  var oldID = internalGetID(node);
  if (oldID !== id) {
    delete nodeCache[oldID];
  }
  node.setAttribute(ATTR_NAME, id);
  nodeCache[id] = node;
}

/**
 * Finds the node with the supplied React-generated DOM ID.
 *
 * @param {string} id A React-generated DOM ID.
 * @return {DOMElement} DOM node with the suppled `id`.
 * @internal
 */
function getNode(id) {
  if (!nodeCache.hasOwnProperty(id) || !isValid(nodeCache[id], id)) {
    nodeCache[id] = ReactMount.findReactNodeByID(id);
  }
  return nodeCache[id];
}

/**
 * A node is "valid" if it is contained by a currently mounted container.
 *
 * This means that the node does not have to be contained by a document in
 * order to be considered valid.
 *
 * @param {?DOMElement} node The candidate DOM node.
 * @param {string} id The expected ID of the node.
 * @return {boolean} Whether the node is contained by a mounted container.
 */
function isValid(node, id) {
  if (node) {
    ("production" !== process.env.NODE_ENV ? invariant(
      internalGetID(node) === id,
      'ReactMount: Unexpected modification of `%s`',
      ATTR_NAME
    ) : invariant(internalGetID(node) === id));

    var container = ReactMount.findReactContainerForID(id);
    if (container && containsNode(container, node)) {
      return true;
    }
  }

  return false;
}

/**
 * Causes the cache to forget about one React-specific ID.
 *
 * @param {string} id The ID to forget.
 */
function purgeID(id) {
  delete nodeCache[id];
}

/**
 * Mounting is the process of initializing a React component by creatings its
 * representative DOM elements and inserting them into a supplied `container`.
 * Any prior content inside `container` is destroyed in the process.
 *
 *   ReactMount.renderComponent(component, $('container'));
 *
 *   <div id="container">                   <-- Supplied `container`.
 *     <div data-reactid=".r[3]">           <-- Rendered reactRoot of React
 *       // ...                                 component.
 *     </div>
 *   </div>
 *
 * Inside of `container`, the first element rendered is the "reactRoot".
 */
var ReactMount = {
  /**
   * Safety guard to prevent accidentally rendering over the entire HTML tree.
   */
  allowFullPageRender: false,

  /** Time spent generating markup. */
  totalInstantiationTime: 0,

  /** Time spent inserting markup into the DOM. */
  totalInjectionTime: 0,

  /** Whether support for touch events should be initialized. */
  useTouchEvents: false,

  /** Exposed for debugging purposes **/
  _instancesByReactRootID: instancesByReactRootID,

  /**
   * This is a hook provided to support rendering React components while
   * ensuring that the apparent scroll position of its `container` does not
   * change.
   *
   * @param {DOMElement} container The `container` being rendered into.
   * @param {function} renderCallback This must be called once to do the render.
   */
  scrollMonitor: function(container, renderCallback) {
    renderCallback();
  },

  /**
   * Ensures that the top-level event delegation listener is set up. This will
   * be invoked some time before the first time any React component is rendered.
   * @param {DOMElement} container container we're rendering into
   *
   * @private
   */
  prepareEnvironmentForDOM: function(container) {
    ("production" !== process.env.NODE_ENV ? invariant(
      container && (
        container.nodeType === ELEMENT_NODE_TYPE ||
        container.nodeType === DOC_NODE_TYPE
      ),
      'prepareEnvironmentForDOM(...): Target container is not a DOM element.'
    ) : invariant(container && (
      container.nodeType === ELEMENT_NODE_TYPE ||
      container.nodeType === DOC_NODE_TYPE
    )));
    var doc = container.nodeType === ELEMENT_NODE_TYPE ?
      container.ownerDocument :
      container;
    ReactEventEmitter.ensureListening(ReactMount.useTouchEvents, doc);
  },

  /**
   * Take a component that's already mounted into the DOM and replace its props
   * @param {ReactComponent} prevComponent component instance already in the DOM
   * @param {ReactComponent} nextComponent component instance to render
   * @param {DOMElement} container container to render into
   * @param {?function} callback function triggered on completion
   */
  _updateRootComponent: function(
      prevComponent,
      nextComponent,
      container,
      callback) {
    var nextProps = nextComponent.props;
    ReactMount.scrollMonitor(container, function() {
      prevComponent.replaceProps(nextProps, callback);
    });

    if ("production" !== process.env.NODE_ENV) {
      // Record the root element in case it later gets transplanted.
      rootElementsByReactRootID[getReactRootID(container)] =
        getReactRootElementInContainer(container);
    }

    return prevComponent;
  },

  /**
   * Register a component into the instance map and start the events system.
   * @param {ReactComponent} nextComponent component instance to render
   * @param {DOMElement} container container to render into
   * @return {string} reactRoot ID prefix
   */
  _registerComponent: function(nextComponent, container) {
    ReactMount.prepareEnvironmentForDOM(container);

    var reactRootID = ReactMount.registerContainer(container);
    instancesByReactRootID[reactRootID] = nextComponent;
    return reactRootID;
  },

  /**
   * Render a new component into the DOM.
   * @param {ReactComponent} nextComponent component instance to render
   * @param {DOMElement} container container to render into
   * @param {boolean} shouldReuseMarkup if we should skip the markup insertion
   * @return {ReactComponent} nextComponent
   */
  _renderNewRootComponent: function(
      nextComponent,
      container,
      shouldReuseMarkup) {
    var reactRootID = ReactMount._registerComponent(nextComponent, container);
    nextComponent.mountComponentIntoNode(
      reactRootID,
      container,
      shouldReuseMarkup
    );

    if ("production" !== process.env.NODE_ENV) {
      // Record the root element in case it later gets transplanted.
      rootElementsByReactRootID[reactRootID] =
        getReactRootElementInContainer(container);
    }

    return nextComponent;
  },

  /**
   * Renders a React component into the DOM in the supplied `container`.
   *
   * If the React component was previously rendered into `container`, this will
   * perform an update on it and only mutate the DOM as necessary to reflect the
   * latest React component.
   *
   * @param {ReactComponent} nextComponent Component instance to render.
   * @param {DOMElement} container DOM element to render into.
   * @param {?function} callback function triggered on completion
   * @return {ReactComponent} Component instance rendered in `container`.
   */
  renderComponent: function(nextComponent, container, callback) {
    var registeredComponent = instancesByReactRootID[getReactRootID(container)];

    if (registeredComponent) {
      if (registeredComponent.constructor === nextComponent.constructor) {
        return ReactMount._updateRootComponent(
          registeredComponent,
          nextComponent,
          container,
          callback
        );
      } else {
        ReactMount.unmountComponentAtNode(container);
      }
    }

    var reactRootElement = getReactRootElementInContainer(container);
    var containerHasReactMarkup =
      reactRootElement && ReactMount.isRenderedByReact(reactRootElement);

    var shouldReuseMarkup = containerHasReactMarkup && !registeredComponent;

    var component = ReactMount._renderNewRootComponent(
      nextComponent,
      container,
      shouldReuseMarkup
    );
    callback && callback();
    return component;
  },

  /**
   * Constructs a component instance of `constructor` with `initialProps` and
   * renders it into the supplied `container`.
   *
   * @param {function} constructor React component constructor.
   * @param {?object} props Initial props of the component instance.
   * @param {DOMElement} container DOM element to render into.
   * @return {ReactComponent} Component instance rendered in `container`.
   */
  constructAndRenderComponent: function(constructor, props, container) {
    return ReactMount.renderComponent(constructor(props), container);
  },

  /**
   * Constructs a component instance of `constructor` with `initialProps` and
   * renders it into a container node identified by supplied `id`.
   *
   * @param {function} componentConstructor React component constructor
   * @param {?object} props Initial props of the component instance.
   * @param {string} id ID of the DOM element to render into.
   * @return {ReactComponent} Component instance rendered in the container node.
   */
  constructAndRenderComponentByID: function(constructor, props, id) {
    return ReactMount.constructAndRenderComponent(constructor, props, $(id));
  },

  /**
   * Registers a container node into which React components will be rendered.
   * This also creates the "reatRoot" ID that will be assigned to the element
   * rendered within.
   *
   * @param {DOMElement} container DOM element to register as a container.
   * @return {string} The "reactRoot" ID of elements rendered within.
   */
  registerContainer: function(container) {
    var reactRootID = getReactRootID(container);
    if (reactRootID) {
      // If one exists, make sure it is a valid "reactRoot" ID.
      reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(reactRootID);
    }
    if (!reactRootID) {
      // No valid "reactRoot" ID found, create one.
      reactRootID = ReactInstanceHandles.createReactRootID();
    }
    containersByReactRootID[reactRootID] = container;
    return reactRootID;
  },

  /**
   * Unmounts and destroys the React component rendered in the `container`.
   *
   * @param {DOMElement} container DOM element containing a React component.
   * @return {boolean} True if a component was found in and unmounted from
   *                   `container`
   */
  unmountComponentAtNode: function(container) {
    var reactRootID = getReactRootID(container);
    var component = instancesByReactRootID[reactRootID];
    if (!component) {
      return false;
    }
    ReactMount.unmountComponentFromNode(component, container);
    delete instancesByReactRootID[reactRootID];
    delete containersByReactRootID[reactRootID];
    if ("production" !== process.env.NODE_ENV) {
      delete rootElementsByReactRootID[reactRootID];
    }
    return true;
  },

  /**
   * @deprecated
   */
  unmountAndReleaseReactRootNode: function() {
    if ("production" !== process.env.NODE_ENV) {
      console.warn(
        'unmountAndReleaseReactRootNode() has been renamed to ' +
        'unmountComponentAtNode() and will be removed in the next ' +
        'version of React.'
      );
    }
    return ReactMount.unmountComponentAtNode.apply(this, arguments);
  },

  /**
   * Unmounts a component and removes it from the DOM.
   *
   * @param {ReactComponent} instance React component instance.
   * @param {DOMElement} container DOM element to unmount from.
   * @final
   * @internal
   * @see {ReactMount.unmountComponentAtNode}
   */
  unmountComponentFromNode: function(instance, container) {
    instance.unmountComponent();

    if (container.nodeType === DOC_NODE_TYPE) {
      container = container.documentElement;
    }

    // http://jsperf.com/emptying-a-node
    while (container.lastChild) {
      container.removeChild(container.lastChild);
    }
  },

  /**
   * Finds the container DOM element that contains React component to which the
   * supplied DOM `id` belongs.
   *
   * @param {string} id The ID of an element rendered by a React component.
   * @return {?DOMElement} DOM element that contains the `id`.
   */
  findReactContainerForID: function(id) {
    var reactRootID = ReactInstanceHandles.getReactRootIDFromNodeID(id);
    var container = containersByReactRootID[reactRootID];

    if ("production" !== process.env.NODE_ENV) {
      var rootElement = rootElementsByReactRootID[reactRootID];
      if (rootElement && rootElement.parentNode !== container) {
        ("production" !== process.env.NODE_ENV ? invariant(
          // Call internalGetID here because getID calls isValid which calls
          // findReactContainerForID (this function).
          internalGetID(rootElement) === reactRootID,
          'ReactMount: Root element ID differed from reactRootID.'
        ) : invariant(// Call internalGetID here because getID calls isValid which calls
        // findReactContainerForID (this function).
        internalGetID(rootElement) === reactRootID));

        var containerChild = container.firstChild;
        if (containerChild &&
            reactRootID === internalGetID(containerChild)) {
          // If the container has a new child with the same ID as the old
          // root element, then rootElementsByReactRootID[reactRootID] is
          // just stale and needs to be updated. The case that deserves a
          // warning is when the container is empty.
          rootElementsByReactRootID[reactRootID] = containerChild;
        } else {
          console.warn(
            'ReactMount: Root element has been removed from its original ' +
            'container. New container:', rootElement.parentNode
          );
        }
      }
    }

    return container;
  },

  /**
   * Finds an element rendered by React with the supplied ID.
   *
   * @param {string} id ID of a DOM node in the React component.
   * @return {DOMElement} Root DOM node of the React component.
   */
  findReactNodeByID: function(id) {
    var reactRoot = ReactMount.findReactContainerForID(id);
    return ReactMount.findComponentRoot(reactRoot, id);
  },

  /**
   * True if the supplied `node` is rendered by React.
   *
   * @param {*} node DOM Element to check.
   * @return {boolean} True if the DOM Element appears to be rendered by React.
   * @internal
   */
  isRenderedByReact: function(node) {
    if (node.nodeType !== 1) {
      // Not a DOMElement, therefore not a React component
      return false;
    }
    var id = ReactMount.getID(node);
    return id ? id.charAt(0) === SEPARATOR : false;
  },

  /**
   * Traverses up the ancestors of the supplied node to find a node that is a
   * DOM representation of a React component.
   *
   * @param {*} node
   * @return {?DOMEventTarget}
   * @internal
   */
  getFirstReactDOM: function(node) {
    var current = node;
    while (current && current.parentNode !== current) {
      if (ReactMount.isRenderedByReact(current)) {
        return current;
      }
      current = current.parentNode;
    }
    return null;
  },

  /**
   * Finds a node with the supplied `id` inside of the supplied `ancestorNode`.
   * Exploits the ID naming scheme to perform the search quickly.
   *
   * @param {DOMEventTarget} ancestorNode Search from this root.
   * @pararm {string} id ID of the DOM representation of the component.
   * @return {DOMEventTarget} DOM node with the supplied `id`.
   * @internal
   */
  findComponentRoot: function(ancestorNode, id) {
    var firstChildren = [ancestorNode.firstChild];
    var childIndex = 0;

    while (childIndex < firstChildren.length) {
      var child = firstChildren[childIndex++];
      while (child) {
        var childID = ReactMount.getID(child);
        if (childID) {
          if (id === childID) {
            return child;
          } else if (ReactInstanceHandles.isAncestorIDOf(childID, id)) {
            // If we find a child whose ID is an ancestor of the given ID,
            // then we can be sure that we only want to search the subtree
            // rooted at this child, so we can throw out the rest of the
            // search state.
            firstChildren.length = childIndex = 0;
            firstChildren.push(child.firstChild);
            break;
          } else {
            // TODO This should not be necessary if the ID hierarchy is
            // correct, but is occasionally necessary if the DOM has been
            // modified in unexpected ways.
            firstChildren.push(child.firstChild);
          }
        } else {
          // If this child had no ID, then there's a chance that it was
          // injected automatically by the browser, as when a `<table>`
          // element sprouts an extra `<tbody>` child as a side effect of
          // `.innerHTML` parsing. Optimistically continue down this
          // branch, but not before examining the other siblings.
          firstChildren.push(child.firstChild);
        }
        child = child.nextSibling;
      }
    }

    if ("production" !== process.env.NODE_ENV) {
      console.error(
        'Error while invoking `findComponentRoot` with the following ' +
        'ancestor node:',
        ancestorNode
      );
    }
    ("production" !== process.env.NODE_ENV ? invariant(
      false,
      'findComponentRoot(..., %s): Unable to find element. This probably ' +
      'means the DOM was unexpectedly mutated (e.g. by the browser).',
      id,
      ReactMount.getID(ancestorNode)
    ) : invariant(false));
  },


  /**
   * React ID utilities.
   */

  ATTR_NAME: ATTR_NAME,

  getReactRootID: getReactRootID,

  getID: getID,

  setID: setID,

  getNode: getNode,

  purgeID: purgeID,

  injection: {}
};

module.exports = ReactMount;

},{"./$":7,"./ReactEventEmitter":50,"./ReactInstanceHandles":54,"./containsNode":83,"./getReactRootElementInContainer":100,"./invariant":104,"__browserify_process":124}],57:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactMountReady
 */

"use strict";

var PooledClass = require("./PooledClass");

var mixInto = require("./mixInto");

/**
 * A specialized pseudo-event module to help keep track of components waiting to
 * be notified when their DOM representations are available for use.
 *
 * This implements `PooledClass`, so you should never need to instantiate this.
 * Instead, use `ReactMountReady.getPooled()`.
 *
 * @param {?array<function>} initialCollection
 * @class ReactMountReady
 * @implements PooledClass
 * @internal
 */
function ReactMountReady(initialCollection) {
  this._queue = initialCollection || null;
}

mixInto(ReactMountReady, {

  /**
   * Enqueues a callback to be invoked when `notifyAll` is invoked. This is used
   * to enqueue calls to `componentDidMount` and `componentDidUpdate`.
   *
   * @param {ReactComponent} component Component being rendered.
   * @param {function(DOMElement)} callback Invoked when `notifyAll` is invoked.
   * @internal
   */
  enqueue: function(component, callback) {
    this._queue = this._queue || [];
    this._queue.push({component: component, callback: callback});
  },

  /**
   * Invokes all enqueued callbacks and clears the queue. This is invoked after
   * the DOM representation of a component has been created or updated.
   *
   * @internal
   */
  notifyAll: function() {
    var queue = this._queue;
    if (queue) {
      this._queue = null;
      for (var i = 0, l = queue.length; i < l; i++) {
        var component = queue[i].component;
        var callback = queue[i].callback;
        callback.call(component, component.getDOMNode());
      }
      queue.length = 0;
    }
  },

  /**
   * Resets the internal queue.
   *
   * @internal
   */
  reset: function() {
    this._queue = null;
  },

  /**
   * `PooledClass` looks for this.
   */
  destructor: function() {
    this.reset();
  }

});

PooledClass.addPoolingTo(ReactMountReady);

module.exports = ReactMountReady;

},{"./PooledClass":29,"./mixInto":116}],58:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactMultiChild
 * @typechecks static-only
 */

"use strict";

var ReactComponent = require("./ReactComponent");
var ReactMultiChildUpdateTypes = require("./ReactMultiChildUpdateTypes");

var flattenChildren = require("./flattenChildren");

/**
 * Given a `curChild` and `newChild`, determines if `curChild` should be
 * updated as opposed to being destroyed or replaced.
 *
 * @param {?ReactComponent} curChild
 * @param {?ReactComponent} newChild
 * @return {boolean} True if `curChild` should be updated with `newChild`.
 * @protected
 */
function shouldUpdateChild(curChild, newChild) {
  return curChild && newChild && curChild.constructor === newChild.constructor;
}

/**
 * Updating children of a component may trigger recursive updates. The depth is
 * used to batch recursive updates to render markup more efficiently.
 *
 * @type {number}
 * @private
 */
var updateDepth = 0;

/**
 * Queue of update configuration objects.
 *
 * Each object has a `type` property that is in `ReactMultiChildUpdateTypes`.
 *
 * @type {array<object>}
 * @private
 */
var updateQueue = [];

/**
 * Queue of markup to be rendered.
 *
 * @type {array<string>}
 * @private
 */
var markupQueue = [];

/**
 * Enqueues markup to be rendered and inserted at a supplied index.
 *
 * @param {string} parentID ID of the parent component.
 * @param {string} markup Markup that renders into an element.
 * @param {number} toIndex Destination index.
 * @private
 */
function enqueueMarkup(parentID, markup, toIndex) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.INSERT_MARKUP,
    markupIndex: markupQueue.push(markup) - 1,
    textContent: null,
    fromIndex: null,
    toIndex: toIndex
  });
}

/**
 * Enqueues moving an existing element to another index.
 *
 * @param {string} parentID ID of the parent component.
 * @param {number} fromIndex Source index of the existing element.
 * @param {number} toIndex Destination index of the element.
 * @private
 */
function enqueueMove(parentID, fromIndex, toIndex) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.MOVE_EXISTING,
    markupIndex: null,
    textContent: null,
    fromIndex: fromIndex,
    toIndex: toIndex
  });
}

/**
 * Enqueues removing an element at an index.
 *
 * @param {string} parentID ID of the parent component.
 * @param {number} fromIndex Index of the element to remove.
 * @private
 */
function enqueueRemove(parentID, fromIndex) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.REMOVE_NODE,
    markupIndex: null,
    textContent: null,
    fromIndex: fromIndex,
    toIndex: null
  });
}

/**
 * Enqueues setting the text content.
 *
 * @param {string} parentID ID of the parent component.
 * @param {string} textContent Text content to set.
 * @private
 */
function enqueueTextContent(parentID, textContent) {
  // NOTE: Null values reduce hidden classes.
  updateQueue.push({
    parentID: parentID,
    parentNode: null,
    type: ReactMultiChildUpdateTypes.TEXT_CONTENT,
    markupIndex: null,
    textContent: textContent,
    fromIndex: null,
    toIndex: null
  });
}

/**
 * Processes any enqueued updates.
 *
 * @private
 */
function processQueue() {
  if (updateQueue.length) {
    ReactComponent.DOMIDOperations.dangerouslyProcessChildrenUpdates(
      updateQueue,
      markupQueue
    );
    clearQueue();
  }
}

/**
 * Clears any enqueued updates.
 *
 * @private
 */
function clearQueue() {
  updateQueue.length = 0;
  markupQueue.length = 0;
}

/**
 * ReactMultiChild are capable of reconciling multiple children.
 *
 * @class ReactMultiChild
 * @internal
 */
var ReactMultiChild = {

  /**
   * Provides common functionality for components that must reconcile multiple
   * children. This is used by `ReactDOMComponent` to mount, update, and
   * unmount child components.
   *
   * @lends {ReactMultiChild.prototype}
   */
  Mixin: {

    /**
     * Generates a "mount image" for each of the supplied children. In the case
     * of `ReactDOMComponent`, a mount image is a string of markup.
     *
     * @param {?object} nestedChildren Nested child maps.
     * @return {array} An array of mounted representations.
     * @internal
     */
    mountChildren: function(nestedChildren, transaction) {
      var children = flattenChildren(nestedChildren);
      var mountImages = [];
      var index = 0;
      this._renderedChildren = children;
      for (var name in children) {
        var child = children[name];
        if (children.hasOwnProperty(name) && child) {
          // Inlined for performance, see `ReactInstanceHandles.createReactID`.
          var rootID = this._rootNodeID + '.' + name;
          var mountImage = child.mountComponent(
            rootID,
            transaction,
            this._mountDepth + 1
          );
          child._mountImage = mountImage;
          child._mountIndex = index;
          mountImages.push(mountImage);
          index++;
        }
      }
      return mountImages;
    },

    /**
     * Replaces any rendered children with a text content string.
     *
     * @param {string} nextContent String of content.
     * @internal
     */
    updateTextContent: function(nextContent) {
      updateDepth++;
      try {
        var prevChildren = this._renderedChildren;
        // Remove any rendered children.
        for (var name in prevChildren) {
          if (prevChildren.hasOwnProperty(name) &&
              prevChildren[name]) {
            this._unmountChildByName(prevChildren[name], name);
          }
        }
        // Set new text content.
        this.setTextContent(nextContent);
      } catch (error) {
        updateDepth--;
        updateDepth || clearQueue();
        throw error;
      }
      updateDepth--;
      updateDepth || processQueue();
    },

    /**
     * Updates the rendered children with new children.
     *
     * @param {?object} nextNestedChildren Nested child maps.
     * @param {ReactReconcileTransaction} transaction
     * @internal
     */
    updateChildren: function(nextNestedChildren, transaction) {
      updateDepth++;
      try {
        this._updateChildren(nextNestedChildren, transaction);
      } catch (error) {
        updateDepth--;
        updateDepth || clearQueue();
        throw error;
      }
      updateDepth--;
      updateDepth || processQueue();
    },

    /**
     * Improve performance by isolating this hot code path from the try/catch
     * block in `updateChildren`.
     *
     * @param {?object} nextNestedChildren Nested child maps.
     * @param {ReactReconcileTransaction} transaction
     * @final
     * @protected
     */
    _updateChildren: function(nextNestedChildren, transaction) {
      var nextChildren = flattenChildren(nextNestedChildren);
      var prevChildren = this._renderedChildren;
      if (!nextChildren && !prevChildren) {
        return;
      }
      var name;
      // `nextIndex` will increment for each child in `nextChildren`, but
      // `lastIndex` will be the last index visited in `prevChildren`.
      var lastIndex = 0;
      var nextIndex = 0;
      for (name in nextChildren) {
        if (!nextChildren.hasOwnProperty(name)) {
          continue;
        }
        var prevChild = prevChildren && prevChildren[name];
        var nextChild = nextChildren[name];
        if (shouldUpdateChild(prevChild, nextChild)) {
          this.moveChild(prevChild, nextIndex, lastIndex);
          lastIndex = Math.max(prevChild._mountIndex, lastIndex);
          prevChild.receiveComponent(nextChild, transaction);
          prevChild._mountIndex = nextIndex;
        } else {
          if (prevChild) {
            // Update `lastIndex` before `_mountIndex` gets unset by unmounting.
            lastIndex = Math.max(prevChild._mountIndex, lastIndex);
            this._unmountChildByName(prevChild, name);
          }
          if (nextChild) {
            this._mountChildByNameAtIndex(
              nextChild, name, nextIndex, transaction
            );
          }
        }
        if (nextChild) {
          nextIndex++;
        }
      }
      // Remove children that are no longer present.
      for (name in prevChildren) {
        if (prevChildren.hasOwnProperty(name) &&
            prevChildren[name] &&
            !(nextChildren && nextChildren[name])) {
          this._unmountChildByName(prevChildren[name], name);
        }
      }
    },

    /**
     * Unmounts all rendered children. This should be used to clean up children
     * when this component is unmounted.
     *
     * @internal
     */
    unmountChildren: function() {
      var renderedChildren = this._renderedChildren;
      for (var name in renderedChildren) {
        var renderedChild = renderedChildren[name];
        if (renderedChild && renderedChild.unmountComponent) {
          renderedChild.unmountComponent();
        }
      }
      this._renderedChildren = null;
    },

    /**
     * Moves a child component to the supplied index.
     *
     * @param {ReactComponent} child Component to move.
     * @param {number} toIndex Destination index of the element.
     * @param {number} lastIndex Last index visited of the siblings of `child`.
     * @protected
     */
    moveChild: function(child, toIndex, lastIndex) {
      // If the index of `child` is less than `lastIndex`, then it needs to
      // be moved. Otherwise, we do not need to move it because a child will be
      // inserted or moved before `child`.
      if (child._mountIndex < lastIndex) {
        enqueueMove(this._rootNodeID, child._mountIndex, toIndex);
      }
    },

    /**
     * Creates a child component.
     *
     * @param {ReactComponent} child Component to create.
     * @protected
     */
    createChild: function(child) {
      enqueueMarkup(this._rootNodeID, child._mountImage, child._mountIndex);
    },

    /**
     * Removes a child component.
     *
     * @param {ReactComponent} child Child to remove.
     * @protected
     */
    removeChild: function(child) {
      enqueueRemove(this._rootNodeID, child._mountIndex);
    },

    /**
     * Sets this text content string.
     *
     * @param {string} textContent Text content to set.
     * @protected
     */
    setTextContent: function(textContent) {
      enqueueTextContent(this._rootNodeID, textContent);
    },

    /**
     * Mounts a child with the supplied name.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to mount.
     * @param {string} name Name of the child.
     * @param {number} index Index at which to insert the child.
     * @param {ReactReconcileTransaction} transaction
     * @private
     */
    _mountChildByNameAtIndex: function(child, name, index, transaction) {
      // Inlined for performance, see `ReactInstanceHandles.createReactID`.
      var rootID = this._rootNodeID + '.' + name;
      var mountImage = child.mountComponent(
        rootID,
        transaction,
        this._mountDepth + 1
      );
      child._mountImage = mountImage;
      child._mountIndex = index;
      this.createChild(child);
      this._renderedChildren = this._renderedChildren || {};
      this._renderedChildren[name] = child;
    },

    /**
     * Unmounts a rendered child by name.
     *
     * NOTE: This is part of `updateChildren` and is here for readability.
     *
     * @param {ReactComponent} child Component to unmount.
     * @param {string} name Name of the child in `this._renderedChildren`.
     * @private
     */
    _unmountChildByName: function(child, name) {
      if (ReactComponent.isValidComponent(child)) {
        this.removeChild(child);
        child._mountImage = null;
        child._mountIndex = null;
        child.unmountComponent();
        delete this._renderedChildren[name];
      }
    }

  }

};

module.exports = ReactMultiChild;

},{"./ReactComponent":31,"./ReactMultiChildUpdateTypes":59,"./flattenChildren":93}],59:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactMultiChildUpdateTypes
 */

var keyMirror = require("./keyMirror");

/**
 * When a component's children are updated, a series of update configuration
 * objects are created in order to batch and serialize the required changes.
 *
 * Enumerates all the possible types of update configurations.
 *
 * @internal
 */
var ReactMultiChildUpdateTypes = keyMirror({
  INSERT_MARKUP: null,
  MOVE_EXISTING: null,
  REMOVE_NODE: null,
  TEXT_CONTENT: null
});

module.exports = ReactMultiChildUpdateTypes;

},{"./keyMirror":110}],60:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactOwner
 */

"use strict";

var invariant = require("./invariant");

/**
 * ReactOwners are capable of storing references to owned components.
 *
 * All components are capable of //being// referenced by owner components, but
 * only ReactOwner components are capable of //referencing// owned components.
 * The named reference is known as a "ref".
 *
 * Refs are available when mounted and updated during reconciliation.
 *
 *   var MyComponent = React.createClass({
 *     render: function() {
 *       return (
 *         <div onClick={this.handleClick}>
 *           <CustomComponent ref="custom" />
 *         </div>
 *       );
 *     },
 *     handleClick: function() {
 *       this.refs.custom.handleClick();
 *     },
 *     componentDidMount: function() {
 *       this.refs.custom.initialize();
 *     }
 *   });
 *
 * Refs should rarely be used. When refs are used, they should only be done to
 * control data that is not handled by React's data flow.
 *
 * @class ReactOwner
 */
var ReactOwner = {

  /**
   * @param {?object} object
   * @return {boolean} True if `object` is a valid owner.
   * @final
   */
  isValidOwner: function(object) {
    return !!(
      object &&
      typeof object.attachRef === 'function' &&
      typeof object.detachRef === 'function'
    );
  },

  /**
   * Adds a component by ref to an owner component.
   *
   * @param {ReactComponent} component Component to reference.
   * @param {string} ref Name by which to refer to the component.
   * @param {ReactOwner} owner Component on which to record the ref.
   * @final
   * @internal
   */
  addComponentAsRefTo: function(component, ref, owner) {
    ("production" !== process.env.NODE_ENV ? invariant(
      ReactOwner.isValidOwner(owner),
      'addComponentAsRefTo(...): Only a ReactOwner can have refs.'
    ) : invariant(ReactOwner.isValidOwner(owner)));
    owner.attachRef(ref, component);
  },

  /**
   * Removes a component by ref from an owner component.
   *
   * @param {ReactComponent} component Component to dereference.
   * @param {string} ref Name of the ref to remove.
   * @param {ReactOwner} owner Component on which the ref is recorded.
   * @final
   * @internal
   */
  removeComponentAsRefFrom: function(component, ref, owner) {
    ("production" !== process.env.NODE_ENV ? invariant(
      ReactOwner.isValidOwner(owner),
      'removeComponentAsRefFrom(...): Only a ReactOwner can have refs.'
    ) : invariant(ReactOwner.isValidOwner(owner)));
    // Check that `component` is still the current ref because we do not want to
    // detach the ref if another component stole it.
    if (owner.refs[ref] === component) {
      owner.detachRef(ref);
    }
  },

  /**
   * A ReactComponent must mix this in to have refs.
   *
   * @lends {ReactOwner.prototype}
   */
  Mixin: {

    /**
     * Lazily allocates the refs object and stores `component` as `ref`.
     *
     * @param {string} ref Reference name.
     * @param {component} component Component to store as `ref`.
     * @final
     * @private
     */
    attachRef: function(ref, component) {
      ("production" !== process.env.NODE_ENV ? invariant(
        component.isOwnedBy(this),
        'attachRef(%s, ...): Only a component\'s owner can store a ref to it.',
        ref
      ) : invariant(component.isOwnedBy(this)));
      var refs = this.refs || (this.refs = {});
      refs[ref] = component;
    },

    /**
     * Detaches a reference name.
     *
     * @param {string} ref Name to dereference.
     * @final
     * @private
     */
    detachRef: function(ref) {
      delete this.refs[ref];
    }

  }

};

module.exports = ReactOwner;

},{"./invariant":104,"__browserify_process":124}],61:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactPerf
 * @typechecks static-only
 */

"use strict";

var ReactPerf = {
  /**
   * Boolean to enable/disable measurement. Set to false by default to prevent
   * accidental logging and perf loss.
   */
  enableMeasure: false,

  /**
   * Holds onto the measure function in use. By default, don't measure
   * anything, but we'll override this if we inject a measure function.
   */
  storedMeasure: _noMeasure,

  /**
   * Use this to wrap methods you want to measure.
   *
   * @param {string} objName
   * @param {string} fnName
   * @param {function} func
   * @return {function}
   */
  measure: function(objName, fnName, func) {
    if ("production" !== process.env.NODE_ENV) {
      var measuredFunc = null;
      return function() {
        if (ReactPerf.enableMeasure) {
          if (!measuredFunc) {
            measuredFunc = ReactPerf.storedMeasure(objName, fnName, func);
          }
          return measuredFunc.apply(this, arguments);
        }
        return func.apply(this, arguments);
      };
    }
    return func;
  },

  injection: {
    /**
     * @param {function} measure
     */
    injectMeasure: function(measure) {
      ReactPerf.storedMeasure = measure;
    }
  }
};

if ("production" !== process.env.NODE_ENV) {
  var ExecutionEnvironment = require("./ExecutionEnvironment");
  var url = (ExecutionEnvironment.canUseDOM && window.location.href) || '';
  ReactPerf.enableMeasure = ReactPerf.enableMeasure ||
    (/[?&]react_perf\b/).test(url);
}

/**
 * Simply passes through the measured function, without measuring it.
 *
 * @param {string} objName
 * @param {string} fnName
 * @param {function} func
 * @return {function}
 */
function _noMeasure(objName, fnName, func) {
  return func;
}

module.exports = ReactPerf;

},{"./ExecutionEnvironment":26,"__browserify_process":124}],62:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactPropTransferer
 */

"use strict";

var emptyFunction = require("./emptyFunction");
var invariant = require("./invariant");
var joinClasses = require("./joinClasses");
var merge = require("./merge");

/**
 * Creates a transfer strategy that will merge prop values using the supplied
 * `mergeStrategy`. If a prop was previously unset, this just sets it.
 *
 * @param {function} mergeStrategy
 * @return {function}
 */
function createTransferStrategy(mergeStrategy) {
  return function(props, key, value) {
    if (!props.hasOwnProperty(key)) {
      props[key] = value;
    } else {
      props[key] = mergeStrategy(props[key], value);
    }
  };
}

/**
 * Transfer strategies dictate how props are transferred by `transferPropsTo`.
 */
var TransferStrategies = {
  /**
   * Never transfer `children`.
   */
  children: emptyFunction,
  /**
   * Transfer the `className` prop by merging them.
   */
  className: createTransferStrategy(joinClasses),
  /**
   * Never transfer the `ref` prop.
   */
  ref: emptyFunction,
  /**
   * Transfer the `style` prop (which is an object) by merging them.
   */
  style: createTransferStrategy(merge)
};

/**
 * ReactPropTransferer are capable of transferring props to another component
 * using a `transferPropsTo` method.
 *
 * @class ReactPropTransferer
 */
var ReactPropTransferer = {

  TransferStrategies: TransferStrategies,

  /**
   * @lends {ReactPropTransferer.prototype}
   */
  Mixin: {

    /**
     * Transfer props from this component to a target component.
     *
     * Props that do not have an explicit transfer strategy will be transferred
     * only if the target component does not already have the prop set.
     *
     * This is usually used to pass down props to a returned root component.
     *
     * @param {ReactComponent} component Component receiving the properties.
     * @return {ReactComponent} The supplied `component`.
     * @final
     * @protected
     */
    transferPropsTo: function(component) {
      ("production" !== process.env.NODE_ENV ? invariant(
        component.props.__owner__ === this,
        '%s: You can\'t call transferPropsTo() on a component that you ' +
        'don\'t own, %s. This usually means you are calling ' +
        'transferPropsTo() on a component passed in as props or children.',
        this.constructor.displayName,
        component.constructor.displayName
      ) : invariant(component.props.__owner__ === this));

      var props = {};
      for (var thatKey in component.props) {
        if (component.props.hasOwnProperty(thatKey)) {
          props[thatKey] = component.props[thatKey];
        }
      }
      for (var thisKey in this.props) {
        if (!this.props.hasOwnProperty(thisKey)) {
          continue;
        }
        var transferStrategy = TransferStrategies[thisKey];
        if (transferStrategy) {
          transferStrategy(props, thisKey, this.props[thisKey]);
        } else if (!props.hasOwnProperty(thisKey)) {
          props[thisKey] = this.props[thisKey];
        }
      }
      component.props = props;
      return component;
    }

  }

};

module.exports = ReactPropTransferer;

},{"./emptyFunction":89,"./invariant":104,"./joinClasses":109,"./merge":113,"__browserify_process":124}],63:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactPropTypes
 */

"use strict";

var createObjectFrom = require("./createObjectFrom");
var invariant = require("./invariant");

/**
 * Collection of methods that allow declaration and validation of props that are
 * supplied to React components. Example usage:
 *
 *   var Props = require('ReactPropTypes');
 *   var MyArticle = React.createClass({
 *     propTypes: {
 *       // An optional string prop named "description".
 *       description: Props.string,
 *
 *       // A required enum prop named "category".
 *       category: Props.oneOf(['News','Photos']).isRequired,
 *
 *       // A prop named "dialog" that requires an instance of Dialog.
 *       dialog: Props.instanceOf(Dialog).isRequired
 *     },
 *     render: function() { ... }
 *   });
 *
 * A more formal specification of how these methods are used:
 *
 *   type := array|bool|func|object|number|string|oneOf([...])|instanceOf(...)
 *   decl := ReactPropTypes.{type}(.isRequired)?
 *
 * Each and every declaration produces a function with the same signature. This
 * allows the creation of custom validation functions. For example:
 *
 *   var Props = require('ReactPropTypes');
 *   var MyLink = React.createClass({
 *     propTypes: {
 *       // An optional string or URI prop named "href".
 *       href: function(props, propName, componentName) {
 *         var propValue = props[propName];
 *         invariant(
 *           propValue == null ||
 *           typeof propValue === 'string' ||
 *           propValue instanceof URI,
 *           'Invalid `%s` supplied to `%s`, expected string or URI.',
 *           propName,
 *           componentName
 *         );
 *       }
 *     },
 *     render: function() { ... }
 *   });
 *
 * @internal
 */
var Props = {

  array: createPrimitiveTypeChecker('array'),
  bool: createPrimitiveTypeChecker('boolean'),
  func: createPrimitiveTypeChecker('function'),
  number: createPrimitiveTypeChecker('number'),
  object: createPrimitiveTypeChecker('object'),
  string: createPrimitiveTypeChecker('string'),

  oneOf: createEnumTypeChecker,

  instanceOf: createInstanceTypeChecker

};

var ANONYMOUS = '<<anonymous>>';

function createPrimitiveTypeChecker(expectedType) {
  function validatePrimitiveType(propValue, propName, componentName) {
    var propType = typeof propValue;
    if (propType === 'object' && Array.isArray(propValue)) {
      propType = 'array';
    }
    ("production" !== process.env.NODE_ENV ? invariant(
      propType === expectedType,
      'Invalid prop `%s` of type `%s` supplied to `%s`, expected `%s`.',
      propName,
      propType,
      componentName,
      expectedType
    ) : invariant(propType === expectedType));
  }
  return createChainableTypeChecker(validatePrimitiveType);
}

function createEnumTypeChecker(expectedValues) {
  var expectedEnum = createObjectFrom(expectedValues);
  function validateEnumType(propValue, propName, componentName) {
    ("production" !== process.env.NODE_ENV ? invariant(
      expectedEnum[propValue],
      'Invalid prop `%s` supplied to `%s`, expected one of %s.',
      propName,
      componentName,
      JSON.stringify(Object.keys(expectedEnum))
    ) : invariant(expectedEnum[propValue]));
  }
  return createChainableTypeChecker(validateEnumType);
}

function createInstanceTypeChecker(expectedClass) {
  function validateInstanceType(propValue, propName, componentName) {
    ("production" !== process.env.NODE_ENV ? invariant(
      propValue instanceof expectedClass,
      'Invalid prop `%s` supplied to `%s`, expected instance of `%s`.',
      propName,
      componentName,
      expectedClass.name || ANONYMOUS
    ) : invariant(propValue instanceof expectedClass));
  }
  return createChainableTypeChecker(validateInstanceType);
}

function createChainableTypeChecker(validate) {
  function createTypeChecker(isRequired) {
    function checkType(props, propName, componentName) {
      var propValue = props[propName];
      if (propValue != null) {
        // Only validate if there is a value to check.
        validate(propValue, propName, componentName || ANONYMOUS);
      } else {
        ("production" !== process.env.NODE_ENV ? invariant(
          !isRequired,
          'Required prop `%s` was not specified in `%s`.',
          propName,
          componentName || ANONYMOUS
        ) : invariant(!isRequired));
      }
    }
    if (!isRequired) {
      checkType.isRequired = createTypeChecker(true);
    }
    return checkType;
  }
  return createTypeChecker(false);
}

module.exports = Props;

},{"./createObjectFrom":87,"./invariant":104,"__browserify_process":124}],64:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactReconcileTransaction
 * @typechecks static-only
 */

"use strict";

var ExecutionEnvironment = require("./ExecutionEnvironment");
var PooledClass = require("./PooledClass");
var ReactEventEmitter = require("./ReactEventEmitter");
var ReactInputSelection = require("./ReactInputSelection");
var ReactMountReady = require("./ReactMountReady");
var Transaction = require("./Transaction");

var mixInto = require("./mixInto");

/**
 * Ensures that, when possible, the selection range (currently selected text
 * input) is not disturbed by performing the transaction.
 */
var SELECTION_RESTORATION = {
  /**
   * @return {Selection} Selection information.
   */
  initialize: ReactInputSelection.getSelectionInformation,
  /**
   * @param {Selection} sel Selection information returned from `initialize`.
   */
  close: ReactInputSelection.restoreSelection
};

/**
 * Suppresses events (blur/focus) that could be inadvertently dispatched due to
 * high level DOM manipulations (like temporarily removing a text input from the
 * DOM).
 */
var EVENT_SUPPRESSION = {
  /**
   * @return {boolean} The enabled status of `ReactEventEmitter` before the
   * reconciliation.
   */
  initialize: function() {
    var currentlyEnabled = ReactEventEmitter.isEnabled();
    ReactEventEmitter.setEnabled(false);
    return currentlyEnabled;
  },

  /**
   * @param {boolean} previouslyEnabled Enabled status of `ReactEventEmitter`
   *   before the reconciliation occured. `close` restores the previous value.
   */
  close: function(previouslyEnabled) {
    ReactEventEmitter.setEnabled(previouslyEnabled);
  }
};

/**
 * Provides a `ReactMountReady` queue for collecting `onDOMReady` callbacks
 * during the performing of the transaction.
 */
var ON_DOM_READY_QUEUEING = {
  /**
   * Initializes the internal `onDOMReady` queue.
   */
  initialize: function() {
    this.reactMountReady.reset();
  },

  /**
   * After DOM is flushed, invoke all registered `onDOMReady` callbacks.
   */
  close: function() {
    this.reactMountReady.notifyAll();
  }
};

/**
 * Executed within the scope of the `Transaction` instance. Consider these as
 * being member methods, but with an implied ordering while being isolated from
 * each other.
 */
var TRANSACTION_WRAPPERS = [
  SELECTION_RESTORATION,
  EVENT_SUPPRESSION,
  ON_DOM_READY_QUEUEING
];

/**
 * Currently:
 * - The order that these are listed in the transaction is critical:
 * - Suppresses events.
 * - Restores selection range.
 *
 * Future:
 * - Restore document/overflow scroll positions that were unintentionally
 *   modified via DOM insertions above the top viewport boundary.
 * - Implement/integrate with customized constraint based layout system and keep
 *   track of which dimensions must be remeasured.
 *
 * @class ReactReconcileTransaction
 */
function ReactReconcileTransaction() {
  this.reinitializeTransaction();
  this.reactMountReady = ReactMountReady.getPooled(null);
}

var Mixin = {
  /**
   * @see Transaction
   * @abstract
   * @final
   * @return {array<object>} List of operation wrap proceedures.
   *   TODO: convert to array<TransactionWrapper>
   */
  getTransactionWrappers: function() {
    if (ExecutionEnvironment.canUseDOM) {
      return TRANSACTION_WRAPPERS;
    } else {
      return [];
    }
  },

  /**
   * @return {object} The queue to collect `onDOMReady` callbacks with.
   *   TODO: convert to ReactMountReady
   */
  getReactMountReady: function() {
    return this.reactMountReady;
  },

  /**
   * `PooledClass` looks for this, and will invoke this before allowing this
   * instance to be resused.
   */
  destructor: function() {
    ReactMountReady.release(this.reactMountReady);
    this.reactMountReady = null;
  }
};


mixInto(ReactReconcileTransaction, Transaction.Mixin);
mixInto(ReactReconcileTransaction, Mixin);

PooledClass.addPoolingTo(ReactReconcileTransaction);

module.exports = ReactReconcileTransaction;

},{"./ExecutionEnvironment":26,"./PooledClass":29,"./ReactEventEmitter":50,"./ReactInputSelection":53,"./ReactMountReady":57,"./Transaction":79,"./mixInto":116}],65:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @typechecks static-only
 * @providesModule ReactServerRendering
 */
"use strict";

var ReactComponent = require("./ReactComponent");
var ReactInstanceHandles = require("./ReactInstanceHandles");
var ReactMarkupChecksum = require("./ReactMarkupChecksum");
var ReactReconcileTransaction = require("./ReactReconcileTransaction");

var invariant = require("./invariant");

/**
 * @param {ReactComponent} component
 * @param {function} callback
 */
function renderComponentToString(component, callback) {
  // We use a callback API to keep the API async in case in the future we ever
  // need it, but in reality this is a synchronous operation.

  ("production" !== process.env.NODE_ENV ? invariant(
    ReactComponent.isValidComponent(component),
    'renderComponentToString(): You must pass a valid ReactComponent.'
  ) : invariant(ReactComponent.isValidComponent(component)));

  ("production" !== process.env.NODE_ENV ? invariant(
    typeof callback === 'function',
    'renderComponentToString(): You must pass a function as a callback.'
  ) : invariant(typeof callback === 'function'));

  var id = ReactInstanceHandles.createReactRootID();
  var transaction = ReactReconcileTransaction.getPooled();
  transaction.reinitializeTransaction();
  try {
    transaction.perform(function() {
      var markup = component.mountComponent(id, transaction, 0);
      markup = ReactMarkupChecksum.addChecksumToMarkup(markup);
      callback(markup);
    }, null);
  } finally {
    ReactReconcileTransaction.release(transaction);
  }
}

module.exports = {
  renderComponentToString: renderComponentToString
};

},{"./ReactComponent":31,"./ReactInstanceHandles":54,"./ReactMarkupChecksum":55,"./ReactReconcileTransaction":64,"./invariant":104,"__browserify_process":124}],66:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactTextComponent
 * @typechecks static-only
 */

"use strict";

var ReactComponent = require("./ReactComponent");
var ReactMount = require("./ReactMount");

var escapeTextForBrowser = require("./escapeTextForBrowser");
var mixInto = require("./mixInto");

/**
 * Text nodes violate a couple assumptions that React makes about components:
 *
 *  - When mounting text into the DOM, adjacent text nodes are merged.
 *  - Text nodes cannot be assigned a React root ID.
 *
 * This component is used to wrap strings in elements so that they can undergo
 * the same reconciliation that is applied to elements.
 *
 * TODO: Investigate representing React components in the DOM with text nodes.
 *
 * @class ReactTextComponent
 * @extends ReactComponent
 * @internal
 */
var ReactTextComponent = function(initialText) {
  this.construct({text: initialText});
};

mixInto(ReactTextComponent, ReactComponent.Mixin);
mixInto(ReactTextComponent, {

  /**
   * Creates the markup for this text node. This node is not intended to have
   * any features besides containing text content.
   *
   * @param {string} rootID DOM ID of the root node.
   * @param {ReactReconcileTransaction} transaction
   * @param {number} mountDepth number of components in the owner hierarchy
   * @return {string} Markup for this text node.
   * @internal
   */
  mountComponent: function(rootID, transaction, mountDepth) {
    ReactComponent.Mixin.mountComponent.call(
      this,
      rootID,
      transaction,
      mountDepth
    );
    return (
      '<span ' + ReactMount.ATTR_NAME + '="' + escapeTextForBrowser(rootID) + '">' +
        escapeTextForBrowser(this.props.text) +
      '</span>'
    );
  },

  /**
   * Updates this component by updating the text content.
   *
   * @param {object} nextComponent Contains the next text content.
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  receiveComponent: function(nextComponent, transaction) {
    var nextProps = nextComponent.props;
    if (nextProps.text !== this.props.text) {
      this.props.text = nextProps.text;
      ReactComponent.DOMIDOperations.updateTextContentByID(
        this._rootNodeID,
        nextProps.text
      );
    }
  }

});

module.exports = ReactTextComponent;

},{"./ReactComponent":31,"./ReactMount":56,"./escapeTextForBrowser":90,"./mixInto":116}],67:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ReactUpdates
 */

"use strict";

var invariant = require("./invariant");

var dirtyComponents = [];

var batchingStrategy = null;

function ensureBatchingStrategy() {
  ("production" !== process.env.NODE_ENV ? invariant(batchingStrategy, 'ReactUpdates: must inject a batching strategy') : invariant(batchingStrategy));
}

function batchedUpdates(callback, param) {
  ensureBatchingStrategy();
  batchingStrategy.batchedUpdates(callback, param);
}

/**
 * Array comparator for ReactComponents by owner depth
 *
 * @param {ReactComponent} c1 first component you're comparing
 * @param {ReactComponent} c2 second component you're comparing
 * @return {number} Return value usable by Array.prototype.sort().
 */
function mountDepthComparator(c1, c2) {
  return c1._mountDepth - c2._mountDepth;
}

function runBatchedUpdates() {
  // Since reconciling a component higher in the owner hierarchy usually (not
  // always -- see shouldComponentUpdate()) will reconcile children, reconcile
  // them before their children by sorting the array.

  dirtyComponents.sort(mountDepthComparator);

  for (var i = 0; i < dirtyComponents.length; i++) {
    // If a component is unmounted before pending changes apply, ignore them
    // TODO: Queue unmounts in the same list to avoid this happening at all
    var component = dirtyComponents[i];
    if (component.isMounted()) {
      // If performUpdateIfNecessary happens to enqueue any new updates, we
      // shouldn't execute the callbacks until the next render happens, so
      // stash the callbacks first
      var callbacks = component._pendingCallbacks;
      component._pendingCallbacks = null;
      component.performUpdateIfNecessary();
      if (callbacks) {
        for (var j = 0; j < callbacks.length; j++) {
          callbacks[j].call(component);
        }
      }
    }
  }
}

function clearDirtyComponents() {
  dirtyComponents.length = 0;
}

function flushBatchedUpdates() {
  // Run these in separate functions so the JIT can optimize
  try {
    runBatchedUpdates();
  } catch (e) {
    // IE 8 requires catch to use finally.
    throw e;
  } finally {
    clearDirtyComponents();
  }
}

/**
 * Mark a component as needing a rerender, adding an optional callback to a
 * list of functions which will be executed once the rerender occurs.
 */
function enqueueUpdate(component, callback) {
  ("production" !== process.env.NODE_ENV ? invariant(
    !callback || typeof callback === "function",
    'enqueueUpdate(...): You called `setProps`, `replaceProps`, ' +
    '`setState`, `replaceState`, or `forceUpdate` with a callback that ' +
    'isn\'t callable.'
  ) : invariant(!callback || typeof callback === "function"));
  ensureBatchingStrategy();

  if (!batchingStrategy.isBatchingUpdates) {
    component.performUpdateIfNecessary();
    callback && callback();
    return;
  }

  dirtyComponents.push(component);

  if (callback) {
    if (component._pendingCallbacks) {
      component._pendingCallbacks.push(callback);
    } else {
      component._pendingCallbacks = [callback];
    }
  }
}

var ReactUpdatesInjection = {
  injectBatchingStrategy: function(_batchingStrategy) {
    ("production" !== process.env.NODE_ENV ? invariant(
      _batchingStrategy,
      'ReactUpdates: must provide a batching strategy'
    ) : invariant(_batchingStrategy));
    ("production" !== process.env.NODE_ENV ? invariant(
      typeof _batchingStrategy.batchedUpdates === 'function',
      'ReactUpdates: must provide a batchedUpdates() function'
    ) : invariant(typeof _batchingStrategy.batchedUpdates === 'function'));
    ("production" !== process.env.NODE_ENV ? invariant(
      typeof _batchingStrategy.isBatchingUpdates === 'boolean',
      'ReactUpdates: must provide an isBatchingUpdates boolean attribute'
    ) : invariant(typeof _batchingStrategy.isBatchingUpdates === 'boolean'));
    batchingStrategy = _batchingStrategy;
  }
};

var ReactUpdates = {
  batchedUpdates: batchedUpdates,
  enqueueUpdate: enqueueUpdate,
  flushBatchedUpdates: flushBatchedUpdates,
  injection: ReactUpdatesInjection
};

module.exports = ReactUpdates;

},{"./invariant":104,"__browserify_process":124}],68:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SelectEventPlugin
 */

"use strict";

var EventConstants = require("./EventConstants");
var EventPluginHub = require("./EventPluginHub");
var EventPropagators = require("./EventPropagators");
var ExecutionEnvironment = require("./ExecutionEnvironment");
var ReactInputSelection = require("./ReactInputSelection");
var SyntheticEvent = require("./SyntheticEvent");

var getActiveElement = require("./getActiveElement");
var isTextInputElement = require("./isTextInputElement");
var keyOf = require("./keyOf");
var shallowEqual = require("./shallowEqual");

var topLevelTypes = EventConstants.topLevelTypes;

var eventTypes = {
  select: {
    phasedRegistrationNames: {
      bubbled: keyOf({onSelect: null}),
      captured: keyOf({onSelectCapture: null})
    }
  }
};

var useSelectionChange = false;

if (ExecutionEnvironment.canUseDOM) {
  useSelectionChange = 'onselectionchange' in document;
}

var activeElement = null;
var activeElementID = null;
var activeNativeEvent = null;
var lastSelection = null;
var mouseDown = false;

/**
 * Get an object which is a unique representation of the current selection.
 *
 * The return value will not be consistent across nodes or browsers, but
 * two identical selections on the same node will return identical objects.
 *
 * @param {DOMElement} node
 * @param {object}
 */
function getSelection(node) {
  if ('selectionStart' in node &&
      ReactInputSelection.hasSelectionCapabilities(node)) {
    return {
      start: node.selectionStart,
      end: node.selectionEnd
    };
  } else if (document.selection) {
    var range = document.selection.createRange();
    return {
      parentElement: range.parentElement(),
      text: range.text,
      top: range.boundingTop,
      left: range.boundingLeft
    };
  } else {
    var selection = window.getSelection();
    return {
      anchorNode: selection.anchorNode,
      anchorOffset: selection.anchorOffset,
      focusNode: selection.focusNode,
      focusOffset: selection.focusOffset
    };
  }
}

/**
 * Poll selection to see whether it's changed.
 *
 * @param {object} nativeEvent
 * @return {?SyntheticEvent}
 */
function constructSelectEvent(nativeEvent) {
  // Ensure we have the right element, and that the user is not dragging a
  // selection (this matches native `select` event behavior).
  if (mouseDown || activeElement != getActiveElement()) {
    return;
  }

  // Only fire when selection has actually changed.
  var currentSelection = getSelection(activeElement);
  if (!lastSelection || !shallowEqual(lastSelection, currentSelection)) {
    lastSelection = currentSelection;

    var syntheticEvent = SyntheticEvent.getPooled(
      eventTypes.select,
      activeElementID,
      nativeEvent
    );

    syntheticEvent.type = 'select';
    syntheticEvent.target = activeElement;

    EventPropagators.accumulateTwoPhaseDispatches(syntheticEvent);

    return syntheticEvent;
  }
}

/**
 * Handle deferred event. And manually dispatch synthetic events.
 */
function dispatchDeferredSelectEvent() {
  if (!activeNativeEvent) {
    return;
  }

  var syntheticEvent = constructSelectEvent(activeNativeEvent);
  activeNativeEvent = null;

  // Enqueue and process the abstract event manually.
  if (syntheticEvent) {
    EventPluginHub.enqueueEvents(syntheticEvent);
    EventPluginHub.processEventQueue();
  }
}

/**
 * This plugin creates an `onSelect` event that normalizes select events
 * across form elements.
 *
 * Supported elements are:
 * - input (see `isTextInputElement`)
 * - textarea
 * - contentEditable
 *
 * This differs from native browser implementations in the following ways:
 * - Fires on contentEditable fields as well as inputs.
 * - Fires for collapsed selection.
 * - Fires after user input.
 */
var SelectEventPlugin = {

  eventTypes: eventTypes,

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {

    switch (topLevelType) {
      // Track the input node that has focus.
      case topLevelTypes.topFocus:
        if (isTextInputElement(topLevelTarget) ||
            topLevelTarget.contentEditable === 'true') {
          activeElement = topLevelTarget;
          activeElementID = topLevelTargetID;
          lastSelection = null;
        }
        break;
      case topLevelTypes.topBlur:
        activeElement = null;
        activeElementID = null;
        lastSelection = null;
        break;

      // Don't fire the event while the user is dragging. This matches the
      // semantics of the native select event.
      case topLevelTypes.topMouseDown:
        mouseDown = true;
        break;
      case topLevelTypes.topContextMenu:
      case topLevelTypes.topMouseUp:
        mouseDown = false;
        return constructSelectEvent(nativeEvent);

      // Chrome and IE fire non-standard event when selection is changed (and
      // sometimes when it hasn't).
      case topLevelTypes.topSelectionChange:
        return constructSelectEvent(nativeEvent);

      // Firefox doesn't support selectionchange, so check selection status
      // after each key entry.
      case topLevelTypes.topKeyDown:
        if (!useSelectionChange) {
          activeNativeEvent = nativeEvent;
          setTimeout(dispatchDeferredSelectEvent, 0);
        }
        break;
    }
  }
};

module.exports = SelectEventPlugin;

},{"./EventConstants":20,"./EventPluginHub":22,"./EventPropagators":25,"./ExecutionEnvironment":26,"./ReactInputSelection":53,"./SyntheticEvent":72,"./getActiveElement":96,"./isTextInputElement":107,"./keyOf":111,"./shallowEqual":121}],69:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SimpleEventPlugin
 */

"use strict";

var EventConstants = require("./EventConstants");
var EventPropagators = require("./EventPropagators");
var SyntheticClipboardEvent = require("./SyntheticClipboardEvent");
var SyntheticEvent = require("./SyntheticEvent");
var SyntheticFocusEvent = require("./SyntheticFocusEvent");
var SyntheticKeyboardEvent = require("./SyntheticKeyboardEvent");
var SyntheticMouseEvent = require("./SyntheticMouseEvent");
var SyntheticTouchEvent = require("./SyntheticTouchEvent");
var SyntheticUIEvent = require("./SyntheticUIEvent");
var SyntheticWheelEvent = require("./SyntheticWheelEvent");

var invariant = require("./invariant");
var keyOf = require("./keyOf");

var topLevelTypes = EventConstants.topLevelTypes;

var eventTypes = {
  blur: {
    phasedRegistrationNames: {
      bubbled: keyOf({onBlur: true}),
      captured: keyOf({onBlurCapture: true})
    }
  },
  click: {
    phasedRegistrationNames: {
      bubbled: keyOf({onClick: true}),
      captured: keyOf({onClickCapture: true})
    }
  },
  contextMenu: {
    phasedRegistrationNames: {
      bubbled: keyOf({onContextMenu: true}),
      captured: keyOf({onContextMenuCapture: true})
    }
  },
  copy: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCopy: true}),
      captured: keyOf({onCopyCapture: true})
    }
  },
  cut: {
    phasedRegistrationNames: {
      bubbled: keyOf({onCut: true}),
      captured: keyOf({onCutCapture: true})
    }
  },
  doubleClick: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDoubleClick: true}),
      captured: keyOf({onDoubleClickCapture: true})
    }
  },
  drag: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDrag: true}),
      captured: keyOf({onDragCapture: true})
    }
  },
  dragEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragEnd: true}),
      captured: keyOf({onDragEndCapture: true})
    }
  },
  dragEnter: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragEnter: true}),
      captured: keyOf({onDragEnterCapture: true})
    }
  },
  dragExit: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragExit: true}),
      captured: keyOf({onDragExitCapture: true})
    }
  },
  dragLeave: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragLeave: true}),
      captured: keyOf({onDragLeaveCapture: true})
    }
  },
  dragOver: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragOver: true}),
      captured: keyOf({onDragOverCapture: true})
    }
  },
  dragStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDragStart: true}),
      captured: keyOf({onDragStartCapture: true})
    }
  },
  drop: {
    phasedRegistrationNames: {
      bubbled: keyOf({onDrop: true}),
      captured: keyOf({onDropCapture: true})
    }
  },
  focus: {
    phasedRegistrationNames: {
      bubbled: keyOf({onFocus: true}),
      captured: keyOf({onFocusCapture: true})
    }
  },
  input: {
    phasedRegistrationNames: {
      bubbled: keyOf({onInput: true}),
      captured: keyOf({onInputCapture: true})
    }
  },
  keyDown: {
    phasedRegistrationNames: {
      bubbled: keyOf({onKeyDown: true}),
      captured: keyOf({onKeyDownCapture: true})
    }
  },
  keyPress: {
    phasedRegistrationNames: {
      bubbled: keyOf({onKeyPress: true}),
      captured: keyOf({onKeyPressCapture: true})
    }
  },
  keyUp: {
    phasedRegistrationNames: {
      bubbled: keyOf({onKeyUp: true}),
      captured: keyOf({onKeyUpCapture: true})
    }
  },
  // Note: We do not allow listening to mouseOver events. Instead, use the
  // onMouseEnter/onMouseLeave created by `EnterLeaveEventPlugin`.
  mouseDown: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseDown: true}),
      captured: keyOf({onMouseDownCapture: true})
    }
  },
  mouseMove: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseMove: true}),
      captured: keyOf({onMouseMoveCapture: true})
    }
  },
  mouseUp: {
    phasedRegistrationNames: {
      bubbled: keyOf({onMouseUp: true}),
      captured: keyOf({onMouseUpCapture: true})
    }
  },
  paste: {
    phasedRegistrationNames: {
      bubbled: keyOf({onPaste: true}),
      captured: keyOf({onPasteCapture: true})
    }
  },
  scroll: {
    phasedRegistrationNames: {
      bubbled: keyOf({onScroll: true}),
      captured: keyOf({onScrollCapture: true})
    }
  },
  submit: {
    phasedRegistrationNames: {
      bubbled: keyOf({onSubmit: true}),
      captured: keyOf({onSubmitCapture: true})
    }
  },
  touchCancel: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchCancel: true}),
      captured: keyOf({onTouchCancelCapture: true})
    }
  },
  touchEnd: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchEnd: true}),
      captured: keyOf({onTouchEndCapture: true})
    }
  },
  touchMove: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchMove: true}),
      captured: keyOf({onTouchMoveCapture: true})
    }
  },
  touchStart: {
    phasedRegistrationNames: {
      bubbled: keyOf({onTouchStart: true}),
      captured: keyOf({onTouchStartCapture: true})
    }
  },
  wheel: {
    phasedRegistrationNames: {
      bubbled: keyOf({onWheel: true}),
      captured: keyOf({onWheelCapture: true})
    }
  }
};

var topLevelEventsToDispatchConfig = {
  topBlur:        eventTypes.blur,
  topClick:       eventTypes.click,
  topContextMenu: eventTypes.contextMenu,
  topCopy:        eventTypes.copy,
  topCut:         eventTypes.cut,
  topDoubleClick: eventTypes.doubleClick,
  topDrag:        eventTypes.drag,
  topDragEnd:     eventTypes.dragEnd,
  topDragEnter:   eventTypes.dragEnter,
  topDragExit:    eventTypes.dragExit,
  topDragLeave:   eventTypes.dragLeave,
  topDragOver:    eventTypes.dragOver,
  topDragStart:   eventTypes.dragStart,
  topDrop:        eventTypes.drop,
  topFocus:       eventTypes.focus,
  topInput:       eventTypes.input,
  topKeyDown:     eventTypes.keyDown,
  topKeyPress:    eventTypes.keyPress,
  topKeyUp:       eventTypes.keyUp,
  topMouseDown:   eventTypes.mouseDown,
  topMouseMove:   eventTypes.mouseMove,
  topMouseUp:     eventTypes.mouseUp,
  topPaste:       eventTypes.paste,
  topScroll:      eventTypes.scroll,
  topSubmit:      eventTypes.submit,
  topTouchCancel: eventTypes.touchCancel,
  topTouchEnd:    eventTypes.touchEnd,
  topTouchMove:   eventTypes.touchMove,
  topTouchStart:  eventTypes.touchStart,
  topWheel:       eventTypes.wheel
};

var SimpleEventPlugin = {

  eventTypes: eventTypes,

  /**
   * Same as the default implementation, except cancels the event when return
   * value is false.
   *
   * @param {object} Event to be dispatched.
   * @param {function} Application-level callback.
   * @param {string} domID DOM ID to pass to the callback.
   */
  executeDispatch: function(event, listener, domID) {
    var returnValue = listener(event, domID);
    if (returnValue === false) {
      event.stopPropagation();
      event.preventDefault();
    }
  },

  /**
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {DOMEventTarget} topLevelTarget The listening component root node.
   * @param {string} topLevelTargetID ID of `topLevelTarget`.
   * @param {object} nativeEvent Native browser event.
   * @return {*} An accumulation of synthetic events.
   * @see {EventPluginHub.extractEvents}
   */
  extractEvents: function(
      topLevelType,
      topLevelTarget,
      topLevelTargetID,
      nativeEvent) {
    var dispatchConfig = topLevelEventsToDispatchConfig[topLevelType];
    if (!dispatchConfig) {
      return null;
    }
    var EventConstructor;
    switch(topLevelType) {
      case topLevelTypes.topInput:
      case topLevelTypes.topSubmit:
        // HTML Events
        // @see http://www.w3.org/TR/html5/index.html#events-0
        EventConstructor = SyntheticEvent;
        break;
      case topLevelTypes.topKeyDown:
      case topLevelTypes.topKeyPress:
      case topLevelTypes.topKeyUp:
        EventConstructor = SyntheticKeyboardEvent;
        break;
      case topLevelTypes.topBlur:
      case topLevelTypes.topFocus:
        EventConstructor = SyntheticFocusEvent;
        break;
      case topLevelTypes.topClick:
        // Firefox creates a click event on right mouse clicks. This removes the
        // unwanted click events.
        if (nativeEvent.button === 2) {
          return null;
        }
        /* falls through */
      case topLevelTypes.topContextMenu:
      case topLevelTypes.topDoubleClick:
      case topLevelTypes.topDrag:
      case topLevelTypes.topDragEnd:
      case topLevelTypes.topDragEnter:
      case topLevelTypes.topDragExit:
      case topLevelTypes.topDragLeave:
      case topLevelTypes.topDragOver:
      case topLevelTypes.topDragStart:
      case topLevelTypes.topDrop:
      case topLevelTypes.topMouseDown:
      case topLevelTypes.topMouseMove:
      case topLevelTypes.topMouseUp:
        EventConstructor = SyntheticMouseEvent;
        break;
      case topLevelTypes.topTouchCancel:
      case topLevelTypes.topTouchEnd:
      case topLevelTypes.topTouchMove:
      case topLevelTypes.topTouchStart:
        EventConstructor = SyntheticTouchEvent;
        break;
      case topLevelTypes.topScroll:
        EventConstructor = SyntheticUIEvent;
        break;
      case topLevelTypes.topWheel:
        EventConstructor = SyntheticWheelEvent;
        break;
      case topLevelTypes.topCopy:
      case topLevelTypes.topCut:
      case topLevelTypes.topPaste:
        EventConstructor = SyntheticClipboardEvent;
        break;
    }
    ("production" !== process.env.NODE_ENV ? invariant(
      EventConstructor,
      'SimpleEventPlugin: Unhandled event type, `%s`.',
      topLevelType
    ) : invariant(EventConstructor));
    var event = EventConstructor.getPooled(
      dispatchConfig,
      topLevelTargetID,
      nativeEvent
    );
    EventPropagators.accumulateTwoPhaseDispatches(event);
    return event;
  }

};

module.exports = SimpleEventPlugin;

},{"./EventConstants":20,"./EventPropagators":25,"./SyntheticClipboardEvent":70,"./SyntheticEvent":72,"./SyntheticFocusEvent":73,"./SyntheticKeyboardEvent":74,"./SyntheticMouseEvent":75,"./SyntheticTouchEvent":76,"./SyntheticUIEvent":77,"./SyntheticWheelEvent":78,"./invariant":104,"./keyOf":111,"__browserify_process":124}],70:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SyntheticClipboardEvent
 * @typechecks static-only
 */

"use strict";

var SyntheticEvent = require("./SyntheticEvent");

/**
 * @interface Event
 * @see http://www.w3.org/TR/clipboard-apis/
 */
var ClipboardEventInterface = {
  clipboardData: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticClipboardEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticEvent.augmentClass(SyntheticClipboardEvent, ClipboardEventInterface);

module.exports = SyntheticClipboardEvent;


},{"./SyntheticEvent":72}],71:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SyntheticCompositionEvent
 * @typechecks static-only
 */

"use strict";

var SyntheticEvent = require("./SyntheticEvent");

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/#events-compositionevents
 */
var CompositionEventInterface = {
  data: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticCompositionEvent(
  dispatchConfig,
  dispatchMarker,
  nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticEvent.augmentClass(
  SyntheticCompositionEvent,
  CompositionEventInterface
);

module.exports = SyntheticCompositionEvent;


},{"./SyntheticEvent":72}],72:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SyntheticEvent
 * @typechecks static-only
 */

"use strict";

var PooledClass = require("./PooledClass");

var emptyFunction = require("./emptyFunction");
var getEventTarget = require("./getEventTarget");
var merge = require("./merge");
var mergeInto = require("./mergeInto");

/**
 * @interface Event
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var EventInterface = {
  type: null,
  target: getEventTarget,
  currentTarget: null,
  eventPhase: null,
  bubbles: null,
  cancelable: null,
  timeStamp: function(event) {
    return event.timeStamp || Date.now();
  },
  defaultPrevented: null,
  isTrusted: null
};

/**
 * Synthetic events are dispatched by event plugins, typically in response to a
 * top-level event delegation handler.
 *
 * These systems should generally use pooling to reduce the frequency of garbage
 * collection. The system should check `isPersistent` to determine whether the
 * event should be released into the pool after being dispatched. Users that
 * need a persisted event should invoke `persist`.
 *
 * Synthetic events (and subclasses) implement the DOM Level 3 Events API by
 * normalizing browser quirks. Subclasses do not necessarily have to implement a
 * DOM interface; custom application-specific events can also subclass this.
 *
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 */
function SyntheticEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  this.dispatchConfig = dispatchConfig;
  this.dispatchMarker = dispatchMarker;
  this.nativeEvent = nativeEvent;

  var Interface = this.constructor.Interface;
  for (var propName in Interface) {
    if (!Interface.hasOwnProperty(propName)) {
      continue;
    }
    var normalize = Interface[propName];
    if (normalize) {
      this[propName] = normalize(nativeEvent);
    } else {
      this[propName] = nativeEvent[propName];
    }
  }

  var defaultPrevented = nativeEvent.defaultPrevented != null ?
    nativeEvent.defaultPrevented :
    nativeEvent.returnValue === false;
  if (defaultPrevented) {
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  } else {
    this.isDefaultPrevented = emptyFunction.thatReturnsFalse;
  }
  this.isPropagationStopped = emptyFunction.thatReturnsFalse;
}

mergeInto(SyntheticEvent.prototype, {

  preventDefault: function() {
    this.defaultPrevented = true;
    var event = this.nativeEvent;
    event.preventDefault ? event.preventDefault() : event.returnValue = false;
    this.isDefaultPrevented = emptyFunction.thatReturnsTrue;
  },

  stopPropagation: function() {
    var event = this.nativeEvent;
    event.stopPropagation ? event.stopPropagation() : event.cancelBubble = true;
    this.isPropagationStopped = emptyFunction.thatReturnsTrue;
  },

  /**
   * We release all dispatched `SyntheticEvent`s after each event loop, adding
   * them back into the pool. This allows a way to hold onto a reference that
   * won't be added back into the pool.
   */
  persist: function() {
    this.isPersistent = emptyFunction.thatReturnsTrue;
  },

  /**
   * Checks if this event should be released back into the pool.
   *
   * @return {boolean} True if this should not be released, false otherwise.
   */
  isPersistent: emptyFunction.thatReturnsFalse,

  /**
   * `PooledClass` looks for `destructor` on each instance it releases.
   */
  destructor: function() {
    var Interface = this.constructor.Interface;
    for (var propName in Interface) {
      this[propName] = null;
    }
    this.dispatchConfig = null;
    this.dispatchMarker = null;
    this.nativeEvent = null;
  }

});

SyntheticEvent.Interface = EventInterface;

/**
 * Helper to reduce boilerplate when creating subclasses.
 *
 * @param {function} Class
 * @param {?object} Interface
 */
SyntheticEvent.augmentClass = function(Class, Interface) {
  var Super = this;

  var prototype = Object.create(Super.prototype);
  mergeInto(prototype, Class.prototype);
  Class.prototype = prototype;
  Class.prototype.constructor = Class;

  Class.Interface = merge(Super.Interface, Interface);
  Class.augmentClass = Super.augmentClass;

  PooledClass.addPoolingTo(Class, PooledClass.threeArgumentPooler);
};

PooledClass.addPoolingTo(SyntheticEvent, PooledClass.threeArgumentPooler);

module.exports = SyntheticEvent;

},{"./PooledClass":29,"./emptyFunction":89,"./getEventTarget":97,"./merge":113,"./mergeInto":115}],73:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SyntheticFocusEvent
 * @typechecks static-only
 */

"use strict";

var SyntheticUIEvent = require("./SyntheticUIEvent");

/**
 * @interface FocusEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var FocusEventInterface = {
  relatedTarget: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticFocusEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticUIEvent.augmentClass(SyntheticFocusEvent, FocusEventInterface);

module.exports = SyntheticFocusEvent;

},{"./SyntheticUIEvent":77}],74:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SyntheticKeyboardEvent
 * @typechecks static-only
 */

"use strict";

var SyntheticUIEvent = require("./SyntheticUIEvent");

/**
 * @interface KeyboardEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var KeyboardEventInterface = {
  'char': null,
  key: null,
  location: null,
  ctrlKey: null,
  shiftKey: null,
  altKey: null,
  metaKey: null,
  repeat: null,
  locale: null,
  // Legacy Interface
  charCode: null,
  keyCode: null,
  which: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticKeyboardEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticUIEvent.augmentClass(SyntheticKeyboardEvent, KeyboardEventInterface);

module.exports = SyntheticKeyboardEvent;

},{"./SyntheticUIEvent":77}],75:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SyntheticMouseEvent
 * @typechecks static-only
 */

"use strict";

var SyntheticUIEvent = require("./SyntheticUIEvent");
var ViewportMetrics = require("./ViewportMetrics");

/**
 * @interface MouseEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var MouseEventInterface = {
  screenX: null,
  screenY: null,
  clientX: null,
  clientY: null,
  ctrlKey: null,
  shiftKey: null,
  altKey: null,
  metaKey: null,
  button: function(event) {
    // Webkit, Firefox, IE9+
    // which:  1 2 3
    // button: 0 1 2 (standard)
    var button = event.button;
    if ('which' in event) {
      return button;
    }
    // IE<9
    // which:  undefined
    // button: 0 0 0
    // button: 1 4 2 (onmouseup)
    return button === 2 ? 2 : button === 4 ? 1 : 0;
  },
  buttons: null,
  relatedTarget: function(event) {
    return event.relatedTarget || (
      event.fromElement === event.srcElement ?
        event.toElement :
        event.fromElement
    );
  },
  // "Proprietary" Interface.
  pageX: function(event) {
    return 'pageX' in event ?
      event.pageX :
      event.clientX + ViewportMetrics.currentScrollLeft;
  },
  pageY: function(event) {
    return 'pageY' in event ?
      event.pageY :
      event.clientY + ViewportMetrics.currentScrollTop;
  }
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticMouseEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticUIEvent.augmentClass(SyntheticMouseEvent, MouseEventInterface);

module.exports = SyntheticMouseEvent;

},{"./SyntheticUIEvent":77,"./ViewportMetrics":80}],76:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SyntheticTouchEvent
 * @typechecks static-only
 */

"use strict";

var SyntheticUIEvent = require("./SyntheticUIEvent");

/**
 * @interface TouchEvent
 * @see http://www.w3.org/TR/touch-events/
 */
var TouchEventInterface = {
  touches: null,
  targetTouches: null,
  changedTouches: null,
  altKey: null,
  metaKey: null,
  ctrlKey: null,
  shiftKey: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticUIEvent}
 */
function SyntheticTouchEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticUIEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticUIEvent.augmentClass(SyntheticTouchEvent, TouchEventInterface);

module.exports = SyntheticTouchEvent;

},{"./SyntheticUIEvent":77}],77:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SyntheticUIEvent
 * @typechecks static-only
 */

"use strict";

var SyntheticEvent = require("./SyntheticEvent");

/**
 * @interface UIEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var UIEventInterface = {
  view: null,
  detail: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticEvent}
 */
function SyntheticUIEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticEvent.augmentClass(SyntheticUIEvent, UIEventInterface);

module.exports = SyntheticUIEvent;

},{"./SyntheticEvent":72}],78:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule SyntheticWheelEvent
 * @typechecks static-only
 */

"use strict";

var SyntheticMouseEvent = require("./SyntheticMouseEvent");

/**
 * @interface WheelEvent
 * @see http://www.w3.org/TR/DOM-Level-3-Events/
 */
var WheelEventInterface = {
  deltaX: function(event) {
    // NOTE: IE<9 does not support x-axis delta.
    return (
      'deltaX' in event ? event.deltaX :
      // Fallback to `wheelDeltaX` for Webkit and normalize (right is positive).
      'wheelDeltaX' in event ? -event.wheelDeltaX : 0
    );
  },
  deltaY: function(event) {
    return (
      // Normalize (up is positive).
      'deltaY' in event ? -event.deltaY :
      // Fallback to `wheelDeltaY` for Webkit.
      'wheelDeltaY' in event ? event.wheelDeltaY :
      // Fallback to `wheelDelta` for IE<9.
      'wheelDelta' in event ? event.wheelDelta : 0
    );
  },
  deltaZ: null,
  deltaMode: null
};

/**
 * @param {object} dispatchConfig Configuration used to dispatch this event.
 * @param {string} dispatchMarker Marker identifying the event target.
 * @param {object} nativeEvent Native browser event.
 * @extends {SyntheticMouseEvent}
 */
function SyntheticWheelEvent(dispatchConfig, dispatchMarker, nativeEvent) {
  SyntheticMouseEvent.call(this, dispatchConfig, dispatchMarker, nativeEvent);
}

SyntheticMouseEvent.augmentClass(SyntheticWheelEvent, WheelEventInterface);

module.exports = SyntheticWheelEvent;

},{"./SyntheticMouseEvent":75}],79:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule Transaction
 */

"use strict";

var invariant = require("./invariant");

/**
 * `Transaction` creates a black box that is able to wrap any method such that
 * certain invariants are maintained before and after the method is invoked
 * (Even if an exception is thrown while invoking the wrapped method). Whoever
 * instantiates a transaction can provide enforcers of the invariants at
 * creation time. The `Transaction` class itself will supply one additional
 * automatic invariant for you - the invariant that any transaction instance
 * should not be ran while it is already being ran. You would typically create a
 * single instance of a `Transaction` for reuse multiple times, that potentially
 * is used to wrap several different methods. Wrappers are extremely simple -
 * they only require implementing two methods.
 *
 * <pre>
 *                       wrappers (injected at creation time)
 *                                      +        +
 *                                      |        |
 *                    +-----------------|--------|--------------+
 *                    |                 v        |              |
 *                    |      +---------------+   |              |
 *                    |   +--|    wrapper1   |---|----+         |
 *                    |   |  +---------------+   v    |         |
 *                    |   |          +-------------+  |         |
 *                    |   |     +----|   wrapper2  |--------+   |
 *                    |   |     |    +-------------+  |     |   |
 *                    |   |     |                     |     |   |
 *                    |   v     v                     v     v   | wrapper
 *                    | +---+ +---+   +---------+   +---+ +---+ | invariants
 * perform(anyMethod) | |   | |   |   |         |   |   | |   | | maintained
 * +----------------->|-|---|-|---|-->|anyMethod|---|---|-|---|-|-------->
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | |   | |   |   |         |   |   | |   | |
 *                    | +---+ +---+   +---------+   +---+ +---+ |
 *                    |  initialize                    close    |
 *                    +-----------------------------------------+
 * </pre>
 *
 * Bonus:
 * - Reports timing metrics by method name and wrapper index.
 *
 * Use cases:
 * - Preserving the input selection ranges before/after reconciliation.
 *   Restoring selection even in the event of an unexpected error.
 * - Deactivating events while rearranging the DOM, preventing blurs/focuses,
 *   while guaranteeing that afterwards, the event system is reactivated.
 * - Flushing a queue of collected DOM mutations to the main UI thread after a
 *   reconciliation takes place in a worker thread.
 * - Invoking any collected `componentDidRender` callbacks after rendering new
 *   content.
 * - (Future use case): Wrapping particular flushes of the `ReactWorker` queue
 *   to preserve the `scrollTop` (an automatic scroll aware DOM).
 * - (Future use case): Layout calculations before and after DOM upates.
 *
 * Transactional plugin API:
 * - A module that has an `initialize` method that returns any precomputation.
 * - and a `close` method that accepts the precomputation. `close` is invoked
 *   when the wrapped process is completed, or has failed.
 *
 * @param {Array<TransactionalWrapper>} transactionWrapper Wrapper modules
 * that implement `initialize` and `close`.
 * @return {Transaction} Single transaction for reuse in thread.
 *
 * @class Transaction
 */
var Mixin = {
  /**
   * Sets up this instance so that it is prepared for collecting metrics. Does
   * so such that this setup method may be used on an instance that is already
   * initialized, in a way that does not consume additional memory upon reuse.
   * That can be useful if you decide to make your subclass of this mixin a
   * "PooledClass".
   */
  reinitializeTransaction: function() {
    this.transactionWrappers = this.getTransactionWrappers();
    if (!this.wrapperInitData) {
      this.wrapperInitData = [];
    } else {
      this.wrapperInitData.length = 0;
    }
    if (!this.timingMetrics) {
      this.timingMetrics = {};
    }
    this.timingMetrics.methodInvocationTime = 0;
    if (!this.timingMetrics.wrapperInitTimes) {
      this.timingMetrics.wrapperInitTimes = [];
    } else {
      this.timingMetrics.wrapperInitTimes.length = 0;
    }
    if (!this.timingMetrics.wrapperCloseTimes) {
      this.timingMetrics.wrapperCloseTimes = [];
    } else {
      this.timingMetrics.wrapperCloseTimes.length = 0;
    }
    this._isInTransaction = false;
  },

  _isInTransaction: false,

  /**
   * @abstract
   * @return {Array<TransactionWrapper>} Array of transaction wrappers.
   */
  getTransactionWrappers: null,

  isInTransaction: function() {
    return !!this._isInTransaction;
  },

  /**
   * Executes the function within a safety window. Use this for the top level
   * methods that result in large amounts of computation/mutations that would
   * need to be safety checked.
   *
   * @param {function} method Member of scope to call.
   * @param {Object} scope Scope to invoke from.
   * @param {Object?=} args... Arguments to pass to the method (optional).
   *                           Helps prevent need to bind in many cases.
   * @return Return value from `method`.
   */
  perform: function(method, scope, a, b, c, d, e, f) {
    ("production" !== process.env.NODE_ENV ? invariant(
      !this.isInTransaction(),
      'Transaction.perform(...): Cannot initialize a transaction when there ' +
      'is already an outstanding transaction.'
    ) : invariant(!this.isInTransaction()));
    var memberStart = Date.now();
    var errorToThrow = null;
    var ret;
    try {
      this.initializeAll();
      ret = method.call(scope, a, b, c, d, e, f);
    } catch (error) {
      // IE8 requires `catch` in order to use `finally`.
      errorToThrow = error;
    } finally {
      var memberEnd = Date.now();
      this.methodInvocationTime += (memberEnd - memberStart);
      try {
        this.closeAll();
      } catch (closeError) {
        // If `method` throws, prefer to show that stack trace over any thrown
        // by invoking `closeAll`.
        errorToThrow = errorToThrow || closeError;
      }
    }
    if (errorToThrow) {
      throw errorToThrow;
    }
    return ret;
  },

  initializeAll: function() {
    this._isInTransaction = true;
    var transactionWrappers = this.transactionWrappers;
    var wrapperInitTimes = this.timingMetrics.wrapperInitTimes;
    var errorToThrow = null;
    for (var i = 0; i < transactionWrappers.length; i++) {
      var initStart = Date.now();
      var wrapper = transactionWrappers[i];
      try {
        this.wrapperInitData[i] = wrapper.initialize ?
          wrapper.initialize.call(this) :
          null;
      } catch (initError) {
        // Prefer to show the stack trace of the first error.
        errorToThrow = errorToThrow || initError;
        this.wrapperInitData[i] = Transaction.OBSERVED_ERROR;
      } finally {
        var curInitTime = wrapperInitTimes[i];
        var initEnd = Date.now();
        wrapperInitTimes[i] = (curInitTime || 0) + (initEnd - initStart);
      }
    }
    if (errorToThrow) {
      throw errorToThrow;
    }
  },

  /**
   * Invokes each of `this.transactionWrappers.close[i]` functions, passing into
   * them the respective return values of `this.transactionWrappers.init[i]`
   * (`close`rs that correspond to initializers that failed will not be
   * invoked).
   */
  closeAll: function() {
    ("production" !== process.env.NODE_ENV ? invariant(
      this.isInTransaction(),
      'Transaction.closeAll(): Cannot close transaction when none are open.'
    ) : invariant(this.isInTransaction()));
    var transactionWrappers = this.transactionWrappers;
    var wrapperCloseTimes = this.timingMetrics.wrapperCloseTimes;
    var errorToThrow = null;
    for (var i = 0; i < transactionWrappers.length; i++) {
      var wrapper = transactionWrappers[i];
      var closeStart = Date.now();
      var initData = this.wrapperInitData[i];
      try {
        if (initData !== Transaction.OBSERVED_ERROR) {
          wrapper.close && wrapper.close.call(this, initData);
        }
      } catch (closeError) {
        // Prefer to show the stack trace of the first error.
        errorToThrow = errorToThrow || closeError;
      } finally {
        var closeEnd = Date.now();
        var curCloseTime = wrapperCloseTimes[i];
        wrapperCloseTimes[i] = (curCloseTime || 0) + (closeEnd - closeStart);
      }
    }
    this.wrapperInitData.length = 0;
    this._isInTransaction = false;
    if (errorToThrow) {
      throw errorToThrow;
    }
  }
};

var Transaction = {

  Mixin: Mixin,

  /**
   * Token to look for to determine if an error occured.
   */
  OBSERVED_ERROR: {}

};

module.exports = Transaction;

},{"./invariant":104,"__browserify_process":124}],80:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ViewportMetrics
 */

"use strict";

var getUnboundedScrollPosition = require("./getUnboundedScrollPosition");

var ViewportMetrics = {

  currentScrollLeft: 0,

  currentScrollTop: 0,

  refreshScrollValues: function() {
    var scrollPosition = getUnboundedScrollPosition(window);
    ViewportMetrics.currentScrollLeft = scrollPosition.x;
    ViewportMetrics.currentScrollTop = scrollPosition.y;
  }

};

module.exports = ViewportMetrics;

},{"./getUnboundedScrollPosition":102}],81:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule accumulate
 */

"use strict";

var invariant = require("./invariant");

/**
 * Accumulates items that must not be null or undefined.
 *
 * This is used to conserve memory by avoiding array allocations.
 *
 * @return {*|array<*>} An accumulation of items.
 */
function accumulate(current, next) {
  ("production" !== process.env.NODE_ENV ? invariant(
    next != null,
    'accumulate(...): Accumulated items must be not be null or undefined.'
  ) : invariant(next != null));
  if (current == null) {
    return next;
  } else {
    // Both are not empty. Warning: Never call x.concat(y) when you are not
    // certain that x is an Array (x could be a string with concat method).
    var currentIsArray = Array.isArray(current);
    var nextIsArray = Array.isArray(next);
    if (currentIsArray) {
      return current.concat(next);
    } else {
      if (nextIsArray) {
        return [current].concat(next);
      } else {
        return [current, next];
      }
    }
  }
}

module.exports = accumulate;

},{"./invariant":104,"__browserify_process":124}],82:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule adler32
 */

/* jslint bitwise:true */

"use strict";

var MOD = 65521;

// This is a clean-room implementation of adler32 designed for detecting
// if markup is not what we expect it to be. It does not need to be
// cryptographically strong, only reasonable good at detecting if markup
// generated on the server is different than that on the client.
function adler32(data) {
  var a = 1;
  var b = 0;
  for (var i = 0; i < data.length; i++) {
    a = (a + data.charCodeAt(i)) % MOD;
    b = (b + a) % MOD;
  }
  return a | (b << 16);
}

module.exports = adler32;

},{}],83:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule containsNode
 * @typechecks
 */

var isTextNode = require("./isTextNode");

/*jslint bitwise:true */

/**
 * Checks if a given DOM node contains or is another DOM node.
 *
 * @param {?DOMNode} outerNode Outer DOM node.
 * @param {?DOMNode} innerNode Inner DOM node.
 * @return {boolean} True if `outerNode` contains or is `innerNode`.
 */
function containsNode(outerNode, innerNode) {
  if (!outerNode || !innerNode) {
    return false;
  } else if (outerNode === innerNode) {
    return true;
  } else if (isTextNode(outerNode)) {
    return false;
  } else if (isTextNode(innerNode)) {
    return containsNode(outerNode, innerNode.parentNode);
  } else if (outerNode.contains) {
    return outerNode.contains(innerNode);
  } else if (outerNode.compareDocumentPosition) {
    return !!(outerNode.compareDocumentPosition(innerNode) & 16);
  } else {
    return false;
  }
}

module.exports = containsNode;

},{"./isTextNode":108}],84:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule copyProperties
 */

/**
 * Copy properties from one or more objects (up to 5) into the first object.
 * This is a shallow copy. It mutates the first object and also returns it.
 *
 * NOTE: `arguments` has a very significant performance penalty, which is why
 * we don't support unlimited arguments.
 */
function copyProperties(obj, a, b, c, d, e, f) {
  obj = obj || {};

  if ("production" !== process.env.NODE_ENV) {
    if (f) {
      throw new Error('Too many arguments passed to copyProperties');
    }
  }

  var args = [a, b, c, d, e];
  var ii = 0, v;
  while (args[ii]) {
    v = args[ii++];
    for (var k in v) {
      obj[k] = v[k];
    }

    // IE ignores toString in object iteration.. See:
    // webreflection.blogspot.com/2007/07/quick-fix-internet-explorer-and.html
    if (v.hasOwnProperty && v.hasOwnProperty('toString') &&
        (typeof v.toString != 'undefined') && (obj.toString !== v.toString)) {
      obj.toString = v.toString;
    }
  }

  return obj;
}

module.exports = copyProperties;

},{"__browserify_process":124}],85:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule createArrayFrom
 * @typechecks
 */

/**
 * NOTE: if you are a previous user of this function, it has been considered
 * unsafe because it's inconsistent across browsers for some inputs.
 * Instead use `Array.isArray()`.
 *
 * Perform a heuristic test to determine if an object is "array-like".
 *
 *   A monk asked Joshu, a Zen master, "Has a dog Buddha nature?"
 *   Joshu replied: "Mu."
 *
 * This function determines if its argument has "array nature": it returns
 * true if the argument is an actual array, an `arguments' object, or an
 * HTMLCollection (e.g. node.childNodes or node.getElementsByTagName()).
 *
 * @param {*} obj
 * @return {boolean}
 */
function hasArrayNature(obj) {
  return (
    // not null/false
    !!obj &&
    // arrays are objects, NodeLists are functions in Safari
    (typeof obj == 'object' || typeof obj == 'function') &&
    // quacks like an array
    ('length' in obj) &&
    // not window
    !('setInterval' in obj) &&
    // no DOM node should be considered an array-like
    // a 'select' element has 'length' and 'item' properties on IE8
    (typeof obj.nodeType != 'number') &&
    (
      // a real array
      (// HTMLCollection/NodeList
      (Array.isArray(obj) ||
      // arguments
      ('callee' in obj) || 'item' in obj))
    )
  );
}

/**
 * Ensure that the argument is an array by wrapping it in an array if it is not.
 * Creates a copy of the argument if it is already an array.
 *
 * This is mostly useful idiomatically:
 *
 *   var createArrayFrom = require('createArrayFrom');
 *
 *   function takesOneOrMoreThings(things) {
 *     things = createArrayFrom(things);
 *     ...
 *   }
 *
 * This allows you to treat `things' as an array, but accept scalars in the API.
 *
 * This is also good for converting certain pseudo-arrays, like `arguments` or
 * HTMLCollections, into arrays.
 *
 * @param {*} obj
 * @return {array}
 */
function createArrayFrom(obj) {
  if (!hasArrayNature(obj)) {
    return [obj];
  }
  if (obj.item) {
    // IE does not support Array#slice on HTMLCollections
    var l = obj.length, ret = new Array(l);
    while (l--) { ret[l] = obj[l]; }
    return ret;
  }
  return Array.prototype.slice.call(obj);
}

module.exports = createArrayFrom;

},{}],86:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule createNodesFromMarkup
 * @typechecks
 */

/*jslint evil: true, sub: true */

var ExecutionEnvironment = require("./ExecutionEnvironment");

var createArrayFrom = require("./createArrayFrom");
var getMarkupWrap = require("./getMarkupWrap");
var invariant = require("./invariant");

/**
 * Dummy container used to render all markup.
 */
var dummyNode =
  ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;

/**
 * Pattern used by `getNodeName`.
 */
var nodeNamePattern = /^\s*<(\w+)/;

/**
 * Extracts the `nodeName` of the first element in a string of markup.
 *
 * @param {string} markup String of markup.
 * @return {?string} Node name of the supplied markup.
 */
function getNodeName(markup) {
  var nodeNameMatch = markup.match(nodeNamePattern);
  return nodeNameMatch && nodeNameMatch[1].toLowerCase();
}

/**
 * Creates an array containing the nodes rendered from the supplied markup. The
 * optionally supplied `handleScript` function will be invoked once for each
 * <script> element that is rendered. If no `handleScript` function is supplied,
 * an exception is thrown if any <script> elements are rendered.
 *
 * @param {string} markup A string of valid HTML markup.
 * @param {?function} handleScript Invoked once for each rendered <script>.
 * @return {array<DOMElement|DOMTextNode>} An array of rendered nodes.
 */
function createNodesFromMarkup(markup, handleScript) {
  var node = dummyNode;
  ("production" !== process.env.NODE_ENV ? invariant(!!dummyNode, 'createNodesFromMarkup dummy not initialized') : invariant(!!dummyNode));
  var nodeName = getNodeName(markup);

  var wrap = nodeName && getMarkupWrap(nodeName);
  if (wrap) {
    node.innerHTML = wrap[1] + markup + wrap[2];

    var wrapDepth = wrap[0];
    while (wrapDepth--) {
      node = node.lastChild;
    }
  } else {
    node.innerHTML = markup;
  }

  var scripts = node.getElementsByTagName('script');
  if (scripts.length) {
    ("production" !== process.env.NODE_ENV ? invariant(
      handleScript,
      'createNodesFromMarkup(...): Unexpected <script> element rendered.'
    ) : invariant(handleScript));
    createArrayFrom(scripts).forEach(handleScript);
  }

  var nodes = createArrayFrom(node.childNodes);
  while (node.lastChild) {
    node.removeChild(node.lastChild);
  }
  return nodes;
}

module.exports = createNodesFromMarkup;

},{"./ExecutionEnvironment":26,"./createArrayFrom":85,"./getMarkupWrap":98,"./invariant":104,"__browserify_process":124}],87:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule createObjectFrom
 */

/**
 * Construct an object from an array of keys
 * and optionally specified value or list of values.
 *
 *  >>> createObjectFrom(['a','b','c']);
 *  {a: true, b: true, c: true}
 *
 *  >>> createObjectFrom(['a','b','c'], false);
 *  {a: false, b: false, c: false}
 *
 *  >>> createObjectFrom(['a','b','c'], 'monkey');
 *  {c:'monkey', b:'monkey' c:'monkey'}
 *
 *  >>> createObjectFrom(['a','b','c'], [1,2,3]);
 *  {a: 1, b: 2, c: 3}
 *
 *  >>> createObjectFrom(['women', 'men'], [true, false]);
 *  {women: true, men: false}
 *
 * @param   Array   list of keys
 * @param   mixed   optional value or value array.  defaults true.
 * @returns object
 */
function createObjectFrom(keys, values /* = true */) {
  if ("production" !== process.env.NODE_ENV) {
    if (!Array.isArray(keys)) {
      throw new TypeError('Must pass an array of keys.');
    }
  }

  var object = {};
  var isArray = Array.isArray(values);
  if (typeof values == 'undefined') {
    values = true;
  }

  for (var ii = keys.length; ii--;) {
    object[keys[ii]] = isArray ? values[ii] : values;
  }
  return object;
}

module.exports = createObjectFrom;

},{"__browserify_process":124}],88:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule dangerousStyleValue
 * @typechecks static-only
 */

"use strict";

var CSSProperty = require("./CSSProperty");

/**
 * Convert a value into the proper css writable value. The `styleName` name
 * name should be logical (no hyphens), as specified
 * in `CSSProperty.isUnitlessNumber`.
 *
 * @param {string} styleName CSS property name such as `topMargin`.
 * @param {*} value CSS property value such as `10px`.
 * @return {string} Normalized style value with dimensions applied.
 */
function dangerousStyleValue(styleName, value) {
  // Note that we've removed escapeTextForBrowser() calls here since the
  // whole string will be escaped when the attribute is injected into
  // the markup. If you provide unsafe user data here they can inject
  // arbitrary CSS which may be problematic (I couldn't repro this):
  // https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet
  // http://www.thespanner.co.uk/2007/11/26/ultimate-xss-css-injection/
  // This is not an XSS hole but instead a potential CSS injection issue
  // which has lead to a greater discussion about how we're going to
  // trust URLs moving forward. See #2115901

  var isEmpty = value == null || typeof value === 'boolean' || value === '';
  if (isEmpty) {
    return '';
  }

  var isNonNumeric = isNaN(value);
  if (isNonNumeric || value === 0 || CSSProperty.isUnitlessNumber[styleName]) {
    return '' + value; // cast to string
  }

  return value + 'px';
}

module.exports = dangerousStyleValue;

},{"./CSSProperty":8}],89:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule emptyFunction
 */

var copyProperties = require("./copyProperties");

function makeEmptyFunction(arg) {
  return function() {
    return arg;
  };
}

/**
 * This function accepts and discards inputs; it has no side effects. This is
 * primarily useful idiomatically for overridable function endpoints which
 * always need to be callable, since JS lacks a null-call idiom ala Cocoa.
 */
function emptyFunction() {}

copyProperties(emptyFunction, {
  thatReturns: makeEmptyFunction,
  thatReturnsFalse: makeEmptyFunction(false),
  thatReturnsTrue: makeEmptyFunction(true),
  thatReturnsNull: makeEmptyFunction(null),
  thatReturnsThis: function() { return this; },
  thatReturnsArgument: function(arg) { return arg; }
});

module.exports = emptyFunction;

},{"./copyProperties":84}],90:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule escapeTextForBrowser
 * @typechecks static-only
 */

"use strict";

var ESCAPE_LOOKUP = {
  "&": "&amp;",
  ">": "&gt;",
  "<": "&lt;",
  "\"": "&quot;",
  "'": "&#x27;",
  "/": "&#x2f;"
};

var ESCAPE_REGEX = /[&><"'\/]/g;

function escaper(match) {
  return ESCAPE_LOOKUP[match];
}

/**
 * Escapes text to prevent scripting attacks.
 *
 * @param {*} text Text value to escape.
 * @return {string} An escaped string.
 */
function escapeTextForBrowser(text) {
  return ('' + text).replace(ESCAPE_REGEX, escaper);
}

module.exports = escapeTextForBrowser;

},{}],91:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ex
 * @typechecks
 * @nostacktrace
 */

/**
 * This function transforms error message with arguments into plain text error
 * message, so that it can be passed to window.onerror without losing anything.
 * It can then be transformed back by `erx()` function.
 *
 * Usage:
 *   throw new Error(ex('Error %s from %s', errorCode, userID));
 *
 * @param {string} errorMessage
 */

var ex = function(errorMessage/*, arg1, arg2, ...*/) {
  var args = Array.prototype.slice.call(arguments).map(function(arg) {
    return String(arg);
  });
  var expectedLength = errorMessage.split('%s').length - 1;

  if (expectedLength !== args.length - 1) {
    // something wrong with the formatting string
    return ex('ex args number mismatch: %s', JSON.stringify(args));
  }

  return ex._prefix + JSON.stringify(args) + ex._suffix;
};

ex._prefix = '<![EX[';
ex._suffix = ']]>';

module.exports = ex;

},{}],92:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule filterAttributes
 * @typechecks static-only
 */

/*jslint evil: true */

'use strict';

/**
 * Like filter(), but for a DOM nodes attributes. Returns an array of
 * the filter DOMAttribute objects. Does some perf related this like
 * caching attributes.length.
 *
 * @param {DOMElement} node Node whose attributes you want to filter
 * @return {array} array of DOM attribute objects.
 */
function filterAttributes(node, func, context) {
  var attributes = node.attributes;
  var numAttributes = attributes.length;
  var accumulator = [];
  for (var i = 0; i < numAttributes; i++) {
    var attr = attributes.item(i);
    if (func.call(context, attr)) {
      accumulator.push(attr);
    }
  }
  return accumulator;
}

module.exports = filterAttributes;

},{}],93:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule flattenChildren
 */

"use strict";

var invariant = require("./invariant");
var traverseAllChildren = require("./traverseAllChildren");

/**
 * @param {function} traverseContext Context passed through traversal.
 * @param {?ReactComponent} child React child component.
 * @param {!string} name String name of key path to child.
 */
function flattenSingleChildIntoContext(traverseContext, child, name) {
  // We found a component instance.
  var result = traverseContext;
  ("production" !== process.env.NODE_ENV ? invariant(
    !result.hasOwnProperty(name),
    'flattenChildren(...): Encountered two children with the same key, `%s`. ' +
    'Children keys must be unique.',
    name
  ) : invariant(!result.hasOwnProperty(name)));
  result[name] = child;
}

/**
 * Flattens children that are typically specified as `props.children`.
 * @return {!object} flattened children keyed by name.
 */
function flattenChildren(children) {
  if (children == null) {
    return children;
  }
  var result = {};
  traverseAllChildren(children, flattenSingleChildIntoContext, result);
  return result;
}

module.exports = flattenChildren;

},{"./invariant":104,"./traverseAllChildren":122,"__browserify_process":124}],94:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule forEachAccumulated
 */

"use strict";

/**
 * @param {array} an "accumulation" of items which is either an Array or
 * a single item. Useful when paired with the `accumulate` module. This is a
 * simple utility that allows us to reason about a collection of items, but
 * handling the case when there is exactly one item (and we do not need to
 * allocate an array).
 */
var forEachAccumulated = function(arr, cb, scope) {
  if (Array.isArray(arr)) {
    arr.forEach(cb, scope);
  } else if (arr) {
    cb.call(scope, arr);
  }
};

module.exports = forEachAccumulated;

},{}],95:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule ge
 */

/**
 * Find a node by ID.  Optionally search a sub-tree outside of the document
 *
 * Use ge if you're not sure whether or not the element exists. You can test
 * for existence yourself in your application code.
 *
 * If your application code depends on the existence of the element, use $
 * instead, which will throw in DEV if the element doesn't exist.
 */
function ge(arg, root, tag) {
  return typeof arg != 'string' ? arg :
    !root ? document.getElementById(arg) :
    _geFromSubtree(arg, root, tag);
}

function _geFromSubtree(id, root, tag) {
  var elem, children, ii;

  if (_getNodeID(root) == id) {
    return root;
  } else if (root.getElementsByTagName) {
    // All Elements implement this, which does an iterative DFS, which is
    // faster than recursion and doesn't run into stack depth issues.
    children = root.getElementsByTagName(tag || '*');
    for (ii = 0; ii < children.length; ii++) {
      if (_getNodeID(children[ii]) == id) {
        return children[ii];
      }
    }
  } else {
    // DocumentFragment does not implement getElementsByTagName, so
    // recurse over its children. Its children must be Elements, so
    // each child will use the getElementsByTagName case instead.
    children = root.childNodes;
    for (ii = 0; ii < children.length; ii++) {
      elem = _geFromSubtree(id, children[ii]);
      if (elem) {
        return elem;
      }
    }
  }

  return null;
}

/**
 * Return the ID value for a given node. This allows us to avoid issues
 * with forms that contain inputs with name="id".
 *
 * @return string (null if attribute not set)
 */
function _getNodeID(node) {
  // #document and #document-fragment do not have getAttributeNode.
  var id = node.getAttributeNode && node.getAttributeNode('id');
  return id ? id.value : null;
}

module.exports = ge;

},{}],96:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule getActiveElement
 * @typechecks
 */

/**
 * Same as document.activeElement but wraps in a try-catch block. In IE it is
 * not safe to call document.activeElement if there is nothing focused.
 */
function getActiveElement() /*?DOMElement*/ {
  try {
    return document.activeElement;
  } catch (e) {
    return null;
  }
}

module.exports = getActiveElement;


},{}],97:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule getEventTarget
 * @typechecks static-only
 */

"use strict";

/**
 * Gets the target node from a native browser event by accounting for
 * inconsistencies in browser DOM APIs.
 *
 * @param {object} nativeEvent Native browser event.
 * @return {DOMEventTarget} Target node.
 */
function getEventTarget(nativeEvent) {
  var target = nativeEvent.target || nativeEvent.srcElement || window;
  // Safari may fire events on text nodes (Node.TEXT_NODE is 3).
  // @see http://www.quirksmode.org/js/events_properties.html
  return target.nodeType === 3 ? target.parentNode : target;
}

module.exports = getEventTarget;

},{}],98:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule getMarkupWrap
 */

var ExecutionEnvironment = require("./ExecutionEnvironment");

var invariant = require("./invariant");

/**
 * Dummy container used to detect which wraps are necessary.
 */
var dummyNode =
  ExecutionEnvironment.canUseDOM ? document.createElement('div') : null;

/**
 * Some browsers cannot use `innerHTML` to render certain elements standalone,
 * so we wrap them, render the wrapped nodes, then extract the desired node.
 *
 * In IE8, certain elements cannot render alone, so wrap all elements ('*').
 */
var shouldWrap = {
  // Force wrapping for SVG elements because if they get created inside a <div>,
  // they will be initialized in the wrong namespace (and will not display).
  'circle': true,
  'g': true,
  'line': true,
  'path': true,
  'polyline': true,
  'rect': true,
  'text': true
};

var selectWrap = [1, '<select multiple="true">', '</select>'];
var tableWrap = [1, '<table>', '</table>'];
var trWrap = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

var svgWrap = [1, '<svg>', '</svg>'];

var markupWrap = {
  '*': [1, '?<div>', '</div>'],

  'area': [1, '<map>', '</map>'],
  'col': [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>'],
  'legend': [1, '<fieldset>', '</fieldset>'],
  'param': [1, '<object>', '</object>'],
  'tr': [2, '<table><tbody>', '</tbody></table>'],

  'optgroup': selectWrap,
  'option': selectWrap,

  'caption': tableWrap,
  'colgroup': tableWrap,
  'tbody': tableWrap,
  'tfoot': tableWrap,
  'thead': tableWrap,

  'td': trWrap,
  'th': trWrap,

  'circle': svgWrap,
  'g': svgWrap,
  'line': svgWrap,
  'path': svgWrap,
  'polyline': svgWrap,
  'rect': svgWrap,
  'text': svgWrap
};

/**
 * Gets the markup wrap configuration for the supplied `nodeName`.
 *
 * NOTE: This lazily detects which wraps are necessary for the current browser.
 *
 * @param {string} nodeName Lowercase `nodeName`.
 * @return {?array} Markup wrap configuration, if applicable.
 */
function getMarkupWrap(nodeName) {
  ("production" !== process.env.NODE_ENV ? invariant(!!dummyNode, 'Markup wrapping node not initialized') : invariant(!!dummyNode));
  if (!markupWrap.hasOwnProperty(nodeName)) {
    nodeName = '*';
  }
  if (!shouldWrap.hasOwnProperty(nodeName)) {
    if (nodeName === '*') {
      dummyNode.innerHTML = '<link />';
    } else {
      dummyNode.innerHTML = '<' + nodeName + '></' + nodeName + '>';
    }
    shouldWrap[nodeName] = !dummyNode.firstChild;
  }
  return shouldWrap[nodeName] ? markupWrap[nodeName] : null;
}


module.exports = getMarkupWrap;

},{"./ExecutionEnvironment":26,"./invariant":104,"__browserify_process":124}],99:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule getNodeForCharacterOffset
 */

"use strict";

/**
 * Given any node return the first leaf node without children.
 *
 * @param {DOMElement|DOMTextNode} node
 * @return {DOMElement|DOMTextNode}
 */
function getLeafNode(node) {
  while (node && node.firstChild) {
    node = node.firstChild;
  }
  return node;
}

/**
 * Get the next sibling within a container. This will walk up the
 * DOM if a node's siblings have been exhausted.
 *
 * @param {DOMElement|DOMTextNode} node
 * @return {?DOMElement|DOMTextNode}
 */
function getSiblingNode(node) {
  while (node) {
    if (node.nextSibling) {
      return node.nextSibling;
    }
    node = node.parentNode;
  }
}

/**
 * Get object describing the nodes which contain characters at offset.
 *
 * @param {DOMElement|DOMTextNode} root
 * @param {number} offset
 * @return {?object}
 */
function getNodeForCharacterOffset(root, offset) {
  var node = getLeafNode(root);
  var nodeStart = 0;
  var nodeEnd = 0;

  while (node) {
    if (node.nodeType == 3) {
      nodeEnd = nodeStart + node.textContent.length;

      if (nodeStart <= offset && nodeEnd >= offset) {
        return {
          node: node,
          offset: offset - nodeStart
        };
      }

      nodeStart = nodeEnd;
    }

    node = getLeafNode(getSiblingNode(node));
  }
}

module.exports = getNodeForCharacterOffset;

},{}],100:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule getReactRootElementInContainer
 */

"use strict";

var DOC_NODE_TYPE = 9;

/**
 * @param {DOMElement|DOMDocument} container DOM element that may contain
 *                                           a React component
 * @return {?*} DOM element that may have the reactRoot ID, or null.
 */
function getReactRootElementInContainer(container) {
  if (!container) {
    return null;
  }

  if (container.nodeType === DOC_NODE_TYPE) {
    return container.documentElement;
  } else {
    return container.firstChild;
  }
}

module.exports = getReactRootElementInContainer;

},{}],101:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule getTextContentAccessor
 */

"use strict";

var ExecutionEnvironment = require("./ExecutionEnvironment");

var contentKey = null;

/**
 * Gets the key used to access text content on a DOM node.
 *
 * @return {?string} Key used to access text content.
 * @internal
 */
function getTextContentAccessor() {
  if (!contentKey && ExecutionEnvironment.canUseDOM) {
    contentKey = 'innerText' in document.createElement('div') ?
      'innerText' :
      'textContent';
  }
  return contentKey;
}

module.exports = getTextContentAccessor;

},{"./ExecutionEnvironment":26}],102:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule getUnboundedScrollPosition
 * @typechecks
 */

"use strict";

/**
 * Gets the scroll position of the supplied element or window.
 *
 * The return values are unbounded, unlike `getScrollPosition`. This means they
 * may be negative or exceed the element boundaries (which is possible using
 * inertial scrolling).
 *
 * @param {DOMWindow|DOMElement} scrollable
 * @return {object} Map with `x` and `y` keys.
 */
function getUnboundedScrollPosition(scrollable) {
  if (scrollable === window) {
    return {
      x: document.documentElement.scrollLeft || document.body.scrollLeft,
      y: document.documentElement.scrollTop  || document.body.scrollTop
    };
  }
  return {
    x: scrollable.scrollLeft,
    y: scrollable.scrollTop
  };
}

module.exports = getUnboundedScrollPosition;

},{}],103:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule hyphenate
 * @typechecks
 */

var _uppercasePattern = /([A-Z])/g;

/**
 * Hyphenates a camelcased string, for example:
 *
 *   > hyphenate('backgroundColor')
 *   < "background-color"
 *
 * @param {string} string
 * @return {string}
 */
function hyphenate(string) {
  return string.replace(_uppercasePattern, '-$1').toLowerCase();
}

module.exports = hyphenate;

},{}],104:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule invariant
 */

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf style format and arguments to provide information about
 * what broke and what you were expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

function invariant(condition) {
  if (!condition) {
    throw new Error('Invariant Violation');
  }
}

module.exports = invariant;

if ("production" !== process.env.NODE_ENV) {
  var invariantDev = function(condition, format, a, b, c, d, e, f) {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }

    if (!condition) {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      throw new Error(
        'Invariant Violation: ' +
        format.replace(/%s/g, function() { return args[argIndex++]; })
      );
    }
  };

  module.exports = invariantDev;
}

},{"__browserify_process":124}],105:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule isEventSupported
 */

"use strict";

var ExecutionEnvironment = require("./ExecutionEnvironment");

var testNode, useHasFeature;
if (ExecutionEnvironment.canUseDOM) {
  testNode = document.createElement('div');
  useHasFeature =
    document.implementation &&
    document.implementation.hasFeature &&
    // `hasFeature` always returns true in Firefox 19+.
    document.implementation.hasFeature('', '') !== true;
}

/**
 * Checks if an event is supported in the current execution environment.
 *
 * NOTE: This will not work correctly for non-generic events such as `change`,
 * `reset`, `load`, `error`, and `select`.
 *
 * Borrows from Modernizr.
 *
 * @param {string} eventNameSuffix Event name, e.g. "click".
 * @param {?boolean} capture Check if the capture phase is supported.
 * @return {boolean} True if the event is supported.
 * @internal
 * @license Modernizr 3.0.0pre (Custom Build) | MIT
 */
function isEventSupported(eventNameSuffix, capture) {
  if (!testNode || (capture && !testNode.addEventListener)) {
    return false;
  }
  var element = document.createElement('div');

  var eventName = 'on' + eventNameSuffix;
  var isSupported = eventName in element;

  if (!isSupported) {
    element.setAttribute(eventName, 'return;');
    isSupported = typeof element[eventName] === 'function';
    if (typeof element[eventName] !== 'undefined') {
      element[eventName] = undefined;
    }
    element.removeAttribute(eventName);
  }

  if (!isSupported && useHasFeature && eventNameSuffix === 'wheel') {
    // This is the only way to test support for the `wheel` event in IE9+.
    isSupported = document.implementation.hasFeature('Events.wheel', '3.0');
  }

  element = null;
  return isSupported;
}

module.exports = isEventSupported;

},{"./ExecutionEnvironment":26}],106:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule isNode
 * @typechecks
 */

/**
 * @param {*} object The object to check.
 * @return {boolean} Whether or not the object is a DOM node.
 */
function isNode(object) {
  return !!(object && (
    typeof Node !== 'undefined' ? object instanceof Node :
      typeof object === 'object' &&
      typeof object.nodeType === 'number' &&
      typeof object.nodeName === 'string'
  ));
}

module.exports = isNode;

},{}],107:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule isTextInputElement
 */

"use strict";

/**
 * @see http://www.whatwg.org/specs/web-apps/current-work/multipage/the-input-element.html#input-type-attr-summary
 */
var supportedInputTypes = {
  'color': true,
  'date': true,
  'datetime': true,
  'datetime-local': true,
  'email': true,
  'month': true,
  'number': true,
  'password': true,
  'range': true,
  'search': true,
  'tel': true,
  'text': true,
  'time': true,
  'url': true,
  'week': true
};

function isTextInputElement(elem) {
  return elem && (
    (elem.nodeName === 'INPUT' && supportedInputTypes[elem.type]) ||
    elem.nodeName === 'TEXTAREA'
  );
}

module.exports = isTextInputElement;

},{}],108:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule isTextNode
 * @typechecks
 */

var isNode = require("./isNode");

/**
 * @param {*} object The object to check.
 * @return {boolean} Whether or not the object is a DOM text node.
 */
function isTextNode(object) {
  return isNode(object) && object.nodeType == 3;
}

module.exports = isTextNode;

},{"./isNode":106}],109:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule joinClasses
 * @typechecks static-only
 */

"use strict";

/**
 * Combines multiple className strings into one.
 * http://jsperf.com/joinclasses-args-vs-array
 *
 * @param {...?string} classes
 * @return {string}
 */
function joinClasses(className/*, ... */) {
  if (!className) {
    className = '';
  }
  var nextClass;
  var argLength = arguments.length;
  if (argLength > 1) {
    for (var ii = 1; ii < argLength; ii++) {
      nextClass = arguments[ii];
      nextClass && (className += ' ' + nextClass);
    }
  }
  return className;
}

module.exports = joinClasses;

},{}],110:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule keyMirror
 * @typechecks static-only
 */

"use strict";

var invariant = require("./invariant");

/**
 * Constructs an enumeration with keys equal to their value.
 *
 * For example:
 *
 *   var COLORS = keyMirror({blue: null, red: null});
 *   var myColor = COLORS.blue;
 *   var isColorValid = !!COLORS[myColor];
 *
 * The last line could not be performed if the values of the generated enum were
 * not equal to their keys.
 *
 *   Input:  {key1: val1, key2: val2}
 *   Output: {key1: key1, key2: key2}
 *
 * @param {object} obj
 * @return {object}
 */
var keyMirror = function(obj) {
  var ret = {};
  var key;
  ("production" !== process.env.NODE_ENV ? invariant(
    obj instanceof Object && !Array.isArray(obj),
    'keyMirror(...): Argument must be an object.'
  ) : invariant(obj instanceof Object && !Array.isArray(obj)));
  for (key in obj) {
    if (!obj.hasOwnProperty(key)) {
      continue;
    }
    ret[key] = key;
  }
  return ret;
};

module.exports = keyMirror;

},{"./invariant":104,"__browserify_process":124}],111:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule keyOf
 */

/**
 * Allows extraction of a minified key. Let's the build system minify keys
 * without loosing the ability to dynamically use key strings as values
 * themselves. Pass in an object with a single key/val pair and it will return
 * you the string key of that single record. Suppose you want to grab the
 * value for a key 'className' inside of an object. Key/val minification may
 * have aliased that key to be 'xa12'. keyOf({className: null}) will return
 * 'xa12' in that case. Resolve keys you want to use once at startup time, then
 * reuse those resolutions.
 */
var keyOf = function(oneKeyObj) {
  var key;
  for (key in oneKeyObj) {
    if (!oneKeyObj.hasOwnProperty(key)) {
      continue;
    }
    return key;
  }
  return null;
};


module.exports = keyOf;

},{}],112:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule memoizeStringOnly
 * @typechecks static-only
 */

"use strict";

/**
 * Memoizes the return value of a function that accepts one string argument.
 *
 * @param {function} callback
 * @return {function}
 */
function memoizeStringOnly(callback) {
  var cache = {};
  return function(string) {
    if (cache.hasOwnProperty(string)) {
      return cache[string];
    } else {
      return cache[string] = callback.call(this, string);
    }
  };
}

module.exports = memoizeStringOnly;

},{}],113:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule merge
 */

"use strict";

var mergeInto = require("./mergeInto");

/**
 * Shallow merges two structures into a return value, without mutating either.
 *
 * @param {?object} one Optional object with properties to merge from.
 * @param {?object} two Optional object with properties to merge from.
 * @return {object} The shallow extension of one by two.
 */
var merge = function(one, two) {
  var result = {};
  mergeInto(result, one);
  mergeInto(result, two);
  return result;
};

module.exports = merge;

},{"./mergeInto":115}],114:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule mergeHelpers
 *
 * requiresPolyfills: Array.isArray
 */

"use strict";

var invariant = require("./invariant");
var keyMirror = require("./keyMirror");

/**
 * Maximum number of levels to traverse. Will catch circular structures.
 * @const
 */
var MAX_MERGE_DEPTH = 36;

/**
 * We won't worry about edge cases like new String('x') or new Boolean(true).
 * Functions are considered terminals, and arrays are not.
 * @param {*} o The item/object/value to test.
 * @return {boolean} true iff the argument is a terminal.
 */
var isTerminal = function(o) {
  return typeof o !== 'object' || o === null;
};

var mergeHelpers = {

  MAX_MERGE_DEPTH: MAX_MERGE_DEPTH,

  isTerminal: isTerminal,

  /**
   * Converts null/undefined values into empty object.
   *
   * @param {?Object=} arg Argument to be normalized (nullable optional)
   * @return {!Object}
   */
  normalizeMergeArg: function(arg) {
    return arg === undefined || arg === null ? {} : arg;
  },

  /**
   * If merging Arrays, a merge strategy *must* be supplied. If not, it is
   * likely the caller's fault. If this function is ever called with anything
   * but `one` and `two` being `Array`s, it is the fault of the merge utilities.
   *
   * @param {*} one Array to merge into.
   * @param {*} two Array to merge from.
   */
  checkMergeArrayArgs: function(one, two) {
    ("production" !== process.env.NODE_ENV ? invariant(
      Array.isArray(one) && Array.isArray(two),
      'Critical assumptions about the merge functions have been violated. ' +
      'This is the fault of the merge functions themselves, not necessarily ' +
      'the callers.'
    ) : invariant(Array.isArray(one) && Array.isArray(two)));
  },

  /**
   * @param {*} one Object to merge into.
   * @param {*} two Object to merge from.
   */
  checkMergeObjectArgs: function(one, two) {
    mergeHelpers.checkMergeObjectArg(one);
    mergeHelpers.checkMergeObjectArg(two);
  },

  /**
   * @param {*} arg
   */
  checkMergeObjectArg: function(arg) {
    ("production" !== process.env.NODE_ENV ? invariant(
      !isTerminal(arg) && !Array.isArray(arg),
      'Critical assumptions about the merge functions have been violated. ' +
      'This is the fault of the merge functions themselves, not necessarily ' +
      'the callers.'
    ) : invariant(!isTerminal(arg) && !Array.isArray(arg)));
  },

  /**
   * Checks that a merge was not given a circular object or an object that had
   * too great of depth.
   *
   * @param {number} Level of recursion to validate against maximum.
   */
  checkMergeLevel: function(level) {
    ("production" !== process.env.NODE_ENV ? invariant(
      level < MAX_MERGE_DEPTH,
      'Maximum deep merge depth exceeded. You may be attempting to merge ' +
      'circular structures in an unsupported way.'
    ) : invariant(level < MAX_MERGE_DEPTH));
  },

  /**
   * Checks that the supplied merge strategy is valid.
   *
   * @param {string} Array merge strategy.
   */
  checkArrayStrategy: function(strategy) {
    ("production" !== process.env.NODE_ENV ? invariant(
      strategy === undefined || strategy in mergeHelpers.ArrayStrategies,
      'You must provide an array strategy to deep merge functions to ' +
      'instruct the deep merge how to resolve merging two arrays.'
    ) : invariant(strategy === undefined || strategy in mergeHelpers.ArrayStrategies));
  },

  /**
   * Set of possible behaviors of merge algorithms when encountering two Arrays
   * that must be merged together.
   * - `clobber`: The left `Array` is ignored.
   * - `indexByIndex`: The result is achieved by recursively deep merging at
   *   each index. (not yet supported.)
   */
  ArrayStrategies: keyMirror({
    Clobber: true,
    IndexByIndex: true
  })

};

module.exports = mergeHelpers;

},{"./invariant":104,"./keyMirror":110,"__browserify_process":124}],115:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule mergeInto
 * @typechecks static-only
 */

"use strict";

var mergeHelpers = require("./mergeHelpers");

var checkMergeObjectArg = mergeHelpers.checkMergeObjectArg;

/**
 * Shallow merges two structures by mutating the first parameter.
 *
 * @param {object} one Object to be merged into.
 * @param {?object} two Optional object with properties to merge from.
 */
function mergeInto(one, two) {
  checkMergeObjectArg(one);
  if (two != null) {
    checkMergeObjectArg(two);
    for (var key in two) {
      if (!two.hasOwnProperty(key)) {
        continue;
      }
      one[key] = two[key];
    }
  }
}

module.exports = mergeInto;

},{"./mergeHelpers":114}],116:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule mixInto
 */

"use strict";

/**
 * Simply copies properties to the prototype.
 */
var mixInto = function(constructor, methodBag) {
  var methodName;
  for (methodName in methodBag) {
    if (!methodBag.hasOwnProperty(methodName)) {
      continue;
    }
    constructor.prototype[methodName] = methodBag[methodName];
  }
};

module.exports = mixInto;

},{}],117:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule mutateHTMLNodeWithMarkup
 * @typechecks static-only
 */

/*jslint evil: true */

'use strict';

var createNodesFromMarkup = require("./createNodesFromMarkup");
var filterAttributes = require("./filterAttributes");
var invariant = require("./invariant");

/**
 * You can't set the innerHTML of a document. Unless you have
 * this function.
 *
 * @param {DOMElement} node with tagName == 'html'
 * @param {string} markup markup string including <html>.
 */
function mutateHTMLNodeWithMarkup(node, markup) {
  ("production" !== process.env.NODE_ENV ? invariant(
    node.tagName.toLowerCase() === 'html',
    'mutateHTMLNodeWithMarkup(): node must have tagName of "html", got %s',
    node.tagName
  ) : invariant(node.tagName.toLowerCase() === 'html'));

  markup = markup.trim();
  ("production" !== process.env.NODE_ENV ? invariant(
    markup.toLowerCase().indexOf('<html') === 0,
    'mutateHTMLNodeWithMarkup(): markup must start with <html'
  ) : invariant(markup.toLowerCase().indexOf('<html') === 0));

  // First let's extract the various pieces of markup.
  var htmlOpenTagEnd = markup.indexOf('>') + 1;
  var htmlCloseTagStart = markup.lastIndexOf('<');
  var htmlOpenTag = markup.substring(0, htmlOpenTagEnd);
  var innerHTML = markup.substring(htmlOpenTagEnd, htmlCloseTagStart);

  // Now for the fun stuff. Pass through both sets of attributes and
  // bring them up-to-date. We get the new set by creating a markup
  // fragment.
  var shouldExtractAttributes = htmlOpenTag.indexOf(' ') > -1;
  var attributeHolder = null;

  if (shouldExtractAttributes) {
    // We extract the attributes by creating a <span> and evaluating
    // the node.
    attributeHolder = createNodesFromMarkup(
      htmlOpenTag.replace('html ', 'span ') + '</span>'
    )[0];

    // Add all attributes present in attributeHolder
    var attributesToSet = filterAttributes(
      attributeHolder,
      function(attr) {
        return node.getAttributeNS(attr.namespaceURI, attr.name) !== attr.value;
      }
    );
    attributesToSet.forEach(function(attr) {
      node.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    });
  }

  // Remove all attributes not present in attributeHolder
  var attributesToRemove = filterAttributes(
    node,
    function(attr) {
      // Remove all attributes if attributeHolder is null or if it does not have
      // the desired attribute.
      return !(
        attributeHolder &&
          attributeHolder.hasAttributeNS(attr.namespaceURI, attr.name)
      );
    }
  );
  attributesToRemove.forEach(function(attr) {
    node.removeAttributeNS(attr.namespaceURI, attr.name);
  });

  // Finally, set the inner HTML. No tricks needed. Do this last to
  // minimize likelihood of triggering reflows.
  node.innerHTML = innerHTML;
}

module.exports = mutateHTMLNodeWithMarkup;

},{"./createNodesFromMarkup":86,"./filterAttributes":92,"./invariant":104,"__browserify_process":124}],118:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule objMap
 */

"use strict";

/**
 * For each key/value pair, invokes callback func and constructs a resulting
 * object which contains, for every key in obj, values that are the result of
 * of invoking the function:
 *
 *   func(value, key, iteration)
 *
 * @param {?object} obj Object to map keys over
 * @param {function} func Invoked for each key/val pair.
 * @param {?*} context
 * @return {?object} Result of mapping or null if obj is falsey
 */
function objMap(obj, func, context) {
  if (!obj) {
    return null;
  }
  var i = 0;
  var ret = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      ret[key] = func.call(context, obj[key], key, i++);
    }
  }
  return ret;
}

module.exports = objMap;

},{}],119:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule objMapKeyVal
 */

"use strict";

/**
 * Behaves the same as `objMap` but invokes func with the key first, and value
 * second. Use `objMap` unless you need this special case.
 * Invokes func as:
 *
 *   func(key, value, iteration)
 *
 * @param {?object} obj Object to map keys over
 * @param {!function} func Invoked for each key/val pair.
 * @param {?*} context
 * @return {?object} Result of mapping or null if obj is falsey
 */
function objMapKeyVal(obj, func, context) {
  if (!obj) {
    return null;
  }
  var i = 0;
  var ret = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      ret[key] = func.call(context, key, obj[key], i++);
    }
  }
  return ret;
}

module.exports = objMapKeyVal;

},{}],120:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule performanceNow
 * @typechecks static-only
 */

"use strict";

var ExecutionEnvironment = require("./ExecutionEnvironment");

/**
 * Detect if we can use window.performance.now() and gracefully
 * fallback to Date.now() if it doesn't exist.
 * We need to support Firefox < 15 for now due to Facebook's webdriver
 * infrastructure.
 */
var performance = null;

if (ExecutionEnvironment.canUseDOM) {
  performance = window.performance || window.webkitPerformance;
}

if (!performance || !performance.now) {
  performance = Date;
}

var performanceNow = performance.now.bind(performance);

module.exports = performanceNow;

},{"./ExecutionEnvironment":26}],121:[function(require,module,exports){
/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule shallowEqual
 */

"use strict";

/**
 * Performs equality by iterating through keys on an object and returning
 * false when any key has values which are not strictly equal between
 * objA and objB. Returns true when the values of all keys are strictly equal.
 *
 * @return {boolean}
 */
function shallowEqual(objA, objB) {
  if (objA === objB) {
    return true;
  }
  var key;
  // Test for A's keys different from B.
  for (key in objA) {
    if (objA.hasOwnProperty(key) &&
        (!objB.hasOwnProperty(key) || objA[key] !== objB[key])) {
      return false;
    }
  }
  // Test for B'a keys missing from A.
  for (key in objB) {
    if (objB.hasOwnProperty(key) && !objA.hasOwnProperty(key)) {
      return false;
    }
  }
  return true;
}

module.exports = shallowEqual;

},{}],122:[function(require,module,exports){
var process=require("__browserify_process");/**
 * Copyright 2013 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @providesModule traverseAllChildren
 */

"use strict";

var ReactComponent = require("./ReactComponent");
var ReactTextComponent = require("./ReactTextComponent");

var invariant = require("./invariant");

/**
 * TODO: Test that:
 * 1. `mapChildren` transforms strings and numbers into `ReactTextComponent`.
 * 2. it('should fail when supplied duplicate key', function() {
 * 3. That a single child and an array with one item have the same key pattern.
 * });
 */

/**
 * @param {?*} children Children tree container.
 * @param {!string} nameSoFar Name of the key path so far.
 * @param {!number} indexSoFar Number of children encountered until this point.
 * @param {!function} callback Callback to invoke with each child found.
 * @param {?*} traverseContext Used to pass information throughout the traversal
 * process.
 * @return {!number} The number of children in this subtree.
 */
var traverseAllChildrenImpl =
  function(children, nameSoFar, indexSoFar, callback, traverseContext) {
    var subtreeCount = 0;  // Count of children found in the current subtree.
    if (Array.isArray(children)) {
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        var nextName = nameSoFar + ReactComponent.getKey(child, i);
        var nextIndex = indexSoFar + subtreeCount;
        subtreeCount += traverseAllChildrenImpl(
          child,
          nextName,
          nextIndex,
          callback,
          traverseContext
        );
      }
    } else {
      var type = typeof children;
      var isOnlyChild = nameSoFar === '';
      // If it's the only child, treat the name as if it was wrapped in an array
      // so that it's consistent if the number of children grows
      var storageName = isOnlyChild ?
        ReactComponent.getKey(children, 0):
        nameSoFar;
      if (children === null || children === undefined || type === 'boolean') {
        // All of the above are perceived as null.
        callback(traverseContext, null, storageName, indexSoFar);
        subtreeCount = 1;
      } else if (children.mountComponentIntoNode) {
        callback(traverseContext, children, storageName, indexSoFar);
        subtreeCount = 1;
      } else {
        if (type === 'object') {
          ("production" !== process.env.NODE_ENV ? invariant(
            !children || children.nodeType !== 1,
            'traverseAllChildren(...): Encountered an invalid child; DOM ' +
            'elements are not valid children of React components.'
          ) : invariant(!children || children.nodeType !== 1));
          for (var key in children) {
            if (children.hasOwnProperty(key)) {
              subtreeCount += traverseAllChildrenImpl(
                children[key],
                nameSoFar + '{' + key + '}',
                indexSoFar + subtreeCount,
                callback,
                traverseContext
              );
            }
          }
        } else if (type === 'string') {
          var normalizedText = new ReactTextComponent(children);
          callback(traverseContext, normalizedText, storageName, indexSoFar);
          subtreeCount += 1;
        } else if (type === 'number') {
          var normalizedNumber = new ReactTextComponent('' + children);
          callback(traverseContext, normalizedNumber, storageName, indexSoFar);
          subtreeCount += 1;
        }
      }
    }
    return subtreeCount;
  };

/**
 * Traverses children that are typically specified as `props.children`, but
 * might also be specified through attributes:
 *
 * - `traverseAllChildren(this.props.children, ...)`
 * - `traverseAllChildren(this.props.leftPanelChildren, ...)`
 *
 * The `traverseContext` is an optional argument that is passed through the
 * entire traversal. It can be used to store accumulations or anything else that
 * the callback might find relevant.
 *
 * @param {?*} children Children tree object.
 * @param {!function} callback To invoke upon traversing each child.
 * @param {?*} traverseContext Context for traversal.
 */
function traverseAllChildren(children, callback, traverseContext) {
  if (children !== null && children !== undefined) {
    traverseAllChildrenImpl(children, '', 0, callback, traverseContext);
  }
}

module.exports = traverseAllChildren;

},{"./ReactComponent":31,"./ReactTextComponent":66,"./invariant":104,"__browserify_process":124}],123:[function(require,module,exports){
var process=require("__browserify_process");module.exports = require('./lib/React');
if ('production' !== process.env.NODE_ENV) {
  module.exports = require('./ReactJSErrors').wrap(module.exports);
}

},{"./ReactJSErrors":6,"./lib/React":30,"__browserify_process":124}],124:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}]},{},[2])
;