/**
 * Allows smooth kinetic scrolling of the surface
 */
module.exports = kinetic;

var minVelocity = 10
var amplitude = 0.42

function kinetic(getPointCallback, scrollCallback) {
  var lastPoint = {x: 0, y: 0}
  var timestamp
  var timeConstant = 342

  var ticker
  var vx, targetX, ax;
  var vy, targetY, ay;

  var raf

  return {
    start: start,
    stop: stop,
    cancel: cancel
  }

  function cancel() {
    window.clearInterval(ticker)
    window.cancelAnimationFrame(raf)
  }

  function start() {
    setInternalLastPoint(getPointCallback())

    ax = ay = vx = vy = 0
    timestamp = new Date()

    window.clearInterval(ticker)
    window.cancelAnimationFrame(raf)

    ticker = window.setInterval(track, 100);
  }

  function track() {
    var now = Date.now();
    var elapsed = now - timestamp;
    timestamp = now;

    var point = getPointCallback()

    var dx = point.x - lastPoint.x
    var dy = point.y - lastPoint.y

    setInternalLastPoint(point);

    var dt = 1000 / (1 + elapsed)

    // moving average
    vx = 0.8 * dx * dt + 0.2 * vx
    vy = 0.8 * dy * dt + 0.2 * vy
  }

  function setInternalLastPoint(p) {
    lastPoint.x = p.x;
    lastPoint.y = p.y;
  }

  function stop() {
    window.clearInterval(ticker);
    window.cancelAnimationFrame(raf)

    var point = getPointCallback()

    targetX = point.x
    targetY = point.y
    timestamp = Date.now()

    if (vx < -minVelocity || vx > minVelocity) {
      ax = amplitude * vx
      targetX += ax
    }

    if (vy < -minVelocity || vy > minVelocity) {
      ay = amplitude * vy
      targetY += ay
    }

    raf = window.requestAnimationFrame(autoScroll);
  }

  function autoScroll() {
    var elapsed = Date.now() - timestamp

    var moving = false
    var dx = 0
    var dy = 0

    if (ax) {
      dx = -ax * Math.exp(-elapsed / timeConstant)

      if (dx > 0.5 || dx < -0.5) moving = true
      else dx = ax = 0
    }

    if (ay) {
      dy = -ay * Math.exp(-elapsed / timeConstant)

      if (dy > 0.5 || dy < -0.5) moving = true
      else dy = ay = 0
    }

    if (moving) {
      scrollCallback(targetX + dx, targetY + dy)
      raf = window.requestAnimationFrame(autoScroll);
    }
  }
}
