/*!
 * classie - class helper functions
 * from bonzo https://github.com/ded/bonzo
 * 
 * classie.has( elem, 'my-class' ) -> true/false
 * classie.add( elem, 'my-new-class' )
 * classie.remove( elem, 'my-unwanted-class' )
 * classie.toggle( elem, 'my-class' )
 */

/*jshint browser: true, strict: true, undef: true */

( function( window ) {

'use strict';

// class helper functions from bonzo https://github.com/ded/bonzo

function classReg( className ) {
  return new RegExp("(^|\\s+)" + className + "(\\s+|$)");
}

// classList support for class management
// altho to be fair, the api sucks because it won't accept multiple classes at once
var hasClass, addClass, removeClass;

// 支持HTML5 classList API;
if ( 'classList' in document.documentElement ) {
  hasClass = function( elem, c ) {
    return elem.classList.contains( c );
  };
  addClass = function( elem, c ) {
    elem.classList.add( c );
  };
  removeClass = function( elem, c ) {
    elem.classList.remove( c );
  };
}
// 不支持HTML5 classList API，通过className操作;
else {
  hasClass = function( elem, c ) {
    return classReg( c ).test( elem.className );
  };
  addClass = function( elem, c ) {
    if ( !hasClass( elem, c ) ) {
      elem.className = elem.className + ' ' + c;
    }
  };
  removeClass = function( elem, c ) {
    elem.className = elem.className.replace( classReg( c ), ' ' );
  };
}

function toggleClass( elem, c ) {
  var fn = hasClass( elem, c ) ? removeClass : addClass;
  fn( elem, c );
}

function each(array, fn, opt_scope, opt_reverse) {
  var index, i = 0, length = array.length;
  for (; i < length; i++) {
    index = opt_reverse ? array.length - i - 1 : i;
    fn.call(opt_scope || array[index], array[index], index, array);
  }
  return array;
}

window.classie = {
  // full names
  hasClass: hasClass,
  addClass: addClass,
  removeClass: removeClass,
  toggleClass: toggleClass,
  each: each,
  // short names
  toggle: toggleClass,
};

function addHandler(el, type, handler) {
  if (el.addEventListener) {
    el.addEventListener(type, handler, false);
  } else if (el.attachEvent) {
    el.attachEvent('on'+type, handler);
  } else {
    el['on'+type] = handler;
  }
}

function getEvent(event) {
  return event ? event : window.event;
}

function getTarget(event) {
  return event.target || event.srcElement;
}

function preventDefault(event) {
  if (event.preventDefault) {
    event.preventDefault();
  } else {
    event.returnValue = false;
  }
}
function removeHandler(el, type, handler) {
  if (el.removeEventListener) {
    el.removeEventListener(type, handler, false);
  } else if (el.detachEvent) {
    el.detachEvent('on'+type, handler);
  } else {
    el['on'+type] = null;
  }
}
function stopPropagation(event) {
  if (event.stopPropagation) {
    event.stopPropagation();
  } else {
    event.cancleBubble = true;
  }
}
function getCharCode(event) {
  if (typeof event.charCode == 'number') {
    return event.charCode;
  } else {
    return event.keycode;
  }
}
function throttle(fn, delay) {
  var timer = null;
  return function () {
    var context = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, delay);
  };
}
window.EventUtil = {
  addHandler: addHandler,
  getEvent: getEvent,
  getTarget: getTarget,
  preventDefault: preventDefault,
  removeHandler: removeHandler,
  stopPropagation: stopPropagation,
  getCharCode: getCharCode,
  throttle: throttle
};

})( window );


