import * as THREE from "../assets/vendor/three.module.js";
import { cameraProgress, journeyScrollDistance } from "./camera-progress.js?v=2";
import { Water } from "../assets/vendor/Water.js";
import { advancePanorama, panoramaAngle } from "./panorama.js";
import { addVegetation, habitat } from "./vegetation.js?v=4";

const $ = (s) => document.querySelector(s);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let autoplayTarget = null;
let automatic = false,
  position = 0,
  journeyStarted = Boolean(location.hash && location.hash !== "#home");
let panoramaPaused = reduced,
  panoramaElapsed = 0;
let summitCaptionElapsed = 0;
let summitReady = false,
  panTarget = 0,
  panOffset = 0;
const play = $("#play");
const soundToggle = $("#sound-toggle");
const restartJourney = $("#restart-journey");
let controlState = "";
function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}
function updateJourneyControl() {
  let label, aria;
  const nextState = [
    journeyStarted,
    summitReady,
    panoramaPaused,
    automatic,
  ].join(":");
  if (nextState === controlState) return;
  controlState = nextState;
  soundToggle.hidden = !journeyStarted;
  restartJourney.hidden = !journeyStarted;
  play.classList.toggle("start-journey", !journeyStarted);
  if (summitReady) {
    if (panoramaPaused) {
      label = "▷ <span>Resume panorama</span>";
      aria = "Resume the summit panorama";
    } else {
      label = "Ⅱ <span>Pause panorama</span>";
      aria = "Pause the summit panorama";
    }
  } else if (automatic) {
    label = "Ⅱ <span>Pause journey</span>";
    aria = "Pause automatic journey";
  } else if (journeyStarted) {
    label = "▷ <span>Resume journey</span>";
    aria = "Resume automatic journey";
  } else {
    label = "▷ <span>Start the journey</span>";
    aria = "Start the journey with background music";
  }
  if (play.innerHTML !== label) play.innerHTML = label;
  play.setAttribute("aria-label", aria);
}
function stopPlayback() {
  autoplayTarget = null;
  automatic = false;
  updateJourneyControl();
}
play.onclick = () => {
  autoplayTarget = null;
  if (!journeyStarted) {
    journeyStarted = true;
    document.dispatchEvent(new Event("journey:start"));
    automatic = true;
  } else if (summitReady) {
    panoramaPaused = !panoramaPaused;
  } else {
    automatic = !automatic;
    if (
      automatic &&
      scrollY >= document.documentElement.scrollHeight - innerHeight - 5
    )
      window.scrollTo({ top: 0, behavior: "instant" });
  }
  updateJourneyControl();
};
let restarting = false;
restartJourney.onclick = async () => {
  if (restarting) return;
  restarting = true;
  autoplayTarget = null;
  automatic = false;
  const fade = $("#restart-fade");
  let cover, reveal;
  restartJourney.disabled = play.disabled = true;
  fade.classList.add("active");
  try {
    if (!reduced) {
      cover = fade.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 160,
        easing: "ease-in-out",
        fill: "forwards",
      });
      await cover.finished;
    }
    position = 0;
    summitCaptionElapsed = 0;
    panoramaElapsed = 0;
    panTarget = 0;
    panOffset = 0;
    summitReady = false;
    panoramaPaused = reduced;
    journeyStarted = true;
    window.scrollTo({ top: 0, behavior: "instant" });
    // Keep the playing soundtrack and its mute preference untouched.
    if (!reduced) {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      reveal = fade.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 300,
        easing: "ease-in-out",
        fill: "forwards",
      });
      cover.cancel();
      await reveal.finished;
    }
    automatic = true;
  } finally {
    cover?.cancel();
    reveal?.cancel();
    fade.classList.remove("active");
    restartJourney.disabled = play.disabled = false;
    restarting = false;
    updateJourneyControl();
  }
};
function noteJourneyInput(event) {
  // Activating a footer control is not a request to take over page scrolling.
  // Let each control handle its own action (including the pause button).
  const control = event.target?.closest?.(
    "#sound-toggle, #play, #restart-journey",
  );
  if (control && ["pointerdown", "touchstart", "keydown"].includes(event.type))
    return;
  stopPlayback();
  if (!journeyStarted)
    requestAnimationFrame(() => {
      if (scrollY > 0) {
        journeyStarted = true;
        updateJourneyControl();
      }
    });
}
for (const event of [
  "wheel",
  "touchstart",
  "touchmove",
  "keydown",
  "pointerdown",
])
  addEventListener(event, noteJourneyInput, { passive: true });
document.querySelectorAll('a[href^="#"]').forEach((link) =>
  link.addEventListener("click", () => {
    if (link.hash !== "#home") {
      journeyStarted = true;
      updateJourneyControl();
    }
  }),
);
// Only sideways gestures at the summit take over the camera. Vertical input
// remains native page scrolling, and pinch-to-zoom remains a browser gesture.
addEventListener(
  "wheel",
  (event) => {
    if (!summitReady || event.ctrlKey || document.querySelector("dialog[open]"))
      return;
    const horizontal =
      event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
    if (
      !horizontal ||
      (!event.shiftKey && Math.abs(horizontal) <= Math.abs(event.deltaY))
    )
      return;
    event.preventDefault();
    const unit =
      event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerWidth : 1;
    panTarget += horizontal * unit * 0.002;
    panoramaPaused = true;
  },
  { passive: false },
);
$("#back-top").onclick = () => {
  stopPlayback();
  window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
};
for (const [trigger, modal] of [["#about-button", "#about"]]) {
  $(trigger).onclick = () => {
    stopPlayback();
    $(modal).showModal();
  };
  $(modal).querySelector(".close").onclick = () => $(modal).close();
  $(modal).onclick = (e) => {
    if (e.target === $(modal)) {
      const r = e.target.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        e.target.close();
    }
  };
}

// An imagined landscape: deliberately sculpted, with no geographic claim.
function hash(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise(x, z) {
  const a = Math.floor(x),
    b = Math.floor(z);
  let u = x - a,
    v = z - b;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(a, b), hash(a + 1, b), u),
    THREE.MathUtils.lerp(hash(a, b + 1), hash(a + 1, b + 1), u),
    v,
  );
}
function fbm(x, z) {
  let value = 0,
    amplitude = 0.5;
  for (let i = 0; i < 5; i++) {
    value += noise(x, z) * amplitude;
    x = x * 2.03 + 13.7;
    z = z * 2.03 + 7.3;
    amplitude *= 0.5;
  }
  return value;
}
async function start() {
  document.body.classList.remove("no-webgl");
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $("#world").append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xc49aa2, 0.00014);
  // The route stays at least 38 units above the terrain. A 10-unit near
  // plane preserves depth precision at distant shorelines during the orbit.
  const camera = new THREE.PerspectiveCamera(
    54,
    innerWidth / innerHeight,
    10,
    160000,
  );
  scene.add(new THREE.HemisphereLight(0xbacff1, 0x203c49, 1.35));
  const sunDirection = new THREE.Vector3(0.16, 0.24, -1).normalize();
  const sun = new THREE.DirectionalLight(0xffc397, 3.4);
  sun.position.copy(sunDirection).multiplyScalar(10000);
  sun.target.position.set(0, 0, -2800);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -9000,
    right: 9000,
    top: 9000,
    bottom: -9000,
    near: 100,
    far: 30000,
  });
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 2.5;
  scene.add(sun, sun.target);
  const clock = { value: 0 };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(80000, 40, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uTime: clock, sunDirection: { value: sunDirection } },
      vertexShader: `varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
 varying vec3 vDirection;uniform vec3 sunDirection;uniform float uTime;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
 float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=p*2.02+4.7;a*=.5;}return f;}
 void main(){
  vec3 d=normalize(vDirection);float h=max(0.,d.y);
  vec3 col=mix(vec3(.92,.46,.31),vec3(.26,.32,.57),smoothstep(-.02,.65,h));
  col=mix(vec3(.30,.32,.46),col,smoothstep(-.22,.02,d.y));
  float facing=max(dot(d,sunDirection),0.);
  col+=vec3(.80,.33,.09)*pow(facing,20.);
  float disc=smoothstep(.99968,.99985,facing);col=mix(col,vec3(4.,2.8,1.6),disc);
  vec2 p=d.xz/max(.12,d.y+.16)*vec2(1.7,6.);
  float cloud=smoothstep(.47,.74,fbm(p+vec2(uTime*.002,0.)));
  float band=smoothstep(.025,.10,h)*(1.-smoothstep(.32,.60,h));
  col=mix(col,vec3(.74,.52,.57),cloud*band*.36);
  col=mix(vec3(.76,.64,.66),col,smoothstep(-.005,.12,d.y));
  gl_FragColor=vec4(col,1.);
 }`,
    }),
  );
  scene.add(sky);
  // Separate mountain chains leave an open, navigable lake through the centre.
  const peaks = [
    [-1300, 1200, 660, 850, 1150],
    [1350, 900, 920, 1000, 1400],
    [-1100, -650, 1050, 850, 1300],
    [1450, -1550, 1200, 1000, 1500],
    [-1800, -2700, 1250, 1000, 1250],
    [0, -5000, 2100, 1400, 1200],
    [-2800, -4700, 1750, 1500, 1400],
    [2900, -4300, 1800, 1600, 1400],
    [-3500, 0, 1300, 1400, 2700],
    [3900, -1000, 1600, 1500, 2800],
    [-1800, -8200, 1550, 1500, 1200],
    [1900, -8400, 1650, 1500, 1300],
    [0, -9500, 1250, 1600, 1000],
  ];
  function terrainHeight(x, z) {
    let mountain = 0;
    for (const [px, pz, height, wx, wz] of peaks) {
      const r = ((x - px * 1.28) / wx) ** 2 + ((z - pz) / wz) ** 2;
      mountain = Math.max(mountain, height * Math.exp(-r * 1.55));
    }
    // Wind and glacial cuts interrupt the broad, sculpted mass with broken
    // ridgelines and smaller exposed-rock folds at several scales.
    const warpX = (fbm(x * 0.0018 + 17, z * 0.0018 + 33) - 0.5) * 360;
    const warpZ = (fbm(x * 0.0018 - 44, z * 0.0018 + 13) - 0.5) * 360;
    const ridges =
      1 - Math.abs(2 * fbm((x + warpX) * 0.0038, (z + warpZ) * 0.0038) - 1);
    const fineRock =
      fbm(x * 0.014 + warpX * 0.008, z * 0.014 + warpZ * 0.008) - 0.5;
    const strata = Math.sin(
      (x * 0.004 + z * 0.0015 + warpX * 0.003) * Math.PI * 2,
    );
    return (
      mountain * (0.68 + ridges * 0.3) +
      fineRock * mountain * 0.08 +
      strata * mountain * 0.012 -
      85 +
      170 * Math.exp(-(((x + 440) / 230) ** 2 + ((z + 1900) / 400) ** 2))
    );
  }
  const terrainGeometry = new THREE.PlaneGeometry(14000, 16000, 480, 520);
  terrainGeometry.rotateX(-Math.PI / 2);
  terrainGeometry.translate(0, 0, -2800);
  const vertices = terrainGeometry.attributes.position,
    colors = [];
  const summit = new THREE.Vector3(0, -Infinity, -5000);
  const low = new THREE.Color("#1d3942"),
    rock = new THREE.Color("#596477"),
    high = new THREE.Color("#ded1ce"),
    shore = new THREE.Color("#87766e");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i),
      z = vertices.getZ(i),
      y = terrainHeight(x, z);
    if (Math.abs(x) < 900 && Math.abs(z + 5000) < 1000 && y > summit.y)
      summit.set(x, y, z);
    vertices.setY(i, y);
    const surfaceNoise = fbm(x * 0.014, z * 0.014);
    const c = low.clone().lerp(rock, THREE.MathUtils.smoothstep(y, 10, 620));
    c.lerp(shore, (1 - THREE.MathUtils.smoothstep(y, 15, 180)) * 0.55);
    const snowline =
      y + (fbm(x * 0.003, z * 0.003) - 0.5) * 260 + (surfaceNoise - 0.5) * 130;
    c.lerp(high, THREE.MathUtils.smoothstep(snowline, 1240, 2040));
    const mineralBands =
      1 + Math.sin((x * 0.004 + z * 0.0015) * Math.PI * 2) * 0.035;
    c.multiplyScalar((0.78 + surfaceNoise * 0.42) * mineralBands);
    colors.push(c.r, c.g, c.b);
  }
  terrainGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3),
  );
  terrainGeometry.computeVertexNormals();
  const groundNormals = terrainGeometry.attributes.normal;
  const meadowColor = new THREE.Color("#788352");
  const heathColor = new THREE.Color("#8b7755");
  const mossColor = new THREE.Color("#526b43");
  const meadowWeights = new Float32Array(vertices.count);
  const vegetationColor = new THREE.Color();
  const groundColors = terrainGeometry.attributes.color;
  const groundColor = new THREE.Color();
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i),
      z = vertices.getZ(i),
      y = vertices.getY(i);
    const slope =
      Math.sqrt(Math.max(0, 1 - groundNormals.getY(i) ** 2)) /
      Math.max(0.01, groundNormals.getY(i));
    const patch = fbm(x * 0.002 + 63, z * 0.002 - 41);
    const meadow = habitat(y, slope, patch).meadow;
    groundColor.fromBufferAttribute(groundColors, i);
    meadowWeights[i] = meadow;
    vegetationColor.copy(mossColor).lerp(meadowColor, patch);
    vegetationColor.lerp(heathColor, THREE.MathUtils.smoothstep(fbm(x * .005 - 19, z * .005 + 37), .48, .72) * .65);
    groundColor.lerp(vegetationColor, meadow * .93);
    groundColors.setXYZ(i, groundColor.r, groundColor.g, groundColor.b);
  }
  terrainGeometry.setAttribute("meadow", new THREE.BufferAttribute(meadowWeights, 1));
  const textureLoader = new THREE.TextureLoader();
  const [rockTexture, normals] = await Promise.all([
    textureLoader.loadAsync("assets/alpine-rock.jpg"),
    textureLoader.loadAsync("assets/water-normal.jpg"),
  ]);
  rockTexture.colorSpace = THREE.SRGBColorSpace;
  rockTexture.wrapS = rockTexture.wrapT = THREE.RepeatWrapping;
  rockTexture.repeat.set(82, 82);
  rockTexture.anisotropy = Math.min(
    8,
    renderer.capabilities.getMaxAnisotropy(),
  );
  const terrainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: rockTexture,
    roughness: 0.97,
    metalness: 0,
  });
  // World-space color grain breaks the smooth, plastic look without tiling a
  // recognisable bitmap texture across the mountains.
  terrainMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vTerrainWorld; attribute float meadow; varying float vMeadow;",
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvTerrainWorld=worldPosition.xyz; vMeadow=meadow;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
    vec4 sampledDiffuseColor=texture2D(map,vMapUv);
    sampledDiffuseColor.rgb=min(sampledDiffuseColor.rgb*3.2+vec3(.10),vec3(1.));
    sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,vec3(.96),vMeadow*.86);
    diffuseColor *= sampledDiffuseColor;
   #endif`,
      )
      .replace(
        "#include <common>",
        `#include <common>
    varying vec3 vTerrainWorld;
    varying float vMeadow;
    float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(terrainHash(i),terrainHash(i+vec2(1,0)),f.x),mix(terrainHash(i+vec2(0,1)),terrainHash(i+vec2(1)),f.x),f.y);}
   `,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
    float rockGrain=terrainNoise(vTerrainWorld.xz*.026);
    float fineGrain=terrainNoise(vTerrainWorld.xz*.071+vec2(21.7,8.3));
    diffuseColor.rgb *= .80 + rockGrain*.30 + fineGrain*.16;
   `,
      );
  };
  terrainMaterial.customProgramCacheKey = () => "terrain-meadow-grain-v2";
  const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  scene.add(terrain);
  addVegetation(scene, terrainGeometry, fbm, hash);
  normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  normals.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  function reflectionSize() {
    const scale = Math.min(
      renderer.getPixelRatio(),
      1536 / Math.max(innerWidth, innerHeight),
    );
    return [
      Math.max(256, Math.round(innerWidth * scale)),
      Math.max(256, Math.round(innerHeight * scale)),
    ];
  }
  const [reflectionWidth, reflectionHeight] = reflectionSize();
  const water = new Water(new THREE.PlaneGeometry(300000, 300000), {
    textureWidth: reflectionWidth,
    textureHeight: reflectionHeight,
    samples: Math.min(2, renderer.capabilities.maxSamples),
    waterNormals: normals,
    sunDirection,
    sunColor: 0xffd0a0,
    waterColor: 0x165a62,
    distortionScale: 0.65,
    fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  water.material.uniforms.size.value = 3;
  // Suppress subpixel waves in distant water. Otherwise the normal-map and
  // specular details shimmer as the summit view rotates across them.
  water.material.fragmentShader = water.material.fragmentShader
    .replace(
      "vec4 noise = getNoise( worldPosition.xz * size );",
      `
   vec2 rippleUV=worldPosition.xz*size;
   float footprint=max(length(dFdx(rippleUV)),length(dFdy(rippleUV)));
   float rippleWeight=1.-smoothstep(8.,50.,footprint);
   vec4 noise=getNoise(rippleUV);
  `,
    )
    .replace(
      "normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) )",
      "normalize(vec3(noise.x*.24*rippleWeight,1.,noise.y*.24*rippleWeight))",
    )
    .replace("float rf0 = 0.3", "float rf0 = 0.08");
  scene.add(water);
  const summitEye = summit.clone().add(new THREE.Vector3(0, 38, 0));
  const path = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(40, 130, 2000),
      new THREE.Vector3(-100, 85, 950),
      new THREE.Vector3(130, 100, -150),
      new THREE.Vector3(100, 170, -1300),
      new THREE.Vector3(180, 420, -2400),
      new THREE.Vector3(250, 1000, -3400),
      new THREE.Vector3(summit.x + 100, summit.y + 130, summit.z + 700),
      summitEye,
    ],
    false,
    "centripetal",
  );
  // Smoothly lift any low part of the flight above the actual sculpted surface.
  // The fixed summit eye is above the highest vertex in the central massif.
  const gaze = new THREE.Vector3(),
    approachGaze = new THREE.Vector3(),
    panoramaGaze = new THREE.Vector3();
  let previous = performance.now(),
    elapsed = 0;
  const panels = [
    $(".hero-content"),
    $("#building .story"),
    $("#background .story"),
    $("#perspective .story"),
    $(".closing"),
  ];
  const ascentCaption = $("#ascent-caption"),
    summitCaption = $("#summit-caption");
  const sceneCaption = $(".scene-caption"),
    progress = $("#progress"),
    chapterNumber = $("#chapter-number"),
    placeName = $("#place-name"),
    locationHint = $(".location small");
  const ranges = [
    [0, 0.0, 0.12, 0.19],
    [0.18, 0.23, 0.32, 0.39],
    [0.39, 0.44, 0.53, 0.6],
    [0.6, 0.66, 0.77, 0.84],
    [0.9, 0.97, 1, 1.1],
  ];
  function render(now) {
    requestAnimationFrame(render);
    if (document.hidden) {
      previous = now;
      return;
    }
    const frameSeconds = Math.max(0, (now - previous) / 1000);
    const dt = Math.min(frameSeconds, 0.05);
    previous = now;
    elapsed += dt;
    clock.value = reduced ? 0 : elapsed;
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - innerHeight,
    );
    let target = THREE.MathUtils.clamp(scrollY / maxScroll, 0, 1);
    if (automatic && !document.querySelector("dialog[open]")) {
      // Keep the camera clock in floating-point route space. DOM scroll positions
      // can round to pixels, so they must not feed back into automatic motion.
      autoplayTarget = Math.min(
        1,
        (autoplayTarget ?? target) + journeyScrollDistance(frameSeconds, 1),
      );
      target = autoplayTarget;
      window.scrollTo({ top: target * maxScroll, behavior: "instant" });
      if (target >= 1) stopPlayback();
    } else {
      autoplayTarget = null;
    }
    const followSpeed = target > 0.92 ? 6 : 4;
    position = reduced
      ? target
      : THREE.MathUtils.lerp(position, target, 1 - Math.exp(-frameSeconds * followSpeed));
    const ascent = cameraProgress(position);
    path.getPointAt(ascent, camera.position);
    const clearance = terrainHeight(camera.position.x, camera.position.z) + 65;
    // Smooth maximum avoids abrupt terrain-following kicks during the climb.
    const delta = camera.position.y - clearance;
    camera.position.y =
      (camera.position.y + clearance + Math.sqrt(delta * delta + 900)) * 0.5;
    const arrival = THREE.MathUtils.smootherstep(position, 0.84, 0.95);
    camera.position.lerp(summitEye, arrival);
    const atSummit = target > 0.999 && position > 0.99;
    summitReady = atSummit;
    if (position < 0.84) {
      summitCaptionElapsed = 0;
      panoramaElapsed = 0;
      panTarget = 0;
      panOffset = 0;
    }
    panOffset = reduced
      ? panTarget
      : THREE.MathUtils.lerp(panOffset, panTarget, 1 - Math.exp(-dt * 12));
    panoramaElapsed = advancePanorama(
      panoramaElapsed,
      dt,
      atSummit && !panoramaPaused && !document.querySelector("dialog[open]"),
    );
    // Constant angular speed keeps each revolution seamless at the wrap.
    const turn = panoramaAngle(panoramaElapsed, panOffset);
    if (atSummit && !document.querySelector("dialog[open]"))
      summitCaptionElapsed += dt;
    const lift = THREE.MathUtils.smoothstep(position, 0.42, 0.83);
    approachGaze.set(
      camera.position.x * 0.2,
      THREE.MathUtils.lerp(230, summit.y + 120, lift),
      camera.position.z - 2300,
    );
    panoramaGaze
      .set(Math.sin(turn) * 3000, -620, -Math.cos(turn) * 3000)
      .add(camera.position);
    gaze.copy(approachGaze).lerp(panoramaGaze, arrival);
    camera.lookAt(gaze);
    updateJourneyControl();
    sky.position.copy(camera.position);
    water.material.uniforms.time.value = reduced ? 0 : elapsed * 0.2;
    panels.forEach((panel, i) => {
      const [a, b, c, d] = ranges[i];
      const opacity =
        (i === 0 ? 1 : THREE.MathUtils.smoothstep(position, a, b)) *
        (1 - THREE.MathUtils.smoothstep(position, c, d));
      panel.style.opacity = opacity;
      panel.style.visibility = opacity > 0.005 ? "visible" : "hidden";
      const entrance = (1 - opacity) * 18;
      panel.style.transform = panel.matches(".hero-content")
        ? `translateY(${entrance}px)`
        : `translateY(calc(-50% + ${entrance}px))`;
      panel.inert = opacity < 0.5;
    });
    sceneCaption.style.opacity =
      1 - THREE.MathUtils.smoothstep(position, 0.1, 0.2);
    // A short aside after the background chapter settles into view, then a summit
    // invitation that appears once and leaves the panorama clear.
    const ascentOpacity =
      THREE.MathUtils.smoothstep(position, 0.47, 0.5) *
      (1 - THREE.MathUtils.smoothstep(position, 0.55, 0.59));
    const summitOpacity =
      THREE.MathUtils.smoothstep(summitCaptionElapsed, 5, 8) *
      (1 - THREE.MathUtils.smoothstep(summitCaptionElapsed, 17, 21)) *
      THREE.MathUtils.smoothstep(position, 0.97, 1);
    for (const [caption, opacity] of [
      [ascentCaption, ascentOpacity],
      [summitCaption, summitOpacity],
    ]) {
      caption.style.opacity = opacity;
      caption.style.visibility = opacity > 0.005 ? "visible" : "hidden";
    }
    progress.style.width = `${target * 100}%`;
    setText(
      chapterNumber,
      String(
        Math.min(panels.length, Math.floor(target * panels.length) + 1),
      ).padStart(2, "0"),
    );
    setText(
      placeName,
      atSummit
        ? "THE SUMMIT"
        : position > 0.6
          ? "A LITTLE HIGHER"
          : "BY THE LAKE",
    );
    setText(
      locationHint,
      atSummit ? "SCROLL SIDEWAYS TO LOOK AROUND" : "SCROLL TO EXPLORE",
    );
    renderer.render(scene, camera);
  }
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    water.setReflectionSize(...reflectionSize());
  });
  requestAnimationFrame(render);
  $("#loading").classList.add("done");
  if (!reduced && !journeyStarted) play.classList.add("start-cue");
}
start().catch((error) => {
  console.error("Landscape unavailable; showing the readable page.", error);
  $("#loading").classList.add("done");
  document.body.classList.add("no-webgl");
  document
    .querySelectorAll("[inert]")
    .forEach((panel) => (panel.inert = false));
});
