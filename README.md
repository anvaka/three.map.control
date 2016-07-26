# three.map.control

A three.js camera that mimics 2d maps navigation with pan and zoom

## Features

* **Touch friendly**. Drag scene around with single finger touch, or zoom it with standard
pinch gesture
* **Zoom into point**. Use your mouse wheel to zoom into particular point on the scene.
* **Easing**. When you pan around, the movement does not stop immediately. Smooth
kinetic panning gives natural feel to it.
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
```

# license

MIT
