/**
 * @module  pan-zoom
 *
 * Events for pan and zoom
 */
"use strict";

var Impetus = require("impetus");
var wheel = require("mouse-wheel");
var touchPinch = require("touch-pinch");
var position = require("touch-position");
var raf = require("raf");
var hasPassive = require("has-passive-events");

module.exports = panZoom;

function panZoom(target, cb) {
  if (target instanceof Function) {
    cb = target;
    target = document.documentElement || document.body;
  }

  if (typeof target === "string") target = document.querySelector(target);

  //enable panning
  var touch = position.emitter({
    element: target,
    // Default value before the any mouse/touch events are triggered. We set
    // this so we can discern one specific scenario when processing wheel
    // events. Otherwise if we don't set this the default value will be [0,0].
    position: [undefined, undefined]
  });

  var impetus;

  var initX = 0,
    initY = 0,
    init = true,
    srcElement;
  var ignoreCurrentPan = false;
  var initFn = function(e) {
    (init = true), (srcElement = e.srcElement), (ignoreCurrentPan = false);
  };
  target.addEventListener("mousedown", initFn);
  target.addEventListener(
    "touchstart",
    initFn,
    hasPassive ? { passive: true } : false
  );

  function blockPan() {
    ignoreCurrentPan = true;
  }
  function unblockPan(ignore) {
    ignoreCurrentPan = false;
    // !ignore
    init = true;
  }

  var lastY = 0,
    lastX = 0;
  impetus = new Impetus({
    source: target,
    update: function(x, y, ...args) {
      if (ignoreCurrentPan) {
        return;
      }

      if (init) {
        init = false;
        initX = touch.position[0];
        initY = touch.position[1];
        lastX = x;
        lastY = y;
        // console.log({ initX, initY, lastX, lastY});
      }

      var e = {
        srcElement,
        target: target,
        type: "mouse",
        dx: x - lastX,
        dy: y - lastY,
        dz: 0,
        x: touch.position[0],
        y: touch.position[1],
        x0: initX,
        y0: initY
      };

      lastX = x;
      lastY = y;

      schedule(e);
    },
    multiplier: 1,
    friction: 0.75
  });

  var isPassive =
    [window, document, document.documentElement, document.body].indexOf(
      target
    ) >= 0;

  //enable zooming
  var wheelListener = wheel(target, function(dx, dy, dz, e) {
    if (!isPassive) e.preventDefault();

    let x = touch.position[0];
    let y = touch.position[1];

    // For the very first wheel event, if the user hasn't made a mouse move
    // or anything, then touch.position will be [undefined, undefined]. This
    // is because the touch-position library only changes the default
    // position once a mouse or touch event has happened. To work around
    // this case here, we manually compute the current pointer location
    // based off the incoming WheelEvent.
    if (x === undefined || y === undefined) {
      const boundingRect = target.getBoundingClientRect();
      x = e.clientX - boundingRect.left;
			y = e.clientY - boundingRect.top;
		}

    schedule({
      srcElement: e.srcElement,
      target: target,
      type: "mouse",
      dx: 0,
      dy: 0,
      dz: dy,
      x,
      y,
      x0: x,
      y0: y
    });
  });

  //mobile pinch zoom
  var pinch = touchPinch(target);
  var mult = 2;
  var initialCoords;

  pinch.on("start", function(curr) {
    var f1 = pinch.fingers[0];
    var f2 = pinch.fingers[1];

    initialCoords = [
      f2.position[0] * 0.5 + f1.position[0] * 0.5,
      f2.position[1] * 0.5 + f1.position[1] * 0.5
    ];

    impetus && impetus.pause();
  });
  pinch.on("end", function() {
    if (!initialCoords) return;

    initialCoords = null;

    impetus && impetus.resume();
  });
  pinch.on("change", function(curr, prev) {
    if (!pinch.pinching || !initialCoords) return;

    schedule({
      srcElement: target,
      target: target,
      type: "touch",
      dx: 0,
      dy: 0,
      dz: -(curr - prev) * mult,
      x: initialCoords[0],
      y: initialCoords[1],
      x0: initialCoords[0],
      y0: initialCoords[0]
    });
  });

  // schedule function to current or next frame
  var planned, frameId;
  function schedule(ev) {
    if (frameId != null) {
      if (!planned) planned = ev;
      else {
        planned.dx += ev.dx;
        planned.dy += ev.dy;
        planned.dz += ev.dz;

        planned.x = ev.x;
        planned.y = ev.y;
      }

      return;
    }

    // Firefox sometimes does not clear webgl current drawing buffer
    // so we have to schedule callback to the next frame, not the current
    // cb(ev)

    frameId = raf(function() {
      cb(ev);
      frameId = null;
      if (planned) {
        var arg = planned;
        planned = null;
        schedule(arg);
      }
    });
  }

  function destroy() {
    touch.dispose();

    target.removeEventListener("mousedown", initFn);
    target.removeEventListener("touchstart", initFn);

    impetus.destroy();

    target.removeEventListener("wheel", wheelListener);

    pinch.disable();

    raf.cancel(frameId);
  }

  return {
    destroy,
    blockPan,
    unblockPan
  };
}
