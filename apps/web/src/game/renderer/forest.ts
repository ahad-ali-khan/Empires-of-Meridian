import * as T from 'three';
import {foliageDepth,foliageTime,foliageWind} from '../../../../../packages/asset-tools/src/nature';

// Multi-view impostors are baked from the original models, never substitute art.
// A 384px source is only used below 340 physical pixels on screen.
const TILE=384,COLUMNS=8,ROWS=4;
export function createForest(renderer:T.WebGLRenderer,variants:T.Group[],trees:T.Group[]){
  const group=new T.Group(),frustum=new T.Frustum(),vp=new T.Matrix4(),sphere=new T.Sphere();
  const bakeScene=new T.Scene(),sun=new T.DirectionalLight('#ffe0ad',3.1),fill=new T.HemisphereLight('#cbdde2','#70734c',2);
  sun.position.set(-32,62,28);sun.castShadow=true;sun.shadow.mapSize.set(512,512);Object.assign(sun.shadow.camera,{left:-7,right:7,top:10,bottom:-5,near:.1,far:130});sun.shadow.bias=-.0003;sun.shadow.normalBias=.02;bakeScene.add(sun,fill,sun.target);
  const bakeCamera=new T.OrthographicCamera(-1,1,1,-1,.1,60);
  const entries=variants.map((model,index)=>{
    const records=trees.filter(t=>t.userData.variant===index);records.forEach(t=>t.updateMatrixWorld(true));
    const bounds=new T.Box3().setFromObject(model),center=bounds.getCenter(new T.Vector3());
    const diameter=bounds.getSize(new T.Vector3()).length()*1.06;
    const target=new T.WebGLRenderTarget(TILE*COLUMNS,TILE*ROWS,{minFilter:T.LinearMipmapLinearFilter,magFilter:T.LinearFilter,generateMipmaps:true,depthBuffer:true});
    target.texture.name=`Tree ${index} multiview atlas`;
    const shared={center:{value:center},diameter:{value:diameter},foliageTime,foliageWind};
    const shader=(s:{uniforms:Record<string,unknown>;vertexShader:string})=>{
      Object.assign(s.uniforms,shared);
      s.vertexShader=`uniform vec3 center;uniform float diameter;uniform float foliageTime;uniform float foliageWind;\n`+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
        vec3 eye=vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2]);
        vec3 localEye=vec3(dot(eye,normalize(instanceMatrix[0].xyz)),eye.y,dot(eye,normalize(instanceMatrix[2].xyz)));
        float az=mod(floor(atan(localEye.x,localEye.z)*${COLUMNS.toFixed(1)}/6.2831853+.5)+${COLUMNS.toFixed(1)},${COLUMNS.toFixed(1)});
        float el=clamp(floor(asin(clamp(eye.y,-1.,1.))/0.4363323+.5),0.,3.);
        vMapUv=(uv*.992+.004+vec2(az,el))/vec2(8.,4.);`);
      s.vertexShader=s.vertexShader.replace('#include <project_vertex>',`
        float scale=length(instanceMatrix[0].xyz);
        vec4 mvPosition=modelViewMatrix*instanceMatrix*vec4(center,1.);
        vec2 offset=position.xy*diameter*scale;
        offset.x+=sin(foliageTime*1.25+center.y*.45)*pow(max(uv.y-.15,0.),2.)*.18*foliageWind*scale;
        mvPosition.xy+=offset;
        gl_Position=projectionMatrix*mvPosition;`);
    };
    const material=new T.MeshBasicMaterial({map:target.texture,alphaTest:.32,side:T.DoubleSide});
    material.onBeforeCompile=shader;material.customProgramCacheKey=()=> 'meridian-tree-impostor-1';
    const depth=new T.MeshDepthMaterial({map:target.texture,alphaTest:.32,depthPacking:T.RGBADepthPacking,side:T.DoubleSide});depth.onBeforeCompile=shader;
    const billboard=new T.InstancedMesh(new T.PlaneGeometry(1,1),material,records.length);billboard.customDepthMaterial=depth;
    billboard.frustumCulled=false;billboard.castShadow=true;billboard.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(billboard);
    const parts:T.InstancedMesh[]=[];
    model.traverse(o=>{if(o instanceof T.Mesh){const inst=new T.InstancedMesh(o.geometry,o.material,records.length);inst.customDepthMaterial=o.customDepthMaterial??foliageDepth;inst.castShadow=true;inst.receiveShadow=true;inst.frustumCulled=false;inst.instanceMatrix.setUsage(T.DynamicDrawUsage);parts.push(inst);group.add(inst);}});
    return {records,model,center,diameter,target,billboard,parts,material,depth};
  });
  function bake(light?:T.DirectionalLight,hemisphere?:T.HemisphereLight){
    if(light){sun.color.copy(light.color);sun.intensity=light.intensity;sun.position.copy(light.position);}if(hemisphere){fill.color.copy(hemisphere.color);fill.groundColor.copy(hemisphere.groundColor);fill.intensity=hemisphere.intensity;}
    const oldTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(new T.Vector4()),scissor=renderer.getScissor(new T.Vector4()),scissorTest=renderer.getScissorTest(),color=renderer.getClearColor(new T.Color()),alpha=renderer.getClearAlpha(),tone=renderer.toneMapping,shadows=renderer.shadowMap.enabled;
    renderer.toneMapping=T.NoToneMapping;renderer.shadowMap.enabled=true;renderer.setClearColor(0,0);
    for(const e of entries){
      bakeScene.add(e.model);renderer.shadowMap.needsUpdate=true;const d=e.diameter/2;Object.assign(bakeCamera,{left:-d,right:d,top:d,bottom:-d});bakeCamera.updateProjectionMatrix();
      e.target.viewport.set(0,0,TILE*COLUMNS,TILE*ROWS);e.target.scissorTest=false;renderer.setRenderTarget(e.target);renderer.clear();e.target.scissorTest=true;
      for(let y=0;y<ROWS;y++)for(let x=0;x<COLUMNS;x++){
        const az=x/COLUMNS*Math.PI*2,el=y*25*Math.PI/180;
        bakeCamera.position.set(Math.sin(az)*Math.cos(el)*20,Math.sin(el)*20,Math.cos(az)*Math.cos(el)*20).add(e.center);bakeCamera.lookAt(e.center);
        // Shadow rendering restores the target's viewport/scissor, so keep the
        // tile on the target itself rather than only setting renderer state.
        e.target.viewport.set(x*TILE,y*TILE,TILE,TILE);e.target.scissor.copy(e.target.viewport);renderer.setRenderTarget(e.target);renderer.render(bakeScene,bakeCamera);
      }
      bakeScene.remove(e.model);
    }
    renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(color,alpha);renderer.toneMapping=tone;renderer.shadowMap.enabled=shadows;renderer.shadowMap.needsUpdate=true;
  }
  function update(camera:T.PerspectiveCamera,pixelHeight:number){
    camera.updateMatrixWorld();vp.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(vp);
    const focal=pixelHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov/2)));
    for(const e of entries){let near=0,far=0;
      for(const tree of e.records){
        sphere.center.copy(e.center).applyMatrix4(tree.matrixWorld);sphere.radius=e.diameter*tree.scale.x*.5;
        const pixels=e.diameter*tree.scale.x*focal/Math.max(1,camera.position.distanceTo(sphere.center));
        // Keep off-camera shadow casters, but their two-triangle impostor is sufficient.
        if(frustum.intersectsSphere(sphere)&&pixels>340){for(const part of e.parts)part.setMatrixAt(near,tree.matrixWorld);near++;}
        else {e.billboard.setMatrixAt(far++,tree.matrixWorld);}
      }
      e.billboard.count=far;e.billboard.instanceMatrix.needsUpdate=true;
      for(const part of e.parts){part.count=near;part.instanceMatrix.needsUpdate=true;}
    }
  }
  bake();
  return {group,bake,update,dispose(){sun.shadow.dispose();for(const e of entries){e.target.dispose();e.material.dispose();e.depth.dispose();e.billboard.geometry.dispose();}}};
}
