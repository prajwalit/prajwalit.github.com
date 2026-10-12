// All celestial detail is drawn in the existing sky pass, including reflections.
export const skyFragmentShader = `
varying highp vec3 vDirection;
uniform vec3 sunDirection,moonDirection;
uniform mat3 starRotation;
uniform float uTime,uDusk,uNight,uDay;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=p*2.02+4.7;a*=.5;}return f;}
float stars(vec2 uv,float density,float threshold){
 vec2 cell=floor(uv*density), f=fract(uv*density);
 float seed=hash(cell);
 vec2 centre=vec2(.2)+.6*vec2(hash(cell+3.1),hash(cell+7.3));
 float radius=.025+.055*hash(cell+19.);
 float aa=max(length(fwidth(uv*density))*.65,.025);
 return step(threshold,seed)*(1.-smoothstep(radius,radius+aa,length(f-centre)))*(.35+.65*hash(cell+9.));
}
void main(){
 vec3 d=normalize(vDirection);float h=max(0.,d.y);
 vec3 warm=mix(vec3(.92,.46,.31),vec3(.26,.32,.57),smoothstep(-.02,.65,h));
 vec3 daylight=mix(vec3(.65,.77,.86),vec3(.12,.35,.68),smoothstep(0.,.8,h));
 vec3 dusk=mix(vec3(.42,.27,.34),vec3(.085,.12,.25),smoothstep(-.02,.65,h));
 vec3 night=mix(vec3(.055,.075,.13),vec3(.009,.018,.048),smoothstep(0.,.65,h));
 vec3 col=mix(warm,daylight,uDay);col=mix(col,dusk,uDusk);col=mix(col,night,uNight);
 vec2 p=d.xz/max(.12,d.y+.16)*vec2(1.7,6.);
 // Gentle but visible daytime drift; dissolve clouds as night arrives.
 // Applying the fade here also clears their mask over stars and the Milky Way.
 float cloud=smoothstep(.42,.80,fbm(p+vec2(uTime*.055,uTime*.015)))
   *(1.-smoothstep(0.,.95,uNight));
 float band=smoothstep(.025,.10,h)*(1.-smoothstep(.32,.60,h));
 // Wispy clouds soften the disc while retaining its warm luminous shape.
 // Keep the broad halo independent of cloud detail to avoid striped lighting.
 float sunTransmission=mix(.25,1.,exp(-2.*cloud*band));
 float facing=max(dot(d,sunDirection),0.);
 col+=mix(vec3(.80,.33,.09),vec3(.30,.10,.08),uDusk)*pow(facing,20.)*(1.-uNight);
 float disc=smoothstep(.99968,.99985,facing)*smoothstep(-.015,.01,d.y);
 col=mix(col,mix(vec3(4.,2.8,1.6),vec3(2.8,.65,.25),uDusk),disc*sunTransmission);
 if(uNight>.001 && d.y>0.){
   vec3 celestial=starRotation*d;
   // A tilted great-circle band with uneven star clouds and dark dust lanes.
   vec3 normal=normalize(vec3(.35,.78,.52));
   vec3 axis=normalize(cross(normal,vec3(0.,1.,0.)));
   vec3 across=cross(normal,axis);
   float latitude=dot(celestial,normal);
   float longitude=atan(dot(celestial,across),dot(celestial,axis));
   // Near-isotropic coordinates avoid stretching noise into cloud streaks.
   vec2 gal=vec2(longitude,latitude)*7.;
   float warp=(noise(gal*.65+17.)-.5)*.045;
   float lat=latitude+warp;
   float width=.085+.055*noise(vec2(longitude*3.2,6.));
   // Signed distances must be squared directly: GLSL pow is undefined
   // for negative bases, even with an exponent of two (mobile GPU artifacts).
   float envelopeDistance=lat/width;
   float envelope=exp(-envelopeDistance*envelopeDistance);
   float core=pow(max(0.,.5+.5*cos(longitude+2.1)),22.);
   float shoulder=lat-.028-.018*noise(vec2(longitude*4.,26.));
   float bulge=exp(-shoulder*shoulder*27.)*core*(.65+.55*noise(gal*1.3+42.));
   float coarse=fbm(gal+vec2(7.,11.));
   float fine=noise(gal*17.+31.);
   float cloudlets=smoothstep(.25,.74,coarse)*(.7+.6*fine);
   // Fine structure erodes the dust edges instead of cutting out solid blobs.
   float filaments=noise(gal*13.+vec2(43.,17.));
   float grain=noise(gal*61.+vec2(8.,39.));
   float edgeWarp=(filaments-.5)*.018+(fine-.5)*.009;
   float dustLat=lat+edgeWarp;
   float riftCentre=(noise(vec2(longitude*7.,13.))-.5)*.075
     +(noise(gal*2.8+23.)-.5)*.035;
   float riftWidth=.012+.024*noise(vec2(longitude*11.,47.));
   float breaks=smoothstep(.28,.68,noise(vec2(longitude*8.,37.)));
   float riftDistance=(dustLat-riftCentre)/riftWidth;
   float rift=exp(-riftDistance*riftDistance)*breaks;
   float branchCentre=riftCentre+.035+.045*noise(vec2(longitude*5.,4.));
   float branchDistance=(dustLat-branchCentre)/.026;
   float branch=exp(-branchDistance*branchDistance)
     *smoothstep(.42,.72,noise(gal*2.+11.));
   float knots=smoothstep(.38,.76,noise(gal*8.3+9.))*exp(-lat*lat*95.);
   float dust=clamp((rift*.48+branch*.30+knots*.18)*(.55+.55*filaments),0.,.58);
   float unresolved=envelope*(.008+.022*grain)*(.4+.6*core);
   float glow=(envelope*(.06+.31*cloudlets)+bulge*.24)*(1.-dust)+unresolved;
   float skyMask=smoothstep(.015,.18,d.y)*(1.-cloud*band*.8);
   vec3 starlight=mix(vec3(.34,.40,.57),vec3(.64,.56,.43),core*.8);
   col+=starlight*glow*uNight*skyMask;
   vec2 uv=vec2(atan(celestial.z,celestial.x)/6.2831853+.5,asin(clamp(celestial.y,-1.,1.))/3.14159265+.5);
   float points=stars(uv,480.,.991)+stars(uv+vec2(.13,.07),850.,.997)*.5;
   float dense=stars(uv+vec2(.27,.19),1150.,.84);
   float fineStars=stars(uv+vec2(.41,.31),1700.,.93);
   float population=envelope*(.4+.6*cloudlets)*(1.-dust*.65);
   col+=(vec3(.72,.79,1.)*points+mix(vec3(.57,.65,.85),vec3(.85,.78,.65),core)
     *(dense*.8+fineStars*.35)*population)*uNight*skyMask;
   // Aurora over the far peaks, opposite the early-night moon. Drawn in this
   // same pass, so it adds no geometry, light or render target, and the fjord
   // reflects it because the sky sphere is already reflected.
   float aurAzimuth=atan(d.x,-d.z);
   // Ascending edges only: GLSL leaves smoothstep undefined when edge0>edge1.
   float aurFacing=1.-smoothstep(.5,1.75,abs(aurAzimuth));
   if(aurFacing>.002){
     float aurDrift=uTime*.013;
     // The arc wanders along the horizon, deepening and thinning as it goes.
     float aurBase=.105+.07*noise(vec2(aurAzimuth*1.3+aurDrift,2.7));
     float aurSpread=.16+.10*noise(vec2(aurAzimuth*2.3-aurDrift,8.1));
     // Square the signed distance directly: pow is undefined for negative
     // bases, which shows up as artifacts on mobile GPUs.
     float aurFall=(d.y-aurBase)/aurSpread;
     float aurCurtain=exp(-aurFall*aurFall);
     // Two octaves of vertical streaks is enough for curtains, and costs a
     // quarter of the sin calls an fbm would.
     float aurRays=noise(vec2(aurAzimuth*8.5+aurDrift*2.,d.y*6.-uTime*.045))*.62
       +noise(vec2(aurAzimuth*19.-aurDrift*3.,d.y*13.+uTime*.028))*.38;
     aurRays=smoothstep(.3,.82,aurRays);
     // A slow swell, so it breathes rather than hanging there.
     float aurPulse=.55+.45*noise(vec2(uTime*.035,4.2));
     float aurVeil=aurCurtain*(.25+.95*aurRays)*aurFacing*aurPulse;
     // Oxygen green through the body, a thin rose flush where it thins out.
     vec3 aurTint=mix(vec3(.16,.92,.52),vec3(.62,.28,.78),smoothstep(-.3,1.5,aurFall));
     col+=aurTint*aurVeil*uNight*skyMask*.45;
   }
   // Subtle mottling in the moon, with a small halo rather than a glowing orb.
   float moonFacing=max(dot(d,moonDirection),0.);
   vec3 right=normalize(cross(moonDirection,vec3(0.,1.,.001)));
   vec3 up=cross(right,moonDirection);
   vec2 moonUV=vec2(dot(d,right),dot(d,up))*80.;
   float moonDisc=smoothstep(.99973,.99983,moonFacing);
   float maria=.65+.25*fbm(moonUV*3.+12.);
   col+=vec3(.055,.075,.13)*pow(moonFacing,180.)*uNight;
   col=mix(col,vec3(.86,.88,.80)*maria,moonDisc*uNight*smoothstep(0.,.025,d.y));
 }
 vec3 cloudColor=mix(mix(vec3(.74,.52,.57),vec3(.88,.91,.95),uDay),vec3(.06,.08,.13),uNight);
 col=mix(col,cloudColor,cloud*band*.36);
 vec3 horizon=mix(mix(vec3(.76,.64,.66),vec3(.65,.77,.86),uDay),vec3(.08,.10,.16),uNight);
 col=mix(horizon,col,smoothstep(-.005,.12,d.y));
 gl_FragColor=vec4(col,1.);
}`;
