import {spawn,type ChildProcess} from 'node:child_process';

const children:ChildProcess[]=[];
function run(command:string,args:string[],env=process.env){const child=spawn(command,args,{stdio:'inherit',env});children.push(child);return child;}
function stop(){for(const child of children)child.kill('SIGTERM');spawn('docker',['compose','down'],{stdio:'inherit'});}
process.once('SIGINT',stop);process.once('SIGTERM',stop);

const docker=run('docker',['compose','up','-d','--wait']);
docker.once('exit',code=>{
 if(code!==0){console.error('Docker services did not become healthy. Install and start Docker Desktop, then rerun pnpm stack.');process.exitCode=1;return;}
 const env={...process.env,DATABASE_URL:'postgres://meridian:meridian_local@127.0.0.1:5432/meridian',REDIS_URL:'redis://127.0.0.1:6379'};
 run('pnpm',['dev:api'],env);run('pnpm',['dev:game-server'],env);run('pnpm',['dev:web'],env);
});
