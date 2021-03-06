var vrDisplay;
var vrControls;
var arView;

var canvas;
var camera;
var scene;
var renderer;
var snowman;
var snowGeometry;
var snowParticles;
var isSnowmanRotating = false;
var isSnowShowing = false;
var raycaster = new THREE.Raycaster();

var songElement = document.getElementById('song');

/**
 * Use the `getARDisplay()` utility to leverage the WebVR API to see if there are any AR-capable WebVR VRDisplays.
 * Returns a valid display if found. Otherwise, display the unsupported browser message.
 */
THREE.ARUtils.getARDisplay().then(function (display) {
  if (display) {
    vrDisplay = display;
    init();
  } else {
    console.warn('Unsupported');
    THREE.ARUtils.displayUnsupportedMessage();
  }
});

function init() {

  console.log('Initialise');

  // Turn on the debugging panel
  //var arDebug = new THREE.ARDebug(vrDisplay);
  //document.body.appendChild(arDebug.getElement());

  // Setup the three.js rendering environment
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.autoClear = false;
  canvas = renderer.domElement;
  document.body.appendChild(canvas);
  scene = new THREE.Scene();

  // Creating the ARView, the object that handles the rendering of the camera stream behind the three.js scene
  arView = new THREE.ARView(vrDisplay, renderer);

  // The ARPerspectiveCamera is very similar to THREE.PerspectiveCamera, except when using an AR-capable browser, the
  // camera uses the projection matrix provided from the device, so that the perspective camera's depth planes and
  // field of view matches the physical camera on the device.
  camera = new THREE.ARPerspectiveCamera(
    vrDisplay,
    60,
    window.innerWidth / window.innerHeight,
    vrDisplay.depthNear,
    vrDisplay.depthFar
  );

  // VRControls is a utility from three.js that applies the device's orientation/position to the perspective camera,
  // keeping our real world and virtual world in sync.
  vrControls = new THREE.VRControls(camera);

  // Create the snowman and add it to the scene. Set the position far away so that it won't appear visible until the
  // first hit is found, and move it there
  var loader = new THREE.ObjectLoader();
  loader.load('models/snowman/threejs/snowman.json', function (object) {

    console.log('Loaded snowman model', object);

    snowman = object;

    // Scale to a more sensible size
    snowman.scale.set(0.3, 0.3, 0.3);

    // Place the snowman very far away to begin with
    snowman.position.set(10000, 10000, 10000);

    snowman.rotation.set(0, Math.PI / 2, 0);

    scene.add(snowman);

    // Bind our event handlers
    window.addEventListener('resize', onWindowResize, false);
    canvas.addEventListener('touchstart', onClick, false);

    update();

  });

  initSnow();
}

/**
 * Based on: https://threejs.org/examples/?q=points#webgl_points_random
 */
function initSnow() {

  snowGeometry = new THREE.Geometry();
  for ( var i = 0; i < 5000; i ++ ) {
    var vertex = new THREE.Vector3();
    vertex.x = Math.random() * 1000 - 500;
    vertex.y = Math.random() * 1000 - 500;
    vertex.z = Math.random() * 1000 - 500;
    snowGeometry.vertices.push( vertex );
  }
  var material = new THREE.PointsMaterial( {
      color: 0xFFFFFF,
      size: 5,
      map: THREE.ImageUtils.loadTexture('images/snow-particle.png'),
      blending: THREE.AdditiveBlending,
      transparent: true
    });
  snowParticles = new THREE.Points( snowGeometry, material );

}

function rotateSnowman() {
  isSnowmanRotating = true;
}

function showSnow() {
  scene.add( snowParticles );
  isSnowShowing = true;
}

function playSong() {
  var playPromise = songElement.play();

  if (playPromise !== undefined) {
    playPromise.then(function() {
      console.log('Audio should be playing');
    }).catch(function(error) {
      console.warn('Browser refused to play audio', error);
    });
  }
}


/**
 * The render loop, called once per frame. Handles updating our scene and rendering.
 */
function update() {
  // Clears color from the frame before rendering the camera (arView) or scene.
  renderer.clearColor();

  // Render the camera stream on screen first. It allows us to get the right pose synchronized with the right frame.
  arView.render();

  // Update our camera projection matrix in the event that the near or far planes have updated
  //camera.updateProjectionMatrix();

  // Update our perspective camera's positioning
  vrControls.update();

  // Kick off the requestAnimationFrame to call this function when a new VRDisplay frame is rendered
  vrDisplay.requestAnimationFrame(update);

  if (isSnowShowing) {
    // Update snow
    var numVertices = snowGeometry.vertices.length;
    for ( var i = 0; i < numVertices; i ++ ) {
      var snowParticle = snowGeometry.vertices[i];
      // Some small, random lateral movement
      snowParticle.x += (0.1 - Math.random() / 10);
      // Move downwards, slightly randomly
      snowParticle.y -= Math.min(0.5, Math.random() * 2);
      if (snowParticle.y < -500) {
        snowParticle.y = 500;
      }
    }
    snowGeometry.verticesNeedUpdate = true;
  }

  if (isSnowmanRotating) {
    snowman.rotation.y += 0.04;
  }

  // Render our three.js virtual scene
  renderer.clearDepth();
  renderer.render(scene, camera);

}

/**
 * On window resize, update the perspective camera's aspect ratio, and call `updateProjectionMatrix` so that we can get
 * the latest projection matrix provided from the device
 */
function onWindowResize () {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * When clicking on screen, fire a ray from where user clicked and if a hit is found, place snowman there.
 */
function onClick (e) {

  // If we don't have a touches object, abort
  if (!e.touches[0]) {
    return;
  }

  // Inspect the event object and generate normalized screen coordinates (between 0 and 1) for the screen position.
  var x = e.touches[0].pageX;
  var y = e.touches[0].pageY;

  if ( hitTestSnowman(x, y) ) {

    onClickSnowman();

  } else {

    var hit = hitTestSurface(x, y);

    if (hit) {
      // Use the `placeObjectAtHit` utility to position the snowman where the hit occurred
      THREE.ARUtils.placeObjectAtHit(snowman,  // The object to place
        hit,   // The VRHit object to move the snowman to
        1,     // Easing value from 0 to 1; we want to move the snowman directly to the hit position
        true); // Whether or not we also apply orientation

      // TODO face the user - but lookAt is messing up orientation other than just y rotation
      //snowman.lookAt(camera.position);
      snowman.rotation.y += Math.PI / 2;
    }

  }
}

function onClickSnowman() {
  showSnow();
  playSong();
  rotateSnowman();
}

function hitTestSnowman(x, y) {

  // We need to transform x and y into being between -1 and 1
  var normalisedX =  ((2 * x) / window.innerWidth) - 1;
  var normalisedY =  ((-2 * y) / window.innerHeight) + 1;

  raycaster.setFromCamera( {x: normalisedX, y: normalisedY}, camera );

  var hits = raycaster.intersectObjects([snowman], true);

  // TEMP draw debug arrow
  //var arrow = new THREE.ArrowHelper( new THREE.Vector3().copy(raycaster.ray.direction), camera.getWorldPosition().clone(), 100, Math.random() * 0xffffff );
  //scene.add( arrow );

  return (hits && hits.length) ? hits[0] : null;

}

function hitTestSurface(x, y) {

  // We need to transform x and y into being between 0 and 1

  var normalisedX = x / window.innerWidth;
  var normalisedY = y / window.innerHeight;

  // Send a ray from point of click to real world surface and attempt to find a hit. Returns an array of potential hits.
  var hits = vrDisplay.hitTest(normalisedX, normalisedY);

  // If a hit is found, just use the first one
  return (hits && hits.length) ? hits[0] : null;

}
