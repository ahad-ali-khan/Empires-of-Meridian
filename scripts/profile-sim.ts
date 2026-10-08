import {performance} from 'node:perf_hooks';
import {checksum, createMatch, step, createSnapshot} from '../packages/sim/src/index';
import type {Command} from '../packages/protocol/src/index';

// Repeatable CPU sample. This is not a GPU or end-to-end FPS benchmark.
// node --import tsx scripts/profile-sim.ts [ticks] [ai opponents]
const ticks = Number(process.argv[2] ?? 3600);
const aiCount = Number(process.argv[3] ?? 1) as 0 | 1 | 2 | 3;
const seed = 73;
const createdAt = performance.now();
const state = createMatch({
  v: 1,
  seed,
  aiCount,
  difficulty: 'standard',
  mode: 'skirmish',
  populationCap: 200,
  gameSpeed: 1,
});
const setupMs = performance.now() - createdAt;
const workers = state.entities.filter((e) => e.owner === 1 && e.kind === 'worker');
const commands: Command[] = workers.map((worker, i) => {
  const kind = ['provisions', 'timber', 'coin'][i % 3];
  const resource = state.entities
    .filter((e) => e.kind === kind && e.amount > 0)
    .sort(
      (a, b) =>
        (a.x - worker.x) ** 2 + (a.z - worker.z) ** 2 - ((b.x - worker.x) ** 2 + (b.z - worker.z) ** 2) || a.id - b.id,
    )[0];
  return {v: 1, tick: 1, playerId: 1, sequence: i + 1, type: 'gather', entityIds: [worker.id], targetId: resource.id};
});
const windows = [];
let windowAt = performance.now();
for (let i = 0; i < ticks; i++) {
  step(state, i === 0 ? commands : []);
  if ((i + 1) % 600 !== 0) continue;
  const stepMs = (performance.now() - windowAt) / 600;
  const snapshotAt = performance.now();
  let snapshotEntities = 0;
  for (let sample = 0; sample < 30; sample++) snapshotEntities = createSnapshot(state, 1, false).entities.length;
  windows.push({
    tick: state.tick,
    entities: state.entities.length,
    snapshotEntities,
    stepMs,
    liveSnapshotMs: (performance.now() - snapshotAt) / 30,
    checksum: checksum(state),
  });
  windowAt = performance.now();
}
console.log(JSON.stringify({seed, aiCount, setupMs, windows}, null, 2));
