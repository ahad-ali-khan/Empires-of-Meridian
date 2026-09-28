import {checksum, createMatch, step} from '../packages/sim/src/index';
import {chooseIntent, featuresFor, DEFAULT_AI_POLICY} from '../packages/sim/src/ai-policy';

const matchCount = Math.max(1, Number(process.env.AI_EVAL_MATCHES ?? 40));
const tickBudget = Math.max(1, Number(process.env.AI_EVAL_TICKS ?? 3600));
const seeds = Array.from({length: matchCount}, (_, i) => 7000 + i);
const reports = seeds.map((seed) => {
  const state = createMatch({
    v: 1,
    seed,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 120,
    gameSpeed: 1,
    mapSize: 'small',
    fogOfWar: true,
    aiCount: 1,
  });
  for (let tick = 0; tick < tickBudget && !state.winner; tick++) step(state, []);
  const traces = state.aiTrace.filter((trace) => trace.playerId === 2);
  const goals = [...new Set(traces.map((trace) => trace.goal))];
  const routes = new Set(traces.map((trace) => trace.routeIndex)).size;
  const targets = new Set(traces.map((trace) => trace.targetId).filter((id): id is number => id !== undefined)).size;
  const firstEngagement = traces.find((trace) => trace.goal === 'engage')?.tick ?? null;
  const attackCommands = state.commandLog.filter(
    (command) => command.playerId === 2 && command.type === 'attack',
  ).length;
  const rejectedCommands = state.events.filter((event) => event.kind === 'rejected' && event.owner === 2).length;
  const player = state.players[1];
  return {
    seed,
    ticks: state.tick,
    winner: state.winner,
    goals,
    routeVariety: routes,
    targetVariety: targets,
    firstEngagement,
    attackCommands,
    rejectedCommands,
    resources: Object.values(player.resources).reduce((sum, value) => sum + value, 0),
    checksum: checksum(state),
    sampledIntent: chooseIntent(DEFAULT_AI_POLICY, featuresFor(state, 2)),
  };
});

const completed = reports.filter((report) => report.winner !== null).length;
const goalVariety = new Set(reports.flatMap((report) => report.goals)).size;
const engaged = reports.filter((report) => report.firstEngagement !== null).length;
console.log(
  JSON.stringify(
    {
      matches: reports.length,
      tickBudget,
      completed,
      goalVariety,
      engaged,
      totalAttackCommands: reports.reduce((sum, report) => sum + report.attackCommands, 0),
      totalRejectedCommands: reports.reduce((sum, report) => sum + report.rejectedCommands, 0),
      averageResources: Math.round(reports.reduce((sum, report) => sum + report.resources, 0) / reports.length),
      reports,
    },
    null,
    2,
  ),
);
