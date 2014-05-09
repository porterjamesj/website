;(function() {

  // polyfills
  Number.range = function() {
    var start, end, step;
    var array = [];
    switch(arguments.length){
    case 0:
      throw new Error('range() expected at least 1 argument, got 0 - must be specified as [start,] stop[, step]');
      return array;
    case 1:
      start = 0;
      end = Math.floor(arguments[0]) - 1;
      step = 1;
      break;
    case 2:
    case 3:
    default:
      start = Math.floor(arguments[0]);
      end = Math.floor(arguments[1]) - 1;
      var s = arguments[2];
      if (typeof s === 'undefined'){
        s = 1;
      }
      step = Math.floor(s) || (function(){ throw new Error('range() step argument must not be zero'); })();
      break;
    }

    if (step > 0){
      for (var i = start; i <= end; i += step){
        array.push(i);
      }
    } else if (step < 0) {
      step = -step;
      if (start > end){
        for (var i = start; i > end + 1; i -= step){
          array.push(i);
        }
      }
    }
    return array;
  };

  Array.prototype.shuffle = function() {
    var result = [];
    while( this.length ) {
      var index = Math.floor( this.length * Math.random() );
      result.push( this[ index ] );
      this.splice(index, 1);
    }
    return result;
  };

  //constants
  var MEN_X = 300;
  var WOMEN_X = 600;
  var Y_LEVEL = 50;

  var NPEOPLE = 10;
  var NMEN = NPEOPLE;
  var NWOMEN = NPEOPLE;

  var men = new Array();
  var women = new Array();

  var sound = T("sin");

  //setup
  for(var i = 0; i < NMEN; i++) {
    men.push({"prefs": Number.range(0,NWOMEN).shuffle(),
              "index": i,
              "free": true,
              "proposed": new Array()});
  }

  for(var j = 0; j < NWOMEN; j++) {
    women.push({"prefs": Number.range(0,NMEN).shuffle(),
                "index": j,
                "free": true});
  }

  function mean(arr) {
    if (arr.length === 0) {
      return undefined;
    }
    var i,
    sum = 0,
    len = arr.length;
    for (i = 0; i < len; i++) {
      sum += arr[i];
    }
    return sum / len;
  }

  function happiness(person) {
    if (person.partner === undefined) {
      return undefined;
    }
    return (_.indexOf(person.prefs, person.partner.index) - NPEOPLE) / NPEOPLE;
  };

  function avgHappiness(people) {
    var happinesses = new Array();
    for (var i = 0; i < NPEOPLE; i++) {
      var person = people[i];
      var h = happiness(person);
      if (h !== undefined) {
        happinesses.push(h);
      }
    }
    return mean(happinesses);
  };


  // utils for gale shapely
  function isFree(person) {
    return person.free;
  };

  function engage(woman, man) {
    man.partner = woman;
    woman.partner = man;
    man.free = false;
    woman.free = false;
    window.paths[man.index][woman.index].show();
    var ah = avgHappiness(men);
    if (ah !== undefined) {
      sound.set({"freq": ah * 1700});
      sound.play();
    }
  }

  function disengage(woman) {
    paths[woman.partner.index][woman.index].hide();
    woman.partner.free = true;
    woman.partner.partner = undefined;
    woman.partner = undefined;
    woman.free = true;
  }

  function prefersToCurrentPartner(woman, man) {
    // determine if a woman prefers another man to her current parter
    for (var i = 0; i < NMEN; i++) {
      if (woman.prefs[i] == man.index) {
        return true;
      } else if (woman.prefs[i] == woman.partner.index) {
        return false;
      }
    }
    throw Error("something broken in prefersToCurrentPatner");
  };

  function galeShapely() {
    if(_.some(men,isFree) && _.find(men,isFree).proposed.length < NWOMEN ) {
      var m = _.find(men,isFree);
      var w = women[_.find(m.prefs,function (wind) {
        return !_.contains(m.proposed, wind);
      })];

      visualizeProposal(m, w);
    }
  };

  function proposalEffects(m, w) {
    m.proposed.push(w.index);
    if (isFree(w)) {
      engage(w,m);
    } else if (prefersToCurrentPartner(w,m)) {
      disengage(w);
      engage(w,m);
    }
    // chain again
    window.setTimeout(galeShapely, 500);
  };

  function glowOff(glows,m,w) {
    glows.hide();
    window.setTimeout(function () {proposalEffects(m,w);}, 500);
  };

  function visualizeProposal(m, w) {
    // do stuff
    var mg = m.circle.glow().show();
    var wg = w.circle.glow().show();
    var glows = window.paper.set(mg, wg);
    window.setTimeout(function () {glowOff(glows,m,w);}, 500);
  };

  function hideAll(paper) {
    for(var k = 0; k < NMEN; k++) {
      for(var l = 0; l < NWOMEN; l++) {
        window.paths[k][l].hide();
      }
    }
  }


  function drawEverything (paper) {
    // draw the circles
    for(var i = 0; i < NMEN; i++) {
      men[i].circle = paper.circle(MEN_X, 50 + i*Y_LEVEL, 10);
      men[i].circle.attr({"fill": "skyblue"});
    }
    for(var j = 0; j < NWOMEN; j++) {
      women[j].circle = paper.circle(WOMEN_X, 50 + j*Y_LEVEL, 10);
      women[j].circle.attr({"fill": "pink"});
    }

    // draw all the lines
    var paths = new Array();
    for(var k = 0; k < NMEN; k++) {
      paths.push(new Array());
      for(var l = 0; l < NWOMEN; l++) {
        var str = "M" + MEN_X + "," + (50+k*Y_LEVEL) + "L" + WOMEN_X + "," + (50+l*Y_LEVEL);
        paths[k].push(paper.path(str));
        paths[k][l].hide();
      }
    }
    return paths;
  };


  var go = function () {
    var paper = Raphael(50, 50, 1000, 1000);
    window.paper = paper;
    window.paths = drawEverything(paper);
    window.men = men;
    window.women = women;
    window.paper = paper;
    window.galeShapely = galeShapely;
    window.hideAll = hideAll;
    galeShapely();
  };


  window.onload = go;

})();
