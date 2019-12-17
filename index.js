/**
 * @module  pan-zoom
 *
 * Events for pan and zoom
 */
'use strict'


var Impetus = require('impetus')
var wheel = require('mouse-wheel')
var touchPinch = require('touch-pinch')
var position = require('touch-position')
var raf = require('raf')
var hasPassive = require('has-passive-events')


module.exports = panZoom

function panZoom (target, cb) {
	if (target instanceof Function) {
		cb = target
		target = document.documentElement || document.body
	}

	if (typeof target === 'string') target = document.querySelector(target)

	//enable panning
	var touch = position.emitter({
		element: target,
		// Default value before the any mouse/touch events are triggered. We set
		// // this so we can discern one specific scenario when processing wheel
		// // events. Otherwise if we don't set this the default value will be
		// [0,0].
		position: [undefined, undefined]
	})

	var impetus

	var initX = 0, initY = 0, init = true, srcElement
	var initFn = function (e) { init = true, srcElement = e.srcElement }
	target.addEventListener('mousedown', initFn)
	target.addEventListener('touchstart', initFn, hasPassive ? { passive: true } : false)


	var lastY = 0, lastX = 0
	impetus = new Impetus({
		source: target,
		update: function (x, y, ...args) {

			if (init) {
				init = false
				initX = touch.position[0]
				initY = touch.position[1]
				lastX = x
				lastY = y
			}

			var e = {
				srcElement,
				target: target,
				type: 'mouse',
				dx: x - lastX, dy: y - lastY, dz: 0,
				x: touch.position[0], y: touch.position[1],
				x0: initX, y0: initY
			}

			lastX = x
			lastY = y

			schedule(e)
		},
		multiplier: 1,
		friction: .75
	})

	var isPassive = [window, document, document.documentElement, document.body].indexOf(target) >= 0

	//enable zooming
	var wheelListener = wheel(target, function (dx, dy, dz, e) {
		if (!isPassive) e.preventDefault()

		let x = touch.position[0]
		let y = touch.position[1]

		// For the very first wheel event, if the user hasn't made a mouse move
		// or anything, then touch.position will be [undefined, undefined]. This
		// is because the touch-position library only changes the default
		// position once a mouse or touch event has happened. To work around
		// this case here, we manually compute the current pointer location
		// based off the incoming WheelEvent.
		if (x === undefined || y === undefined) {
			var boundingRect = target.getBoundingClientRect();
			x = e.clientX - boundingRect.left;
			y = e.clientY - boundingRect.top;
		}

		schedule({
			srcElement: e.srcElement,
			target: target,
			type: 'mouse',
			dx: 0, dy: 0, dz: dy,
			x: x, y: y,
			x0: x, y0: y
		})
	})

	// Making pinch and other gestures work on Mobile and Desktop Safari

	// Im not sure what the deal is but for Safari both desktop and mobile we
	// have to preventDefault() these gesture events. Note that for desktop
	// Safari the touch-pinch library doesn't handle pinching and zooming (it
	// does seem to work for mobile safari though). It does seem to work on
	// mobile Safari though (if we suppress these events).
	var hasTouchEvents = typeof Touch !== 'undefined'; // Note that this will be true for Desktop Chrome too, which is sad
	var safariGestureEventHandlingState;
	function handleGestureStartForSafari(e) {
		e.preventDefault();

		if (hasTouchEvents) {
			// No need to do anything else, the touch-pinch library will handle
			// the punch by listening to the touch events
			return;
		}
		
		safariGestureEventHandlingState = { 
			startX: e.pageX,
			startY: e.pageY,
			scale: e.scale,
		}
	}
	function handleGestureChangeForSafari(e) {
		e.preventDefault();

		if (hasTouchEvents) {
			// No need to do anything else, the touch-pinch library will handle
			// the punch by listening to the touch events
			return;
		}

		var scaleDiff = safariGestureEventHandlingState.scale - e.scale;
		safariGestureEventHandlingState.scale = e.scale;

		var dz = scaleDiff * 100; // 100 seems to make this feel good
		var x = safariGestureEventHandlingState.startX;
		var y = safariGestureEventHandlingState.startY;

		schedule({
			srcElement: target,
			target: e.target,
			type: 'mouse', // Since we are only firing this on desktop Safari...
			dx: 0, dy: 0, dz: dz,
			x: x, y: y,
			x0: x, y0: y
		})
	}
	function handleGestureEndForSafari(e) {
		e.preventDefault();
	}
	if (navigator.vendor.match(/Apple/)) {
		target.addEventListener('gesturestart', handleGestureStartForSafari);
		target.addEventListener('gesturechange', handleGestureChangeForSafari);
		target.addEventListener('gestureend', handleGestureEndForSafari);
	}

	// Fixing gesture jankyness on mobile Chrome
	function handleTouchStartForMobileChrome(e) {
		if (e.touches.length === 2) {
			e.preventDefault()
		}
	}
	function handleTouchMoveForMobileChrome(e) {
		if (e.touches.length === 2) {
			e.preventDefault()
		}
	}
	function handleTouchEndForMobileChrome(e) {
		if (e.touches.length === 2) {
			e.preventDefault()
		}
	}
	if (hasTouchEvents && navigator.vendor.match(/Google Inc/)) {
		target.addEventListener('touchstart', handleTouchStartForMobileChrome);
		target.addEventListener('touchmove', handleTouchMoveForMobileChrome);
		target.addEventListener('touchend', handleTouchEndForMobileChrome);
	}

	//mobile pinch zoom
	// Note that for mobile Safari we have to preventDefault the gesture events (we do that right above here)
	var pinch = touchPinch(target)
	var mult = 2
	var lastPinchCoords

	function getPinchCoords() {
		var f1 = pinch.fingers[0];
		var f2 = pinch.fingers[1];

		return [
			f2.position[0] * .5 + f1.position[0] * .5,
			f2.position[1] * .5 + f1.position[1] * .5
		];
	}

	pinch.on('start', function (curr) {
		lastPinchCoords = getPinchCoords();
		impetus && impetus.pause()
	})
	pinch.on('end', function () {
		if (!lastPinchCoords) return

		lastPinchCoords = null
		impetus && impetus.resume()
	})
	pinch.on('change', function (curr, prev) {
		if (!pinch.pinching || !lastPinchCoords) return

		var newCoords = getPinchCoords();
		var dx = newCoords[0] - lastPinchCoords[0];
		var dy = newCoords[1] - lastPinchCoords[1];

		lastPinchCoords = newCoords;


		schedule({
			srcElement: target,
			target: target,
			type: 'touch',
			dx: dx, dy: dy, dz: -(curr - prev) * mult,
			x: newCoords[0], y: newCoords[1],
			x0: newCoords[0], y0: newCoords[0]
		})
	})


	// schedule function to current or next frame
	var planned, frameId
	function schedule (ev) {
		if (frameId != null) {
			if (!planned) planned = ev
			else {
				planned.dx += ev.dx
				planned.dy += ev.dy
				planned.dz += ev.dz

				planned.x = ev.x
				planned.y = ev.y
			}

			return
		}

		// Firefox sometimes does not clear webgl current drawing buffer
		// so we have to schedule callback to the next frame, not the current
		// cb(ev)

		frameId = raf(function () {
			cb(ev)
			frameId = null
			if (planned) {
				var arg = planned
				planned = null
				schedule(arg)
			}
		})
	}

	function destroy () {
		touch.dispose()

		target.removeEventListener('mousedown', initFn)
		target.removeEventListener('touchstart', initFn)

		impetus.destroy()

		target.removeEventListener('wheel', wheelListener)

		if (navigator.vendor.match(/Apple/)) {
			target.removeEventListener('gesturestart', handleGestureStartForSafari);
			target.removeEventListener('gesturechange', handleGestureChangeForSafari);
			target.removeEventListener('gestureend', handleGestureEndForSafari);
		}
		if (hasTouchEvents && navigator.vendor.match(/Google Inc/)) {
			target.removeEventListener('touchstart', handleTouchStartForMobileChrome);
			target.removeEventListener('touchmove', handleTouchMoveForMobileChrome);
			target.removeEventListener('touchend', handleTouchEndForMobileChrome);
		}

		pinch.disable()

		raf.cancel(frameId)
	}
	function pausePanning () {
		impetus && impetus.pause();
	}
	function resumePanning() {
		impetus && impetus.resume();
	}


	return {
		destroy,
		pausePanning,
		resumePanning,
	};
}
