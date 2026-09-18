import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Showcase, assetInfo, type Light, type Metrics, type View} from './game/renderer/showcase';
import type {AssetKind} from '../../../packages/asset-tools/src/models';
import type {Weather} from './game/renderer/environment';
import type {Clip} from '../../../packages/asset-tools/src/actors';
import {clipsFor,conditionsFor,buildingKinds,eras,type Condition} from '../../../packages/asset-tools/src/extended';
import {agesFor,defaultAge,unlockAge,militiaUpgrade} from '../../../packages/asset-tools/src/ages';
import {roles,ageDescription} from '../../../packages/asset-tools/src/catalog';
import './style.css';

const assets=Object.keys(assetInfo) as AssetKind[];

function App(){
  const host=useRef<HTMLDivElement>(null), engine=useRef<Showcase|null>(null);
  const [view,setViewState]=useState<View>('settlement'),[asset,setAssetState]=useState<AssetKind>('hall');
  const [light,setLightState]=useState<Light>('day'),[metrics,setMetrics]=useState<Metrics|null>(null);
  const [search,setSearch]=useState('');
  const [hunter,setHunter]=useState<AssetKind>('villager');
  const [comparisonScale,setComparisonScale]=useState(false);
  const [assetAge,setAssetAge]=useState(defaultAge('hall')),[condition,setCondition]=useState<Condition>('intact');
  const [ready,setReady]=useState(false),[hud,setHud]=useState(true),[motion,setMotion]=useState(true),[wire,setWire]=useState(false);
  const [weather,setWeatherState]=useState<Weather>('clear'),[clip,setClipState]=useState<Clip>('idle'),[quality,setQuality]=useState('high');
  useEffect(()=>{if(!host.current)return;const game=new Showcase(host.current,setMetrics,k=>{setAssetState(k);setAssetAge(defaultAge(k));setCondition('intact');setViewState('studio');game.setView('studio');game.setAsset(k);},()=>setReady(true));engine.current=game;return()=>game.dispose();},[]);
  const setView=(v:View)=>{setViewState(v);engine.current?.setView(v);if(v==='studio'){setCondition('intact');engine.current?.setAsset(asset,assetAge)}};
  const setAsset=(a:AssetKind,age=defaultAge(a))=>{setAssetState(a);setAssetAge(age);setCondition('intact');setClipState('idle');engine.current?.setClip('idle');setViewState('studio');engine.current?.setView('studio');engine.current?.setAsset(a,age)};
  const setLight=(l:Light)=>{setLightState(l);engine.current?.setLight(l)};
  const setWeather=(w:Weather)=>{setWeatherState(w);engine.current?.setWeather(w)};
  const setClip=(c:Clip)=>{setClipState(c);engine.current?.setClip(c)};
  const clips=clipsFor(asset);
  return <main className={view==='studio'?'studio-mode':''}>
    <div ref={host} className="viewport"/>
    <header className="topbar">
      <div className="brand"><img src="/crest.svg"/><div><span>Empires of</span><strong>MERIDIAN</strong></div></div>
      <nav aria-label="Scene views">
        {(['settlement','harbor','regiment','resources','sky','studio'] as View[]).map(v=><button key={v} aria-pressed={view===v} className={view===v?'active':''} onClick={()=>setView(v)}>{v==='studio'?'Asset forge':v==='sky'?'Horizon':v}</button>)}
      </nav>
      <div className="status"><i/> AURELIAN COAST · LIVE</div>
    </header>
    {view!=='studio'&&<section className="title">
      <div className="eyebrow"><span/> FIRST LIGHT · VISUAL PROTOTYPE <span/></div>
      <h1>The Aurelian Coast</h1>
      <p>A prosperous league settlement on Meridian’s western frontier.</p>
    </section>}
    <aside className="controls panel">
      <div className="panel-title">FIELD LENS <button onClick={()=>setHud(!hud)}>{hud?'HIDE':'SHOW'}</button></div>
      <label>LIGHT</label><div className="segmented">{(['day','golden','overcast'] as Light[]).map(l=><button className={light===l?'selected':''} onClick={()=>setLight(l)} key={l}>{l}</button>)}</div>
      <label>WEATHER</label><div className="segmented">{(['clear','rain','storm'] as Weather[]).map(w=><button aria-pressed={weather===w} className={weather===w?'selected':''} onClick={()=>setWeather(w)} key={w}>{w}</button>)}</div>
      {view!=='studio'&&<><label>RESOURCE SANDBOX</label><select aria-label="Hunting unit" value={hunter} onChange={e=>setHunter(e.target.value as AssetKind)}><option value="villager">Worker</option><option value="infantry">Fusilier</option><option value="cavalry">Lancer</option></select><div className="segmented clip-grid"><button onClick={()=>engine.current?.hunt('sheep',hunter)}>Hunt sheep</button><button onClick={()=>engine.current?.hunt('deer',hunter)}>Hunt deer</button><button onClick={()=>engine.current?.resetResources()}>Restore</button></div><p className="demo-status" aria-live="polite">{metrics?.demo}</p></>}
      {view==='studio'&&clips.length>0&&<><label>ANIMATION</label><div className="segmented clip-grid">{clips.map(c=><button aria-pressed={clip===c} className={clip===c?'selected':''} key={c} onClick={()=>setClip(c)}>{c}</button>)}</div></>}
      {view==='studio'&&conditionsFor(asset).length>0&&<><label>CONDITION</label><div className="segmented clip-grid">{conditionsFor(asset).map(c=><button key={c} aria-pressed={condition===c} className={condition===c?'selected':''} onClick={()=>{setCondition(c);engine.current?.setCondition(c)}}>{c}</button>)}</div></>}
      {view==='studio'&&agesFor(asset).length>0&&<><label>AGE · UNLOCKS {eras[(unlockAge[asset]||1)-1].toUpperCase()}</label><select value={assetAge} aria-label="Asset age" onChange={e=>{const age=Number(e.target.value);setAssetAge(age);setCondition('intact');engine.current?.setEra(age)}}>{agesFor(asset).map(age=><option value={age} key={age}>{age} · {eras[age-1]}</option>)}</select></>}
      {view==='studio'&&asset==='barracks'&&<><label>TRAINING PREVIEW</label><div className="segmented clip-grid">{assetAge<=3&&<button onClick={()=>setAsset('militia',assetAge)}>Militia</button>}{assetAge>=2&&assetAge<=3&&<button onClick={()=>setAsset('swordsman',assetAge)}>Swordsman · researched</button>}{assetAge===4&&<button onClick={()=>setAsset('infantry',4)}>Fusilier</button>}</div></>}
      {view==='studio'&&asset==='militia'&&<><label>UNIT UPGRADE PREVIEW</label><div className="segmented"><button disabled={assetAge<militiaUpgrade.age} onClick={()=>setAsset('swordsman',assetAge)}>Forged blades → Swordsman{assetAge<2?' · requires Classical':''}</button></div></>}
      <label>RENDER</label><div className="toggles">
        <button aria-pressed={motion} className={motion?'selected':''} onClick={()=>{setMotion(!motion);engine.current?.setMotion(!motion)}}>{motion?'Pause motion':'Resume motion'}</button>
        <button className={wire?'selected':''} onClick={()=>{setWire(!wire);engine.current?.setWireframe(!wire)}}>Wireframe</button>
      </div>
      {view==='studio'&&<div className="toggles"><button aria-pressed={comparisonScale} className={comparisonScale?'selected':''} onClick={()=>{setComparisonScale(!comparisonScale);engine.current?.setComparisonScale(!comparisonScale)}}>{comparisonScale?'Shared world scale':'Compare building sizes'}</button></div>}
      <label className="quality-label">QUALITY <select aria-label="Rendering quality" value={quality} onChange={e=>{setQuality(e.target.value);engine.current?.setQuality(e.target.value)}}><option value="high">High</option><option value="low">Low</option></select></label>
      <button className="capture" onClick={()=>engine.current?.capture()}>CAPTURE FRAME <span>↗</span></button>
    </aside>
    {view==='studio'&&<aside className="catalog panel">
      <div className="panel-title">ASSET FORGE <span>{String(assets.indexOf(asset)+1).padStart(2,'0')} / {assets.length}</span></div>
      <input aria-label="Search assets" placeholder="Search units, buildings, wildlife…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <div className="asset-list">{assets.filter(a=>(assetInfo[a].name+' '+assetInfo[a].category).toLowerCase().includes(search.toLowerCase())).map(a=><button className={asset===a?'selected':''} onClick={()=>setAsset(a)} key={a}><small>{assetInfo[a].category}</small>{assetInfo[a].name}</button>)}</div>
    </aside>}
    {view==='studio'&&<section className="asset-card">
      <span>{assetInfo[asset].category}</span><h2>{assetInfo[asset].name}</h2><p>{roles[asset]||assetInfo[asset].description}</p>
      <p className="unlock-description">{ageDescription(asset)}</p><div><b>DESIGN ROLE · VISUAL SANDBOX</b></div>
    </section>}
    {hud&&metrics&&<aside className="metrics panel" data-performance={JSON.stringify(metrics)}>
      <div><strong>{metrics.fps}</strong><span>FPS</span></div><div><strong>{metrics.drawCalls}</strong><span>DRAWS</span></div><div><strong>{Math.round(metrics.triangles/1000)}K</strong><span>TRIS</span></div><div><strong>{metrics.units}</strong><span>UNITS</span></div>
      <footer>{metrics.backend} · {metrics.trees} trees · {quality.toUpperCase()}</footer>
    </aside>}
    <div className="compass"><b>N</b><i/><span>W</span><span>E</span></div>
    <footer className="hint"><span>DRAG</span> ORBIT <i/> <span>SCROLL</span> ZOOM <i/> <span>WASD</span> PAN <i/> <span>CLICK BUILDING</span> INSPECT</footer>
    {!ready&&<div className="loader"><img src="/crest.svg"/><span>BUILDING THE COAST</span><div><i/></div></div>}
  </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
