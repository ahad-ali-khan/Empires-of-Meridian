import * as T from 'three';
import {random} from './layout';
import {WeatherTransition} from './weather-transition';

export type Weather = import('../../../../../packages/protocol/src/index').EnvironmentWeather;
const noiseGLSL = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=noise(p)*a;p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return n;}
`;

export function createEnvironment() {
  const group = new T.Group();
  const time = {value: 0},
    waterTime = {value: 0},
    cloud = {value: 0.2},
    storm = {value: 0},
    flash = {value: 0};
  const golden = {value: 0},
    wind = {value: 1};
  const sunDirection = {value: new T.Vector3(-32, 62, 28).normalize()};
  const skyMat = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: {time, cloud, storm, flash, golden, sunDirection},
    vertexShader: `varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
    fragmentShader: `
      varying vec3 world;uniform float time,cloud,storm,flash,golden;uniform vec3 sunDirection;
      ${noiseGLSL}
      void main(){
        vec3 d=normalize(world-cameraPosition);float elevation=max(d.y,0.);
        float sunDot=max(dot(d,sunDirection),0.);
        vec3 horizon=mix(vec3(.59,.75,.80),vec3(.92,.67,.39),golden*.72);
        vec3 zenith=mix(vec3(.055,.235,.48),vec3(.16,.29,.43),golden);
        vec3 col=mix(horizon,zenith,pow(elevation,.42));
        col+=vec3(1.,.83,.55)*pow(sunDot,12.)*.085;
        float sun=smoothstep(.99942,.99977,sunDot);
        col=mix(col,vec3(1.,.92,.72)*2.8,sun);
        // Large cumulus islands and a thin high-altitude veil have independent
        // drift and scale. Their shaded undersides give the sky actual depth.
        vec2 p=d.xz/max(.13,d.y+.20)*1.45+vec2(time*.0045,time*.0015);
        float billow=fbm(p*1.6),detail=noise(p*9.0);
        float mass=billow+detail*.065;
        float coverage=smoothstep(.64-cloud*.27,.74-cloud*.27,mass);
        float top=fbm(p*1.6-sunDirection.xz*.12);
        float rim=clamp((mass-top)*7.+.45,0.,1.);
        vec3 underside=mix(vec3(.62,.70,.74),vec3(.17,.22,.28),storm);
        vec3 lit=mix(vec3(1.04,1.025,.94),vec3(.43,.48,.54),storm);
        vec3 cloudColor=mix(underside,lit,clamp(rim*.75+detail*.25,0.,1.));
        cloudColor=mix(cloudColor,cloudColor*vec3(1.1,.90,.72),golden*.5);
        float cloudHorizon=smoothstep(-.015,.09,d.y);
        col=mix(col,cloudColor,coverage*cloudHorizon);
        float veil=smoothstep(.63,.85,fbm(p*3.+vec2(-time*.001,8.)))*.13*(1.-coverage);
        col=mix(col,vec3(.87,.91,.93),veil*cloudHorizon*(1.-storm));
        col=mix(col,col*vec3(.40,.48,.58),storm*.70);
        // A cloud-sheet illumination accompanies the physical lightning bolt.
        col+=vec3(.38,.48,.68)*flash*(.45+coverage*.55);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  // Opaque geometry establishes depth before the cloud shader runs. Covered sky
  // pixels are rejected early on tile-based GPUs, including the M1 Air.
  const sky = new T.Mesh(new T.SphereGeometry(720, 24, 16), skyMat);
  sky.name = 'atmosphere';
  sky.renderOrder = 10;
  group.add(sky);

  const waterMat = new T.ShaderMaterial({
    depthWrite: true,
    uniforms: {time: waterTime, storm, golden, wind, sunDirection, shoal: {value: new T.Vector3(40, 34, 4.5)}},
    vertexShader: `
      varying vec3 world;uniform float time,storm;
      void main(){vec3 p=position;float amp=.022+storm*.045;
        p.z+=sin(p.x*.21+time*.8)*amp+sin(p.y*.27+time*.7)*amp;
        world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
      }`,
    fragmentShader: `
      varying vec3 world;uniform float time,storm,golden,wind;uniform vec3 sunDirection,shoal;
      ${noiseGLSL}
      void main(){
        vec2 p=world.xz;float t=time;
        float a=p.x*.41+p.y*.17+t,b=p.x*-.23+p.y*.53+t*.83,c=p.x*.83-p.y*.37-t*.53;
        vec2 slope=vec2(.41,.17)*cos(a)*.08+vec2(-.23,.53)*cos(b)*.066+vec2(.83,-.37)*cos(c)*.021;
        slope+=vec2(noise(p*1.1+t*.06)-.5,noise(p*1.2-t*.05)-.5)*.021;
        vec3 n=normalize(vec3(-slope.x*(1.+storm),1.,-slope.y*(1.+storm)));
        vec3 v=normalize(cameraPosition-world),r=reflect(-v,n);
        float fresnel=.045+.82*pow(1.-max(dot(v,n),0.),4.);
        float shore=24.+sin(p.y*.065)*7.+sin(p.y*.16)*2.;
        float depth=max(0.,p.x-shore+4.0);
        vec3 base=mix(vec3(.19,.46,.39),vec3(.032,.16,.23),smoothstep(0.,20.,depth));
        vec3 reflection=mix(vec3(.65,.77,.80),vec3(.10,.31,.51),pow(max(r.y,0.),.5));
        vec2 reflectedCloud=r.xz/max(.18,r.y+.2)*2.+vec2(time*.0045,time*.0015);
        float cloudReflection=smoothstep(.53,.74,noise(reflectedCloud)+noise(reflectedCloud*2.4)*.18);
        reflection=mix(reflection,vec3(.73,.78,.76),cloudReflection*.5);
        reflection=mix(reflection,vec3(.22,.29,.35),storm*.78);
        vec3 col=mix(base,reflection,fresnel);
        // Continuous broad specular lobes, with long swell ridges beneath them.
        float spec=pow(max(dot(reflect(-sunDirection,n),v),0.),110.);
        col+=vec3(1.,.88,.64)*spec*.68*(1.-storm*.83);
        float waveCrest=smoothstep(.965,1.,sin(a*.63+b*.24))*smoothstep(.55,.82,noise(p*.19));
        col+=vec3(.15,.23,.22)*waveCrest*(.10+storm*.16);
        float shoreWave=sin(depth*2.0-t*.8+noise(p*.65)*1.2);
        float foam=(1.-smoothstep(.18,1.8,depth))*smoothstep(.55,.94,shoreWave)*.36;
        col=mix(col,vec3(.81,.86,.79),foam);
        col=mix(col,col*vec3(1.16,.94,.76),golden*.3);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const water = new T.Mesh(new T.PlaneGeometry(1500, 1500, 100, 100), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.06;
  water.renderOrder = 1;
  group.add(water);

  const rand = random(651),
    positions: number[] = [],
    ids: number[] = [],
    ends: number[] = [];
  for (let i = 0; i < 1800; i++) {
    const x = (rand() - 0.5) * 90,
      y = rand() * 34,
      z = (rand() - 0.5) * 90;
    positions.push(x, y, z, x, y, z);
    ids.push(i / 1800, i / 1800);
    ends.push(0, 1);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('dropId', new T.Float32BufferAttribute(ids, 1));
  g.setAttribute('tail', new T.Float32BufferAttribute(ends, 1));
  const rainMat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {time, storm, density: {value: 0}, anchor: {value: new T.Vector3()}},
    vertexShader: `attribute float dropId,tail;varying float id;uniform float time,storm;uniform vec3 anchor;
      void main(){id=dropId;vec3 p=position;p.y=mod(p.y-time*13.,34.);p.x=mod(p.x+time*2.+45.,90.)-45.;
        p+=vec3(.09,-.62,.03)*tail;p.xz+=anchor.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying float id;uniform float density;void main(){if(id>density)discard;gl_FragColor=vec4(.75,.84,.88,.21);}`,
  });
  const rain = new T.LineSegments(g, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  rain.renderOrder = 3;
  group.add(rain);

  const lightning = new T.Group();
  lightning.name = 'cloudToGroundLightning';
  group.add(lightning);
  const boltMaterial = new T.MeshBasicMaterial({color: '#dbeaff', toneMapped: false, transparent: true, opacity: 0});
  const core: T.Vector3[] = [];
  for (let i = 0; i < 13; i++) core.push(new T.Vector3((rand() - 0.5) * 3.3, 52 - i * 4.1, (rand() - 0.5) * 2));
  function bolt(points: T.Vector3[], radius: number) {
    const mesh = new T.Mesh(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points, false, 'catmullrom', 0.03),
        points.length * 2,
        radius,
        4,
        false,
      ),
      boltMaterial,
    );
    lightning.add(mesh);
  }
  bolt(core, 0.075);
  for (let branch = 0; branch < 4; branch++) {
    const start = core[3 + branch * 2],
      fork = [start.clone()];
    for (let j = 1; j < 5; j++)
      fork.push(
        start.clone().add(new T.Vector3((branch % 2 ? 1 : -1) * j * (1.4 + rand()), -j * 2.8, (rand() - 0.5) * 2)),
      );
    bolt(fork, 0.027);
  }
  const lightningLight = new T.PointLight('#b9d8ff', 0, 120, 2);
  group.add(lightningLight);
  const transition = new WeatherTransition();
  function setWeather(weather: Weather) {
    transition.set(weather, time.value);
  }
  const look = new T.Vector3(),
    anchor = new T.Vector3();
  function update(t: number, camera: T.Camera) {
    const elapsed = Math.max(0, Math.min(0.25, t - time.value));
    time.value = t;
    const weatherLook = transition.sample(t);
    cloud.value = weatherLook.cloud;
    storm.value = weatherLook.storm;
    waterTime.value += elapsed * (0.55 + storm.value * 0.55);
    wind.value = weatherLook.wind;
    rainMat.uniforms.density.value = weatherLook.rain;
    rain.visible = weatherLook.rain > 0.001;
    lightning.visible = weatherLook.lightning > 0.001;
    sky.position.copy(camera.position);
    rainMat.uniforms.anchor.value.copy(camera.position);
    const cycle = Math.floor(t / 9.7),
      phase = t % 9.7;
    const strike = phase < 0.09 ? 1 : phase > 0.18 && phase < 0.25 ? 0.55 : phase > 0.39 && phase < 0.44 ? 0.24 : 0;
    boltMaterial.opacity = strike * weatherLook.lightning;
    flash.value = strike * 0.57 * weatherLook.lightning;
    lightningLight.intensity = strike * 22 * weatherLook.lightning;
    camera.getWorldDirection(look);
    look.y = 0;
    if (look.lengthSq() < 0.001) look.set(0, 0, -1);
    look.normalize();
    anchor.copy(camera.position).addScaledVector(look, 100);
    anchor.y = 0;
    const side = Math.sin(cycle * 2.39996) * 32;
    anchor.x += look.z * side;
    anchor.z -= look.x * side;
    lightning.position.copy(anchor);
    lightning.rotation.y = cycle * 2.39996;
    lightningLight.position.copy(anchor).add(new T.Vector3(0, 30, 0));
  }
  setWeather('clear');
  return {
    group,
    waterMat,
    sky,
    water,
    rain,
    setWeather,
    update,
    golden,
    sunDirection,
    wind,
    look: transition.current,
    audioTransition: transition.blend,
  };
}
