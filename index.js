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
  var lastTouchTime = new Date(0);

  var lastPinchZoomLength

  var mousePos = {
    x: 0,
    y: 0
  }

  owner = owner || document.body;

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

    var from = { delta: 1 }
    var to = { delta: 2 }

    // This will animate from.x from 0 to 42 in 400ms, using cubic bezier easing
    // function (same effect as default CSS `ease` function)
    animate(from, to, {
      duration: 200,
      step: function(d) {
        var scaleMultiplier = getScaleMultiplier(-d.delta);
        zoomTo(tap.clientX, tap.clientY, scaleMultiplier)
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
  }

  function panByOffset(dx, dy) {
    var currentScale = getCurrentScale()

    camera.position.x -= dx/currentScale
    camera.position.y += dy/currentScale

    api.fire('change')
  }

  function onMouseWheel(e) {

    var scaleMultiplier = getScaleMultiplier(e.deltaY)

    smoothScroll.cancel()
    zoomTo(e.clientX, e.clientY, scaleMultiplier)
  }

  function zoomTo(clientX, clientY, scaleMultiplier) {
    var currentScale = getCurrentScale()

    var dx = (clientX - owner.clientWidth / 2) / currentScale
    var dy = (clientY - owner.clientHeight / 2) / currentScale

    var newZ = camera.position.z * scaleMultiplier
    if (newZ < api.min || newZ > api.max) {
      return
    }

    camera.position.z = newZ
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
