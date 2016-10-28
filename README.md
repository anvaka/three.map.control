# three.map.control

Mobile friendly three.js camera that mimics 2d maps navigation with pan and zoom.

[DEMO](https://anvaka.github.io/three.map.control/demo/)

## Features

* **Touch friendly**. Drag scene around with single finger touch, or zoom it with standard
pinch gesture.

![touch friendly](https://i.imgur.com/CL3inbB.gif)

* **Zoom into point**. Use your mouse wheel to zoom into particular point on the scene.
* **Easing**. When you pan around, the movement does not stop immediately. Smooth
kinetic panning gives natural feel to it.

![easing](https://i.imgur.com/PSbGYp1.gif)
* **Tiny**. It's less than `400` lines of documented code.

# usage

``` js
// let's say you have a standard THREE.js PerspectiveCamera:
var camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 3000 );

// To turn on a map-like navigation:
var createPanZoom = require('three.map.control');

// We assume that three.js scene is hosted inside DOM element `container`
var panZoom = createPanZoom(camera, container);

// That's it. panZoom wil now listen to events from `container`. You can pan and
// zoom with your mouse or fingers (on touch device)

// If you want to dispose three.js scene, make sure to call:
panZoom.dispose();
```

## events

A list of supported events:
`panstart`, `panning`, `panend`
`zoomstart`, `zoomend`

 js
// the panZoom api fires events when something happens,
// so that you can react to user actions:
panZoom.on('panstart', function() {
  // fired when users begins panning (dragging) the surface
  console.log('panstart fired');
});

panZoom.on('panend', function() {
  // fired when user stpos panning (dragging) the surface
  console.log('panend fired');
});

panZoom.on('panning', function(panPayload) {
  // fired when camera position will be changed.
  console.log('going to move camera.position.x by: ' + panPayload.dx);
  console.log('going to move camera.position.y by: ' + panPayload.dy);
});

panZoom.on('zoomstart', function(panPayload) {
  // fired when before zoom in/zoom out
  console.log('going to move camera.position.x by: ' + panPayload.dx);
  console.log('going to move camera.position.y by: ' + panPayload.dy);
  console.log('going to move camera.position.z by: ' + panPayload.dz);
});

panZoom.on('zoomend', function(e) {
  // fired when after zoom in/out
  console.log(e); // where 'e' is the original event including `deltaX`, `deltaY` etc.
});
```

# license

MIT
