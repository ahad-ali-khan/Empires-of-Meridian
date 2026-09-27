import * as T from 'three';
import {random} from './layout';
export type Weather='clear'|'overcast'|'rain'|'storm';
const noiseGLSL=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return n;}
`;
export function createEnvironment(){
  const group=new T.Group();
  const time={value:0},cloud={value:.20},storm={value:0},flash={value:0},golden={value:0},wind={value:1},sunDirection={value:new T.Vector3(-32,62,28).normalize()};
  const skyMat=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{time,cloud,storm,golden,sunDirection},vertexShader:`varying vec3 world;void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,fragmentShader:`
  varying vec3 world;uniform float time,cloud,storm,flash,golden;uniform vec3 sunDirection;
  ${noiseGLSL}
  void main(){vec3 d=normalize(world-cameraPosition);float elevation=max(d.y,0.);
    vec3 horizon=mix(vec3(.38,.60,.74),vec3(.88,.69,.43),golden*.65);
    vec3 zenith=mix(vec3(.035,.17,.40),vec3(.16,.29,.44),golden);
    vec3 col=mix(horizon,zenith,pow(elevation,.48));
    float sunDot=dot(d,sunDirection);float sun= smoothstep(.99935,.99975,sunDot);
    col+=vec3(1.,.85,.61)*pow(max(sunDot,0.),30.)*.17;
    col=mix(col,vec3(1.,.93,.75)*2.,sun);
    vec2 p=d.xz/max(.13,d.y+.16)*1.1+vec2(time*.007,time*.002);
    float shape=fbm(p*2.0),detail=fbm(p*7.0);
    float coverage=smoothstep(.56-cloud*.31,.73-cloud*.30,shape+detail*.14)*smoothstep(-.04,.16,d.y);
    vec3 cloudColor=mix(vec3(.99,.99,.94),vec3(.30,.37,.42),storm*.7);
    cloudColor*=.82+detail*.34;
    col=mix(col,cloudColor,coverage*(.83+cloud*.17));
    col=mix(col,col*vec3(.23,.30,.38),storm*.78);
    col+=vec3(.42,.55,.78)*flash;
    gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`});
  // Draw the sky after opaque depth is established, so covered pixels never run
  // the cloud noise shader on Apple's tile-based GPU.
  const sky=new T.Mesh(new T.SphereGeometry(720,32,20),skyMat);sky.renderOrder=10;group.add(sky);
  const waterMat=new T.ShaderMaterial({transparent:false,depthWrite:true,uniforms:{time,storm,golden,wind,sunDirection,shoal:{value:new T.Vector3(40,34,4.5)}},vertexShader:`
    varying vec3 world;uniform float time,storm;
    void main(){vec3 p=position;float amp=.025+storm*.035;p.z+=sin(p.x*.21+time*.8)*amp+sin(p.y*.27+time*.7)*amp;world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}
  `,fragmentShader:`
    varying vec3 world;uniform float time,storm,golden,wind;uniform vec3 sunDirection,shoal;
    ${noiseGLSL}
    void main(){vec2 p=world.xz;float t=time*(.65+storm*.6);
      float a=p.x*.53+p.y*.21+t, b=p.x*-.28+p.y*.67+t*.8,c=p.x*.97+p.y*-.41-t*.5;
      vec2 slope=vec2(.53,.21)*cos(a)*.075+vec2(-.28,.67)*cos(b)*.060+vec2(.97,-.41)*cos(c)*.024;
      slope+=vec2(noise(p*1.5+t*.08)-.5,noise(p*1.6-t*.06)-.5)*.028;
      vec3 n=normalize(vec3(-slope.x*(1.+storm),1.,-slope.y*(1.+storm)));
      vec3 v=normalize(cameraPosition-world),r=reflect(-v,n);
      float fresnel=.06+.70*pow(1.-max(dot(v,n),0.),4.);
      float shore=24.+sin(p.y*.065)*7.+sin(p.y*.16)*2.;float depth=max(0.,p.x-shore+4.0);
      vec3 base=mix(vec3(.23,.48,.40),vec3(.055,.22,.29),smoothstep(0.,21.,depth));
      vec3 reflection=mix(vec3(.59,.74,.79),vec3(.18,.39,.58),max(r.y,0.));
      reflection=mix(reflection,vec3(.32,.39,.42),storm*.7);
      vec3 col=mix(base,reflection,fresnel);
      // Broad continuous sun reflection follows the wave normal; no repeating dot grid.
      float highlight=pow(max(dot(reflect(-sunDirection,n),v),0.),90.);
      col+=vec3(.98,.86,.62)*highlight*.52*(1.-storm*.75);
      float shoreWave=sin(depth*2.4-t*.7+noise(p*.8)*1.5);
      float foam=(1.-smoothstep(.25,1.6,depth))*smoothstep(.4,.95,shoreWave)*.30;
      col=mix(col,vec3(.80,.85,.76),foam);
      col=mix(col,col*vec3(1.16,.94,.76),golden*.3);
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const water=new T.Mesh(new T.PlaneGeometry(1500,1500,180,180),waterMat);water.rotation.x=-Math.PI/2;water.position.y=.06;water.renderOrder=1;group.add(water);
  const rand=random(651),positions:number[]=[],ids:number[]=[],ends:number[]=[];
  for(let i=0;i<2600;i++){const x=(rand()-.5)*90,y=rand()*34,z=(rand()-.5)*90;positions.push(x,y,z,x,y,z);ids.push(i/2600,i/2600);ends.push(0,1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('dropId',new T.Float32BufferAttribute(ids,1));g.setAttribute('tail',new T.Float32BufferAttribute(ends,1));
  const rainMat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time,storm,density:{value:0},anchor:{value:new T.Vector3()}},vertexShader:`attribute float dropId,tail;varying float id;uniform float time,storm;uniform vec3 anchor;void main(){id=dropId;vec3 p=position;p.y=mod(p.y-time*(12.+storm*8.),34.);p.x+=mod(time*(2.+storm*4.),90.);p.x=mod(p.x+45.,90.)-45.;p+=vec3(.13+storm*.15,-.72,.05)*tail;p.xz+=anchor.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`varying float id;uniform float density;void main(){if(id>density)discard;gl_FragColor=vec4(.74,.84,.89,.24);}`});
  const rain=new T.LineSegments(g,rainMat);rain.frustumCulled=false;rain.visible=false;rain.renderOrder=3;group.add(rain);
  let activeWeather:Weather='clear';
  const lightning=new T.Group();group.add(lightning);
  const boltMaterial=new T.MeshBasicMaterial({color:'#d5e8ff',toneMapped:false,transparent:true,opacity:0});
  for(let branch=0;branch<3;branch++){const points:T.Vector3[]=[];for(let i=0;i<9;i++)points.push(new T.Vector3(-32+i*2+(rand()-.5)*3+branch*6,52-i*4,-64+(rand()-.5)*3));const bolt=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),16,branch===0?0.12:0.06,4,false),boltMaterial);bolt.frustumCulled=false;lightning.add(bolt);}
  const lightningLight=new T.PointLight('#b9d8ff',0,120,2);lightningLight.position.set(0,42,0);group.add(lightningLight);
  function setWeather(weather:Weather){activeWeather=weather;cloud.value=weather==='clear'?.2:weather==='overcast'?.8:1;storm.value=weather==='storm'?1:weather==='rain'?.4:0;wind.value=weather==='storm'?2.5:weather==='rain'?1.5:1;rain.visible=weather==='rain';rainMat.uniforms.density.value=weather==='rain'?.48:0;lightning.visible=weather==='storm';}
  function update(t:number,camera:T.Camera){time.value=t;rainMat.uniforms.anchor.value.copy(camera.position);const phase=t%7.2;const strike=phase<.16?1:phase>.29&&phase<.39?.65:0;boltMaterial.opacity=activeWeather==='storm'?strike:0;flash.value=activeWeather==='storm'?strike*.72:0;lightningLight.intensity=activeWeather==='storm'?strike*16:0;lightning.position.set(camera.position.x,camera.position.y*.12,camera.position.z-18);lightningLight.position.set(camera.position.x,camera.position.y+38,camera.position.z-10);}
  return {group,waterMat,sky,water,rain,setWeather,update,golden,sunDirection,wind};
}
