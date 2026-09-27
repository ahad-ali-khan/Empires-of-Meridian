import {expect, test} from 'vitest';
import * as T from 'three';
import {buildAsset, type AssetKind} from '../../packages/asset-tools/src/models';
import {buildings, units} from '../../packages/content/src/index';
import {createMatch, step} from '../../packages/sim/src/index';
import type {Command} from '../../packages/protocol/src/index';

test('every playable definition has an authored model at its unlock age', () => {
  for (const definition of [...buildings, ...units]) {
    const model = buildAsset(definition.model as AssetKind, definition.age);
    let vertices = 0;
    model.traverse((object) => {
      if (object instanceof T.Mesh) vertices += object.geometry.attributes.position.count;
    });
    expect(vertices, `${definition.id} → ${definition.model} at age ${definition.age}`).toBeGreaterThan(24);
  }
});

test('the playable progression reaches Industrial and exposes Industrial content', () => {
  const state = createMatch({
    v: 1,
    seed: 91,
    difficulty: 'standard',
    mode: 'skirmish',
    populationCap: 200,
    gameSpeed: 1,
    aiCount: 0,
    fogOfWar: false,
  });
  const choices = ['harvest-council', 'field-command', 'industrial-guilds'];
  for (const councilId of choices) {
    Object.assign(state.players[0].resources, {provisions: 200000, timber: 200000, coin: 200000, metal: 200000});
    const command: Command = {
      v: 1,
      tick: state.tick + 1,
      sequence: state.tick + 1,
      playerId: 1,
      type: 'advance',
      councilId,
    };
    step(state, [command]);
    for (let i = 0; i < 600; i++) step(state, []);
  }
  expect(state.players[0].age).toBe(4);
  expect(state.players[0].modifiers).toContain('industrial-production');
  expect(buildings.some((building) => building.id === 'factory' && building.age === 4)).toBe(true);
  expect(units.some((unit) => unit.id === 'veteranRifle' && unit.age === 4)).toBe(true);

  const barracks = state.entities.find((e) => e.owner === 1 && e.kind === 'barracks')!;
  barracks.queue = [{kind: 'veteranRifle', remaining: 100, total: 100}];
  step(state, []);
  expect(barracks.queue[0]?.remaining).toBe(98);
});
