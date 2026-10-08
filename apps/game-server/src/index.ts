import Fastify from 'fastify';
import {Room} from '@colyseus/core';
import {checksum, createMatch, step, type MatchState} from '../../../packages/sim/src/index.ts';
import {PROTOCOL_VERSION, type Command, type MatchConfig} from '../../../packages/protocol/src/index.ts';

export class DeterministicFixtureRoom extends Room {
  declare state: MatchState;
  private pending: Command[] = [];
  onCreate(options: Partial<MatchConfig> = {}) {
    this.state = createMatch({
      v: 1,
      mode: 'skirmish',
      seed: options.seed ?? 1,
      difficulty: options.difficulty ?? 'standard',
      populationCap: options.populationCap ?? 120,
      gameSpeed: 1,
      aiCount: 0,
    });
    this.pending = [];
    this.setSimulationInterval(() => {
      const accepted = this.pending.filter((command) => command.tick <= this.state.tick + 1);
      this.pending = this.pending.filter((command) => command.tick > this.state.tick + 1);
      step(
        this.state,
        accepted.sort((a, b) => a.tick - b.tick || a.playerId - b.playerId || a.sequence - b.sequence),
      );
    }, 50);
    this.onMessage('command', (_client, command: Command) => {
      if (!command || command.v !== 1 || command.playerId !== 1 || command.type === 'offline-cheat') return;
      this.pending.push({...command, tick: this.state.tick + 1});
    });
  }
}

const app = Fastify({logger: true});
const port = Number(process.env.GAME_SERVER_PORT ?? 2567);
app.get('/health', async () => ({ok: true, service: 'game-server', protocolVersion: PROTOCOL_VERSION}));
app.get('/fixture', async () => {
  const state = createMatch({
    v: 1,
    mode: 'skirmish',
    seed: 73,
    difficulty: 'standard',
    populationCap: 120,
    gameSpeed: 1,
  });
  for (let i = 0; i < 200; i++) step(state, []);
  return {ok: true, tick: state.tick, checksum: checksum(state)};
});
if (process.env.NODE_ENV !== 'test')
  app.listen({host: '127.0.0.1', port}).catch((error) => {
    app.log.error(error);
    process.exitCode = 1;
  });
export {app};
