import Fastify from 'fastify';
import pg from 'pg';
import {createClient} from 'redis';
import {CONTENT_VERSION,buildings,units} from '../../../packages/content/src/index.ts';
import {PROTOCOL_VERSION} from '../../../packages/protocol/src/index.ts';

const port=Number(process.env.API_PORT??8787);
const app=Fastify({logger:true});

async function dependencies(){
 const result={postgres:false,redis:false};
 if(process.env.DATABASE_URL){const client=new pg.Client({connectionString:process.env.DATABASE_URL});try{await client.connect();await client.query('select 1');result.postgres=true;}finally{await client.end().catch(()=>undefined);}}
 if(process.env.REDIS_URL){const client=createClient({url:process.env.REDIS_URL});try{await client.connect();await client.ping();result.redis=true;}finally{await client.quit().catch(()=>undefined);}}
 return result;
}

app.get('/health',async()=>({ok:true,service:'api',protocolVersion:PROTOCOL_VERSION}));
app.get('/ready',async(_request,reply)=>{try{const checks=await dependencies();const configured=Boolean(process.env.DATABASE_URL&&process.env.REDIS_URL);if(configured&&(!checks.postgres||!checks.redis))return reply.code(503).send({ok:false,checks});return {ok:true,checks,mode:configured?'stack':'offline-development'};}catch(error){return reply.code(503).send({ok:false,error:error instanceof Error?error.message:'readiness failure'});}});
app.get('/content/manifest',async()=>({contentVersion:CONTENT_VERSION,protocolVersion:PROTOCOL_VERSION,units:units.map(x=>x.id),buildings:buildings.map(x=>x.id)}));

if(process.env.NODE_ENV!=='test')app.listen({host:'127.0.0.1',port}).catch(error=>{app.log.error(error);process.exitCode=1;});
export {app};
