var wheel = require('wheel')
var eventify = require('ngraph.events')
var kinetic = require('./lib/kinetic.js')
var animate = require('amator');

module.exports = panzoom

/**
 * Creates a new input controller.
 *
 * @param {Object} camera - a three.js perspective camera object.
 * @param {DOMElement+} owner - owner that should listen to mouse/keyboard/tap
 * events. This is optional, and defaults to document.body.
 *
 * @returns {Object} api for the input controller. It currently supports only one
 * method `dispose()` which should be invoked when you want to to release input
 * controller and all events.
 *
 * Consumers can listen to api's events via `api.on('change', function() {})`
 * interface. The change event will be fire every time when camera's position changed.
 */
function panzoom(camera, owner) {
  var isDragging = false
  var panstartFired = false
  var touchInProgress = false
  var lastTouchTime = new Date(0)
  var smoothZoomAnimation, smoothPanAnimation;
  var panPayload = {
    dx: 0,
    dy: 0
  }
  var zoomPayload = {
    dx: 0,
    dy: 0,
    dz: 0
  }

  var lastPinchZoomLength

  var mousePos = {
    x: 0,
    y: 0
  }

  owner = owner || document.body;
  owner.setAttribute('tabindex', 1); // TODO: not sure if this is really polite

  var smoothScroll = kinetic(getCameraPosition, {
     scrollCallback: onSmoothScroll
  })

  wheel.addWheelListener(owner, onMouseWheel)

  var api = eventify({
    dispose: dispose,
    speed: 0.03,
    min: 0.0001,
    max: Number.POSITIVE_INFINITY
  })

  owner.addEventListener('mousedown', handleMouseDown)
  owner.addEventListener('touchstart', onTouch)
  owner.addEventListener('keydown', onKeyDown)

  return api;

  function onTouch(e) {
    var touchTime = new Date();
    var timeBetweenTaps = touchTime - lastTouchTime;
    lastTouchTime = touchTime;

    var touchesCount = e.touches.length;

    if (timeBetweenTaps < 400 && touchesCount === 1) {
      handleDoubleTap(e);
    } else if (touchesCount < 3) {
      handleTouch(e)
    }
  }

  function onKeyDown(e) {
    var x = 0, y = 0, z = 0
    if (e.keyCode === 38) {
      y = 1 // up
    } else if (e.keyCode === 40) {
      y = -1 // down
    } else if (e.keyCode === 37) {
      x = 1 // left
    } else if (e.keyCode === 39) {
      x = -1 // right
    } else if (e.keyCode === 189 || e.keyCode === 109) { // DASH or SUBTRACT
      z = 1 // `-` -  zoom out
    } else if (e.keyCode === 187 || e.keyCode === 107) { // EQUAL SIGN or ADD
      z = -1 // `=` - zoom in (equal sign on US layout is under `+`)
    }
    // TODO: Keypad keycodes are missing.

    if (x || y) {
      e.preventDefault()
      e.stopPropagation()
      smoothPanByOffset(5 * x, 5 * y)
    }

    if (z) {
      smoothZoom(owner.clientWidth/2, owner.clientHeight/2, z)
    }
  }

  function getPinchZoomLength(finger1, finger2) {
    return (finger1.clientX - finger2.clientX) * (finger1.clientX - finger2.clientX) +
      (finger1.clientY - finger2.clientY) * (finger1.clientY - finger2.clientY)
  }

  function handleTouch(e) {
    e.stopPropagation()
    e.preventDefault()

    setMousePos(e.touches[0])

    if (!touchInProgress) {
      touchInProgress = true
      window.addEventListener('touchmove', handleTouchMove)
      window.addEventListener('touchend', handleTouchEnd)
      window.addEventListener('touchcancel', handleTouchEnd)
    }
  }

  function handleDoubleTap(e) {
    e.stopPropagation()
    e.preventDefault()

    var tap = e.touches[0];

    smoothScroll.cancel();

    smoothZoom(tap.clientX, tap.clientY, -1);
  }

  function smoothPanByOffset(x, y) {
    if (smoothPanAnimation) {
      smoothPanAnimation.cancel();
    }

    var from = { x: x, y: y }
    var to = { x: 2 * x, y: 2 * y }
    smoothPanAnimation = animate(from, to, {
      easing: 'linear',
      duration: 200,
      step: function(d) {
        panByOffset(d.x, d.y)
      }
    })
  }

  function smoothZoom(x, y, scale) {
    var from = { delta: scale }
    var to = { delta: scale * 2 }
    if (smoothZoomAnimation) {
      smoothZoomAnimation.cancel();
    }

    smoothZoomAnimation = animate(from, to, {
      duration: 200,
      step: function(d) {
        var scaleMultiplier = getScaleMultiplier(d.delta);
        zoomTo(x, y, scaleMultiplier)
      }
    })
  }

  function handleTouchMove(e) {
    triggerPanStart()

    if (e.touches.length === 1) {
      e.stopPropagation()
      var touch = e.touches[0]

      var dx = touch.clientX - mousePos.x
      var dy = touch.clientY - mousePos.y

      setMousePos(touch)

      panByOffset(dx, dy)
    } else if (e.touches.length === 2) {
      // it's a zoom, let's find direction
      var t1 = e.touches[0]
      var t2 = e.touches[1]
      var currentPinchLength = getPinchZoomLength(t1, t2)

      var delta = 0
      if (currentPinchLength < lastPinchZoomLength) {
        delta = 1
      } else if (currentPinchLength > lastPinchZoomLength) {
        delta = -1
      }

      var scaleMultiplier = getScaleMultiplier(delta)

      setMousePosFromTwoTouches(e);

      zoomTo(mousePos.x, mousePos.y, scaleMultiplier)

      lastPinchZoomLength = currentPinchLength

      e.stopPropagation()
      e.preventDefault()
    }
  }

  function setMousePosFromTwoTouches(e) {
    var t1 = e.touches[0]
    var t2 = e.touches[1]
    mousePos.x = (t1.clientX + t2.clientX)/2
    mousePos.y = (t1.clientY + t2.clientY)/2
  }

  function handleTouchEnd(e) {
    if (e.touches.length > 0) {
      setMousePos(e.touches[0])
    } else {
      touchInProgress = false
      triggerPanEnd()
      disposeTouchEvents()
    }
  }

  function disposeTouchEvents() {
    window.removeEventListener('touchmove', handleTouchMove)
    window.removeEventListener('touchend', handleTouchEnd)
    window.removeEventListener('touchcancel', handleTouchEnd)
  }

  function getCameraPosition() {
    return camera.position
  }

  function onSmoothScroll(x, y) {
    camera.position.x = x
    camera.position.y = y

    api.fire('change')
  }

  function handleMouseDown(e) {
    isDragging = true
    setMousePos(e)

    window.addEventListener('mouseup', handleMouseUp, true)
    window.addEventListener('mousemove', handleMouseMove, true)
  }

  function handleMouseUp() {
    disposeWindowEvents()
    isDragging = false

    triggerPanEnd()
  }

  function setMousePos(e) {
    mousePos.x = e.clientX
    mousePos.y = e.clientY
  }

  function handleMouseMove(e) {
    if (!isDragging) return

    triggerPanStart()

    var dx = e.clientX - mousePos.x
    var dy = e.clientY - mousePos.y

    panByOffset(dx, dy)

    setMousePos(e)
  }

  function triggerPanStart() {
    if (!panstartFired) {
      api.fire('panstart')
      panstartFired = true
      smoothScroll.start()
    }
  }

  function triggerPanEnd() {
    if (panstartFired) {
      smoothScroll.stop()
      api.fire('panend')
      panstartFired = false
    }
  }

  function disposeWindowEvents() {
    window.removeEventListener('mouseup', handleMouseUp, true)
    window.removeEventListener('mousemove', handleMouseMove, true)
  }

  function dispose() {
    wheel.removeWheelListener(owner, onMouseWheel)
    disposeWindowEvents()
    disposeTouchEvents()

    smoothScroll.cancel()
    triggerPanEnd()

    owner.removeEventListener('mousedown', handleMouseDown)
    owner.removeEventListener('touchstart', onTouch)
    owner.removeEventListener('keydown', onKeyDown)
  }

  function panByOffset(dx, dy) {
    var currentScale = getCurrentScale()

    panPayload.dx = -dx/currentScale
    panPayload.dy = dy/currentScale

    // we fire first, so that clients can manipulate the payload
    api.fire('beforepan', panPayload)

    camera.position.x += panPayload.dx
    camera.position.y += panPayload.dy

    api.fire('change')
  }

  function onMouseWheel(e) {

    var scaleMultiplier = getScaleMultiplier(e.deltaY)

    smoothScroll.cancel()
    zoomTo(e.clientX, e.clientY, scaleMultiplier)
  }

  function zoomTo(offsetX, offsetY, scaleMultiplier) {
    var currentScale = getCurrentScale()

    var dx = (offsetX - owner.clientWidth / 2) / currentScale
    var dy = (offsetY - owner.clientHeight / 2) / currentScale

    var newZ = camera.position.z * scaleMultiplier
    if (newZ < api.min || newZ > api.max) {
      return
    }

    zoomPayload.dz = newZ - camera.position.z
    zoomPayload.dx = -(scaleMultiplier - 1) * dx
    zoomPayload.dy = (scaleMultiplier - 1) * dy

    api.fire('beforezoom', zoomPayload)

    camera.position.z += zoomPayload.dz
    camera.position.x -= (scaleMultiplier - 1) * dx
    camera.position.y += (scaleMultiplier - 1) * dy

    api.fire('change')
  }

  function getCurrentScale() {
    // TODO: This is the only code that depends on camera. Extract?
    var vFOV = camera.fov * Math.PI / 180
    var height = 2 * Math.tan( vFOV / 2 ) * camera.position.z
    var currentScale = owner.clientHeight / height

    return currentScale
  }

  function getScaleMultiplier(delta) {
    var scaleMultiplier = 1
    if (delta > 10) {
      delta = 10;
    } else if (delta < -10) {
      delta = -10;
    }
    scaleMultiplier = (1 + api.speed * delta)

    return scaleMultiplier
  }
}
