import {buildingById} from '../../content/src/index';
import type {Command, ResourceKind} from '../../protocol/src/index';
import type {MatchState} from './index';
import {updateVision} from './visibility';

/** The offline host opts in; normal fixtures and network matches reject these commands. */
export function applyOfflineCheat(state: MatchState, command: Extract<Command, {type: 'offline-cheat'}>): string {
  if (
    !state.config.offlineCheats ||
    state.config.mode !== 'skirmish' ||
    (state.config.aiCount ?? 1) < 1 ||
    command.playerId !== 1
  )
    return 'Cheats are available only in offline skirmishes against AI.';
  if (
    !Array.isArray(command.entityIds) ||
    command.entityIds.length > 300 ||
    !command.entityIds.every(Number.isSafeInteger)
  )
    return 'Invalid cheat selection.';
  const player = state.players[0],
    selected = new Set(command.entityIds),
    targets = state.entities.filter((e) => e.owner === 1 && e.hp > 0 && (!selected.size || selected.has(e.id)));
  if (command.cheat === 'resources') {
    for (const kind of Object.keys(player.resources) as ResourceKind[]) player.resources[kind] += 100000;
  } else if (command.cheat === 'tokens') player.tokens += 5;
  else if (command.cheat === 'heal') {
    for (const entity of targets) if (entity.progress === 10000) entity.hp = entity.maxHp;
  } else if (command.cheat === 'construction') {
    for (const entity of targets) {
      if (entity.category !== 'building' || entity.progress === 10000) continue;
      entity.progress = 10000;
      entity.hp = entity.maxHp;
      entity.task = 'idle';
      player.populationCap = Math.min(
        state.config.populationCap,
        player.populationCap + (buildingById.get(entity.kind)?.population ?? 0),
      );
    }
  } else if (command.cheat === 'production') {
    // Normal completion still enforces population, spawn positions and technology effects.
    for (const entity of targets) for (const item of entity.queue) item.remaining = Math.min(1, item.remaining);
  } else if (command.cheat === 'reveal') {
    state.config.fogOfWar = false;
    updateVision(state);
  } else return 'Unknown offline cheat.';
  player.cheatsUsed = (player.cheatsUsed ?? 0) + 1;
  return '';
}
