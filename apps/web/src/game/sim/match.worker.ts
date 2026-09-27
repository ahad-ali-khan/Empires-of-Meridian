/// <reference lib="webworker" />
import {
  createMatch,
  createSnapshot,
  restoreSave,
  serializeSave,
  step,
  type MatchState,
} from '../../../../../packages/sim/src/index';
import type {Command, WorkerRequest, WorkerResponse} from '../../../../../packages/protocol/src/index';

let state: MatchState | undefined,
  queued: Command[] = [],
  paused = false;
let timer: number | undefined;
function post(message: WorkerResponse) {
  self.postMessage(message);
}
function start() {
  if (timer) clearInterval(timer);
  timer = setInterval(
    () => {
      if (!state || paused) return;
      step(state, queued);
      queued = [];
      if (state.tick % 2 === 0) post({type: 'snapshot', snapshot: createSnapshot(state, 1, false)});
    },
    50 / (state?.config.gameSpeed ?? 1),
  ) as unknown as number;
}
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  try {
    const msg = event.data;
    if (msg.type === 'create' && msg.config) {
      state = createMatch(msg.config);
      queued = [];
      paused = false;
      start();
      post({type: 'snapshot', snapshot: createSnapshot(state, 1, false)});
    } else if (msg.type === 'commands' && msg.commands)
      queued.push(...msg.commands.map((command) => ({...command, tick: (state?.tick ?? 0) + 1})));
    else if (msg.type === 'save' && state) post({type: 'saved', save: serializeSave(state)});
    else if (msg.type === 'load' && msg.save) {
      state = restoreSave(msg.save);
      queued = [];
      paused = false;
      start();
      post({type: 'snapshot', snapshot: createSnapshot(state, 1, false)});
    } else if (msg.type === 'pause') paused = true;
    else if (msg.type === 'resume') paused = false;
  } catch (error) {
    post({type: 'error', message: error instanceof Error ? error.message : String(error)});
  }
};
