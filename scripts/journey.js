import * as THREE from '../assets/vendor/three.module.js';
import { Water } from '../assets/vendor/Water.js';


const $ = s => document.querySelector(s);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let automatic = false, position = 0;
let panoramaPaused=reduced, panoramaElapsed=0;
let summitReady=false, panTarget=0, panOffset=0;
const panoramaToggle=$('#panorama-toggle');
panoramaToggle.onclick=()=>{if(panoramaElapsed>=90){panoramaElapsed=0;panoramaPaused=false;}else panoramaPaused=!panoramaPaused;};
const play = $('#play');
function stopPlayback(){automatic=false;play.innerHTML='▷ <span>Let it unfold</span>';play.setAttribute('aria-label','Play automatic journey');}
play.onclick=()=>{automatic=!automatic;play.innerHTML=automatic?'Ⅱ <span>Pause journey</span>':'▷ <span>Let it unfold</span>';play.setAttribute('aria-label',automatic?'Pause automatic journey':'Play automatic journey');if(automatic&&scrollY>=document.documentElement.scrollHeight-innerHeight-5)window.scrollTo({top:0,behavior:'instant'});};
for(const event of ['wheel','touchstart','keydown'])addEventListener(event,stopPlayback,{passive:true});
// Only sideways gestures at the summit take over the camera. Vertical input
// remains native page scrolling, and pinch-to-zoom remains a browser gesture.
addEventListener('wheel',event=>{
 if(!summitReady||event.ctrlKey||document.querySelector('dialog[open]'))return;
 const horizontal=event.shiftKey&&event.deltaX===0?event.deltaY:event.deltaX;
 if(!horizontal||(!event.shiftKey&&Math.abs(horizontal)<=Math.abs(event.deltaY)))return;
 event.preventDefault();
 const unit=event.deltaMode===1?16:event.deltaMode===2?innerWidth:1;
 panTarget+=horizontal*unit*.002;
 panoramaPaused=true;
},{passive:false});
$('#back-top').onclick=()=>{stopPlayback();window.scrollTo({top:0,behavior:reduced?'instant':'smooth'});};
for(const [trigger,modal] of [['#about-button','#about'],['#credits-button','#credits']]){
 $(trigger).onclick=()=>{stopPlayback();$(modal).showModal();};
 $(modal).querySelector('.close').onclick=()=>$(modal).close();
 $(modal).onclick=e=>{if(e.target===$(modal)){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
}


// An imagined landscape: deliberately sculpted, with no geographic claim.
function hash(x,z){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);}
function noise(x,z){const a=Math.floor(x),b=Math.floor(z);let u=x-a,v=z-b;u=u*u*(3-2*u);v=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),u),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),u),v);}
function fbm(x,z){let value=0,amplitude=.5;for(let i=0;i<5;i++){value+=noise(x,z)*amplitude;x=x*2.03+13.7;z=z*2.03+7.3;amplitude*=.5;}return value;}
async function start(){
 const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 $('#world').append(renderer.domElement);
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xc49aa2,.00014);
 // The route stays at least 38 units above the terrain. A 10-unit near
 // plane preserves depth precision at distant shorelines during the orbit.
 const camera=new THREE.PerspectiveCamera(54,innerWidth/innerHeight,10,160000);
 scene.add(new THREE.HemisphereLight(0xbacff1,0x203c49,2.0));
 const sunDirection=new THREE.Vector3(.16,.24,-1).normalize();
 const sun=new THREE.DirectionalLight(0xffc397,3.1);sun.position.copy(sunDirection).multiplyScalar(8000);scene.add(sun);
 const clock={value:0};
 const sky=new THREE.Mesh(new THREE.SphereGeometry(80000,40,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uTime:clock,sunDirection:{value:sunDirection}},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
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
 }`}));scene.add(sky);
 // Separate mountain chains leave an open, navigable lake through the centre.
 const peaks=[[-1300,1200,660,850,1150],[1350,900,920,1000,1400],[-1100,-650,1050,850,1300],[1450,-1550,1200,1000,1500],[-1800,-2700,1250,1000,1250],[0,-5000,2100,1400,1200],[-2800,-4700,1750,1500,1400],[2900,-4300,1800,1600,1400],[-3500,0,1300,1400,2700],[3900,-1000,1600,1500,2800],[-1800,-8200,1550,1500,1200],[1900,-8400,1650,1500,1300],[0,-9500,1250,1600,1000]];
 function terrainHeight(x,z){
  let mountain=0;
  for(const [px,pz,height,wx,wz] of peaks){const r=((x-px*1.28)/wx)**2+((z-pz)/wz)**2;mountain=Math.max(mountain,height*Math.exp(-r*1.55));}
  const ridges=1-Math.abs(2*fbm(x*.0024,z*.0024)-1);
  return mountain*(.62+ridges*.56)+(fbm(x*.008,z*.008)-.5)*mountain*.16-85
   +170*Math.exp(-(((x+440)/230)**2+((z+1900)/400)**2));
 }
 const terrainGeometry=new THREE.PlaneGeometry(14000,16000,360,400);terrainGeometry.rotateX(-Math.PI/2);terrainGeometry.translate(0,0,-2800);
 const vertices=terrainGeometry.attributes.position,colors=[];
 const summit=new THREE.Vector3(0,-Infinity,-5000);
 const low=new THREE.Color('#203e49'),rock=new THREE.Color('#546179'),high=new THREE.Color('#d3c5cb');
 for(let i=0;i<vertices.count;i++){
  const x=vertices.getX(i),z=vertices.getZ(i),y=terrainHeight(x,z);
  if(Math.abs(x)<900&&Math.abs(z+5000)<1000&&y>summit.y)summit.set(x,y,z);
  vertices.setY(i,y);
  const c=low.clone().lerp(rock,THREE.MathUtils.smoothstep(y,20,650));
  c.lerp(high,THREE.MathUtils.smoothstep(y+(fbm(x*.006,z*.006)-.5)*200,1050,1900));
  c.multiplyScalar(.88+fbm(x*.012,z*.012)*.23);colors.push(c.r,c.g,c.b);
 }
 terrainGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainGeometry.computeVertexNormals();
 scene.add(new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,metalness:0})));
 const normals=await new THREE.TextureLoader().loadAsync('assets/water-normal.jpg');normals.wrapS=normals.wrapT=THREE.RepeatWrapping;normals.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 function reflectionSize(){
  const scale=Math.min(renderer.getPixelRatio(),1536/Math.max(innerWidth,innerHeight));
  return [Math.max(256,Math.round(innerWidth*scale)),Math.max(256,Math.round(innerHeight*scale))];
 }
 const [reflectionWidth,reflectionHeight]=reflectionSize();
 const water=new Water(new THREE.PlaneGeometry(300000,300000),{textureWidth:reflectionWidth,textureHeight:reflectionHeight,samples:Math.min(2,renderer.capabilities.maxSamples),waterNormals:normals,sunDirection,sunColor:0xffd0a0,waterColor:0x165a62,distortionScale:.65,fog:true});
 water.rotation.x=-Math.PI/2;water.position.y=0;water.material.uniforms.size.value=3;
 // Suppress subpixel waves in distant water. Otherwise the normal-map and
 // specular details shimmer as the summit view rotates across them.
 water.material.fragmentShader=water.material.fragmentShader
  .replace('vec4 noise = getNoise( worldPosition.xz * size );', `
   vec2 rippleUV=worldPosition.xz*size;
   float footprint=max(length(dFdx(rippleUV)),length(dFdy(rippleUV)));
   float rippleWeight=1.-smoothstep(8.,50.,footprint);
   vec4 noise=getNoise(rippleUV);
  `)
  .replace('normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) )','normalize(vec3(noise.x*.24*rippleWeight,1.,noise.y*.24*rippleWeight))')
  .replace('float rf0 = 0.3','float rf0 = 0.08');
 scene.add(water);
 const summitEye=summit.clone().add(new THREE.Vector3(0,38,0));
 const path=new THREE.CatmullRomCurve3([
  new THREE.Vector3(40,130,2000),new THREE.Vector3(-100,85,950),
  new THREE.Vector3(130,100,-150),new THREE.Vector3(100,170,-1300),
  new THREE.Vector3(180,420,-2400),new THREE.Vector3(250,1000,-3400),
  new THREE.Vector3(summit.x+100,summit.y+130,summit.z+700),summitEye
 ],false,'centripetal');
 // Smoothly lift any low part of the flight above the actual sculpted surface.
 // The fixed summit eye is above the highest vertex in the central massif.
 const gaze=new THREE.Vector3(),approachGaze=new THREE.Vector3(),panoramaGaze=new THREE.Vector3();
 let previous=performance.now(),elapsed=0;
 const panels=[$('.hero-content'),$('#building .story'),$('#background .story'),$('#perspective .story'),$('.closing')];
 const ranges=[[0,.00,.12,.19],[.18,.23,.32,.39],[.39,.44,.53,.60],[.60,.66,.77,.84],[.90,.97,1,1.1]];
 function render(now){
  requestAnimationFrame(render);if(document.hidden){previous=now;return;}
  const dt=Math.min((now-previous)/1000,.05);previous=now;elapsed+=dt;clock.value=reduced?0:elapsed;
  const maxScroll=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  if(automatic&&!document.querySelector('dialog[open]')){window.scrollBy({top:dt*42,behavior:'instant'});if(scrollY>=maxScroll-2)stopPlayback();}
  const target=THREE.MathUtils.clamp(scrollY/maxScroll,0,1);position=reduced?target:THREE.MathUtils.lerp(position,target,1-Math.exp(-dt*4));
  const ascent=THREE.MathUtils.smootherstep(position,0,.96);
  path.getPointAt(ascent,camera.position);
  const clearance=terrainHeight(camera.position.x,camera.position.z)+65;
  // Smooth maximum avoids abrupt terrain-following kicks during the climb.
  const delta=camera.position.y-clearance;
  camera.position.y=(camera.position.y+clearance+Math.sqrt(delta*delta+900))*.5;
  const arrival=THREE.MathUtils.smootherstep(position,.84,.96);
  camera.position.lerp(summitEye,arrival);
  const atSummit=target>.999&&position>.997;
  summitReady=atSummit;
  if(position<.84){panoramaElapsed=0;panTarget=0;panOffset=0;}
  panOffset=reduced?panTarget:THREE.MathUtils.lerp(panOffset,panTarget,1-Math.exp(-dt*12));
  if(atSummit&&!panoramaPaused&&!document.querySelector('dialog[open]'))panoramaElapsed=Math.min(90,panoramaElapsed+dt);
  const turn=THREE.MathUtils.smoothstep(panoramaElapsed,0,90)*Math.PI*2+panOffset;
  const lift=THREE.MathUtils.smoothstep(position,.42,.83);
  approachGaze.set(camera.position.x*.2,THREE.MathUtils.lerp(230,summit.y+120,lift),camera.position.z-2300);
  panoramaGaze.copy(camera.position).add(new THREE.Vector3(Math.sin(turn)*3000,-620,-Math.cos(turn)*3000));
  gaze.copy(approachGaze).lerp(panoramaGaze,arrival);camera.lookAt(gaze);
  panoramaToggle.hidden=!atSummit;
  panoramaToggle.setAttribute('aria-pressed',String(panoramaPaused));
  const panoramaLabel=panoramaElapsed>=90?'↻ <span>Turn again</span>':panoramaPaused?'▷ <span>Resume panorama</span>':'Ⅱ <span>Pause panorama</span>';
  if(panoramaToggle.innerHTML!==panoramaLabel)panoramaToggle.innerHTML=panoramaLabel;
  sky.position.copy(camera.position);water.material.uniforms.time.value=reduced?0:elapsed*.20;
  panels.forEach((panel,i)=>{const [a,b,c,d]=ranges[i];const opacity=(i===0?1:THREE.MathUtils.smoothstep(position,a,b))*(1-THREE.MathUtils.smoothstep(position,c,d));panel.style.opacity=opacity;panel.style.visibility=opacity>.005?'visible':'hidden';panel.style.transform=`translateY(${(1-opacity)*18}px)`;panel.inert=opacity<.5;});
  $('.scene-caption').style.opacity=1-THREE.MathUtils.smoothstep(position,.10,.20);
  $('#progress').style.width=`${target*100}%`;$('#chapter-number').textContent=String(Math.min(panels.length,Math.floor(target*panels.length)+1)).padStart(2,'0');
  $('#place-name').textContent=atSummit?'THE SUMMIT':position>.60?'A LITTLE HIGHER':'BY THE LAKE';
  $('.location small').textContent=atSummit?'SCROLL SIDEWAYS TO LOOK AROUND':'SCROLL TO EXPLORE';
  renderer.render(scene,camera);
 }
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);water.setReflectionSize(...reflectionSize());});
 requestAnimationFrame(render);$('#loading').classList.add('done');
}
start().catch(error=>{console.error(error);$('#loading').classList.add('done');document.body.classList.add('no-webgl');});
