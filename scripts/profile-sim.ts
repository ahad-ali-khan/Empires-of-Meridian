import {performance} from 'node:perf_hooks';
import {createMatch,step,createSnapshot} from '../packages/sim/src/index';

// Repeatable CPU sample. This is not a GPU or end-to-end FPS benchmark.
const state=createMatch({v:1,seed:73,difficulty:'standard',mode:'skirmish',populationCap:200,gameSpeed:1});
let start=performance.now();
for(let i=0;i<600;i++)step(state,[]);
const stepMs=(performance.now()-start)/600;
start=performance.now();
for(let i=0;i<100;i++)createSnapshot(state,1,false);
console.log(JSON.stringify({seed:73,entities:state.entities.length,stepMs,liveSnapshotMs:(performance.now()-start)/100},null,2));
