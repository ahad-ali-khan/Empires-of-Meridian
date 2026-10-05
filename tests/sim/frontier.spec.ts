import {expect, test} from 'vitest';
import {buildingById, unitById, frontierRules, treasureById} from '../../packages/content/src/index';
import {
  createMatch,
  step,
  checksum,
  serializeSave,
  restoreSave,
  createSnapshot,
  sitePayout,
  type Entity,
  type MatchState,
} from '../../packages/sim/src/index';
import {perimeterPoint} from '../../packages/sim/src/spatial';
import type {Command} from '../../packages/protocol/src/index';
function fixture() {
  const s = createMatch({
    v: 1,
    seed: 73,
    mode: 'skirmish',
    difficulty: 'standard',
    populationCap: 200,
    gameSpeed: 1,
    aiCount: 0,
    fogOfWar: false,
  });
  const base = structuredClone(s.entities.find((e) => e.kind === 'worker')!),
    hall = s.entities.find((e) => e.kind === 'hall')!;
  s.entities = [hall];
  s.players[0].resources = {provisions: 100000, timber: 100000, coin: 100000, metal: 100000};
  function actor(kind: string, x = base.x, z = base.z, owner: 1 | 2 = 1) {
    const d = unitById.get(kind)!;
    const e: Entity = {
      ...structuredClone(base),
      id: s.nextEntityId++,
      kind,
      model: d.model,
      x,
      z,
      owner,
      hp: d.hp,
      maxHp: d.hp,
      damage: d.damage,
      range: d.range,
      speed: d.speed,
      task: 'idle',
      stance: 'no-attack',
      carry: {},
      queue: [],
      population: d.population,
    };
    s.entities.push(e);
    return e;
  }
  function structure(kind: string, x = base.x + 2500, z = base.z) {
    const d = buildingById.get(kind)!;
    const e = {
      ...structuredClone(hall),
      id: s.nextEntityId++,
      kind,
      model: d.model,
      x,
      z,
      hp: d.hp,
      maxHp: d.hp,
      queue: [],
      progress: 10000,
    };
    s.entities.push(e);
    return e;
  }
  function chest(x = base.x + 1700, z = base.z) {
    const e: Entity = {
      ...structuredClone(base),
      id: s.nextEntityId++,
      kind: 'treasure',
      category: 'treasure',
      model: 'treasure',
      owner: 0,
      x,
      z,
      hp: 1,
      maxHp: 1,
      amount: 1,
      treasureId: 'pioneer-cache',
      speed: 0,
      damage: 0,
      task: 'idle',
      queue: [],
    };
    s.entities.push(e);
    return e;
  }
  function site() {
    const e = structure('tradePost');
    e.owner = 0;
    e.tradeSite = true;
    e.siteIncome = 'coin';
    e.captureProgress = 0;
    e.incomeProgress = 0;
    return e;
  }
  return {s, p: s.players[0], actor, structure, chest, site, hall};
}
function order(s: MatchState, fields: object, playerId = 1) {
  step(s, [{v: 1, tick: s.tick + 1, sequence: s.tick + 1, playerId, ...fields} as Command]);
}
function run(s: MatchState, n: number) {
  for (let i = 0; i < n; i++) step(s, []);
}
function down(s: MatchState, target: Entity, source: Entity) {
  s.projectiles.push({
    id: s.nextEntityId++,
    owner: 1,
    sourceId: source.id,
    targetId: target.id,
    x: target.x,
    z: target.z,
    impactTick: s.tick + 1,
    damage: 10000,
  });
  step(s, []);
}
test('market exchanges use exact reserved lots and reject invalid ownership, coin trades and insufficient funds', () => {
  const {s, p, structure} = fixture(),
    market = structure('market');
  order(s, {type: 'exchange', buildingId: market.id, resource: 'timber', direction: 'buy'});
  expect(p.resources.timber).toBe(110000);
  expect(p.resources.coin).toBe(87000);
  order(s, {type: 'exchange', buildingId: market.id, resource: 'timber', direction: 'sell'});
  expect(p.resources.timber).toBe(100000);
  expect(p.resources.coin).toBe(95000);
  order(s, {type: 'exchange', buildingId: market.id, resource: 'coin', direction: 'sell'});
  expect(p.resources.coin).toBe(95000);
  market.progress = 9000;
  order(s, {type: 'exchange', buildingId: market.id, resource: 'metal', direction: 'buy'});
  expect(p.resources.metal).toBe(100000);
  market.progress = 10000;
  market.owner = 0;
  order(s, {type: 'exchange', buildingId: market.id, resource: 'metal', direction: 'buy'});
  expect(p.resources.metal).toBe(100000);
  market.owner = 1;
  p.resources.coin = 0;
  order(s, {type: 'exchange', buildingId: market.id, resource: 'metal', direction: 'buy'});
  expect(p.stats.exchanges).toBe(2);
});
test('only an explorer can collect treasure, approaches first, and pays rewards exactly once', () => {
  const {s, p, actor, chest} = fixture(),
    e = actor('explorer'),
    worker = actor('worker', e.x, e.z + 500),
    t = chest();
  const reward = treasureById.get(t.treasureId!)!;
  order(s, {type: 'collect-treasure', entityIds: [worker.id], targetId: t.id});
  expect(s.events.at(-1)?.kind).toBe('rejected');
  order(s, {type: 'collect-treasure', entityIds: [e.id], targetId: t.id});
  expect(e.working).toBe(false);
  expect(p.stats.treasures).toBe(0);
  run(s, 150);
  expect(t.amount).toBe(0);
  expect(p.resources.timber).toBe(100000 + reward.reward.timber);
  expect(p.stats.treasures).toBe(1);
  order(s, {type: 'collect-treasure', entityIds: [e.id], targetId: t.id});
  expect(p.stats.treasures).toBe(1);
});
test('guards block treasure collection until defeated and scouts resume the interaction afterwards', () => {
  const {s, p, actor, chest} = fixture(),
    e = actor('explorer'),
    t = chest(),
    guard = actor('militia', t.x + 700, t.z);
  guard.owner = 0;
  guard.guardOf = t.id;
  guard.hp = 12;
  guard.damage = 0;
  order(s, {type: 'collect-treasure', entityIds: [e.id], targetId: t.id});
  expect(e.task).toBe('attack');
  expect(p.stats.treasures).toBe(0);
  run(s, 200);
  expect(guard.hp).toBe(0);
  expect(p.stats.treasures).toBe(1);
});
test('site capture requires contact and ticks; selectable income uses modifiers and nearby economic structures', () => {
  const {s, p, actor, structure, site} = fixture(),
    target = site(),
    e = actor('worker');
  order(s, {type: 'claim-site', entityIds: [e.id], targetId: target.id});
  expect(target.owner).toBe(0);
  expect(e.working).toBe(false);
  const point = perimeterPoint(target, e.id % 8, 180);
  e.x = point.x;
  e.z = point.z;
  run(s, 200);
  expect(target.owner).toBe(1);
  expect(p.stats.sitesCaptured).toBe(1);
  order(s, {type: 'site-income', siteId: target.id, resource: 'metal'});
  const before = p.resources.metal;
  target.incomeProgress = frontierRules.siteIncomeTicks - 1;
  step(s, []);
  expect(p.resources.metal).toBe(before + 2000);
  expect(p.stats.tradeIncome.metal).toBe(2000);
  p.modifiers.push('market');
  structure('market', target.x + 3500, target.z);
  structure('tradePost', target.x - 3500, target.z);
  expect(sitePayout(s, target)).toBe(3200);
});
test('contested sites pause capture and payout; enemy units cannot change owned income', () => {
  const {s, p, actor, site} = fixture(),
    target = site(),
    worker = actor('worker'),
    enemy = actor('militia', target.x, target.z, 2);
  target.owner = 1;
  target.incomeProgress = 199;
  worker.x = target.x;
  worker.z = target.z;
  step(s, []);
  expect(target.captureContested).toBe(true);
  expect(p.stats.tradeIncome.coin).toBe(0);
  expect(target.incomeProgress).toBe(199);
  order(s, {type: 'site-income', siteId: target.id, resource: 'metal'}, 2);
  expect(target.siteIncome).toBe('coin');
  enemy.x += 6000;
  step(s, []);
  expect(p.stats.tradeIncome.coin).toBe(2000);
});
test('capture, economy modifiers and pending treasure interaction replay identically after save/load', () => {
  const {s, actor, site, chest} = fixture(),
    worker = actor('worker'),
    explorer = actor('explorer', worker.x, worker.z + 1200),
    target = site(),
    t = chest();
  order(s, {type: 'claim-site', entityIds: [worker.id], targetId: target.id});
  order(s, {type: 'collect-treasure', entityIds: [explorer.id], targetId: t.id});
  run(s, 40);
  const restored = restoreSave(serializeSave(s));
  run(s, 300);
  run(restored, 300);
  expect(checksum(s)).toBe(checksum(restored));
});
test('lethal damage incapacitates explorers without losing population and saves retain the downed state', () => {
  const {s, p, actor} = fixture(),
    e = actor('explorer'),
    source = actor('militia', e.x + 1000, e.z);
  const population = p.population;
  down(s, e, source);
  expect(e.incapacitatedAt).toBeDefined();
  expect(p.population).toBe(population);
  expect(p.stats.unitsLost).toBe(0);
  run(s, 180);
  expect(createSnapshot(s, 1).entities.some((t) => t.id === e.id)).toBe(true);
  expect(checksum(restoreSave(serializeSave(s)))).toBe(checksum(s));
});
test('an ally revives at contact after work; paid return requires a completed hall and exact Coin', () => {
  const {s, p, actor, hall} = fixture(),
    e = actor('explorer'),
    worker = actor('worker', e.x + 1000, e.z);
  down(s, e, worker);
  order(s, {type: 'revive', entityIds: [worker.id], targetId: e.id});
  expect(e.hp).toBe(0);
  worker.x = e.x + 400;
  worker.z = e.z;
  run(s, 100);
  expect(e.hp).toBe(Math.trunc(e.maxHp / 2));
  expect(e.incapacitatedAt).toBeUndefined();
  down(s, e, worker);
  hall.progress = 9000;
  order(s, {type: 'recall-explorer', entityId: e.id});
  expect(p.resources.coin).toBe(100000);
  expect(e.hp).toBe(0);
  hall.progress = 10000;
  order(s, {type: 'recall-explorer', entityId: e.id});
  expect(p.resources.coin).toBe(90000);
  expect(e.hp).toBeGreaterThan(0);
  expect(e.incapacitatedAt).toBeUndefined();
});
test('safe territory permits timed explorer recovery, while nearby threats interrupt it', () => {
  const {s, actor} = fixture(),
    e = actor('explorer'),
    source = actor('militia', e.x + 1500, e.z);
  down(s, e, source);
  run(s, frontierRules.safeRecoveryTicks - 2);
  expect(e.hp).toBe(0);
  step(s, []);
  expect(e.hp).toBeGreaterThan(0);
  down(s, e, source);
  source.owner = 2;
  run(s, 50);
  expect(e.recoveryProgress).toBe(0);
  expect(e.hp).toBe(0);
});

test('treasure memory preserves last observation and hidden interactions are rejected', () => {
  const {s, actor, chest, hall} = fixture();
  s.config.fogOfWar = true;
  const cache = chest(hall.x + 40 * 256, hall.z);
  const explorer = actor('explorer', cache.x, cache.z + 300);
  run(s, 5);
  expect(createSnapshot(s, 1).entities.find((e) => e.id === cache.id)?.remembered).toBe(false);
  explorer.x = hall.x;
  explorer.z = hall.z;
  run(s, 5);
  order(s, {type: 'collect-treasure', entityIds: [explorer.id], targetId: cache.id});
  expect(explorer.task).toBe('idle');
  cache.hp = 0;
  cache.amount = 0;
  cache.deathTick = s.tick;
  run(s, 5);
  const memory = createSnapshot(s, 1).entities.find((e) => e.id === cache.id);
  expect(memory?.remembered).toBe(true);
  expect(memory?.hp).toBe(1);
  explorer.x = cache.x;
  explorer.z = cache.z + 300;
  run(s, 5);
  expect(s.knowledge[0][cache.id]).toBeUndefined();
});

test('hostile capture transfers ownership and future income through legal player commands', () => {
  const {s, site, actor, hall} = fixture();
  const opponent = structuredClone(s.players[0]);
  opponent.id = 2;
  s.players.push(opponent);
  s.nextSequence.push(0);
  s.fog.push([...s.fog[0]]);
  s.knowledge.push({});
  s.entities.push({...structuredClone(hall), id: s.nextEntityId++, owner: 2, x: hall.x + 60 * 256});
  const post = site();
  post.owner = 1;
  const point = perimeterPoint(post, 0, 180);
  const invader = actor('militia', point.x, point.z, 2);
  order(s, {type: 'claim-site', entityIds: [invader.id], targetId: post.id}, 2);
  run(s, frontierRules.siteCaptureTicks);
  expect(post.owner).toBe(2);
  expect(opponent.stats.sitesCaptured).toBe(1);
  post.incomeProgress = frontierRules.siteIncomeTicks - 1;
  order(s, {type: 'site-income', siteId: post.id, resource: 'metal'}, 2);
  expect(opponent.stats.tradeIncome.metal).toBe(frontierRules.siteIncome);
  const resource = post.siteIncome;
  order(s, {type: 'site-income', siteId: post.id, resource: 'timber'}, 1);
  expect(post.siteIncome).toBe(resource);
});
