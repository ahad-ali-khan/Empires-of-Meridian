import {expect, test} from 'vitest';
import {buildingById, unitById} from '../../packages/content/src/index';
import {
  chooseAiProductionUnit,
  type AiCompositionEntity,
  type AiProductionBuilding,
} from '../../packages/sim/src/ai-composition';

const funds = {provisions: 100000, timber: 100000, coin: 100000, metal: 100000};
const player = (age: 1 | 2 | 3 | 4 = 4) => ({
  id: 2 as const,
  age,
  resources: {...funds},
  population: 0,
  populationCap: 100,
});
const building = (kind: string): AiProductionBuilding => ({
  kind,
  owner: 2,
  category: 'building',
  hp: 100,
  progress: 10000,
  queue: [],
});
const units = (kind: string, count: number, owner = 2): AiCompositionEntity[] =>
  Array.from({length: count}, () => ({kind, owner, category: 'unit', hp: 100, queue: []}));
const queue = (...kinds: string[]): AiCompositionEntity => ({
  ...building(unitById.get(kinds[0])?.trainedAt ?? 'barracks'),
  queue: kinds.map((kind) => ({kind})),
});

test('production choices obey ownership, completion, content, age, resources and population', () => {
  const p = player(3),
    b = building('arsenal');
  expect(chooseAiProductionUnit(p, b, [], [])).toBeUndefined();
  p.age = 4;
  expect(chooseAiProductionUnit(p, b, [], [])).toBe('grenadier');
  for (const invalid of [
    {...b, owner: 1},
    {...b, hp: 0},
    {...b, progress: 9999},
    {...b, category: 'unit' as const},
    building('house'),
  ])
    expect(chooseAiProductionUnit(p, invalid, [], [])).toBeUndefined();
  expect(chooseAiProductionUnit({...p, population: 99}, b, [], [])).toBeUndefined();
  expect(chooseAiProductionUnit({...p, resources: {...funds, metal: 0}}, b, [], [])).toBeUndefined();
  for (const definition of buildingById.values()) {
    const choice = chooseAiProductionUnit(p, building(definition.id), [], []);
    if (choice) {
      expect(definition.production).toContain(choice);
      expect(unitById.get(choice)!.age).toBeLessThanOrEqual(p.age);
    }
  }
});

test('Industrial Age production uses the legal modern roster', () => {
  const p = player();
  expect(chooseAiProductionUnit(p, building('barracks'), [], [])).toBe('veteranRifle');
  expect(chooseAiProductionUnit(p, building('archery'), [], [])).toBe('marksman');
  expect(chooseAiProductionUnit(p, building('arsenal'), [], [])).toBe('grenadier');
  expect(chooseAiProductionUnit(p, building('factory'), [], [])).toBe('howitzer');
  expect(chooseAiProductionUnit({...p, resources: {...funds, coin: 0}}, building('barracks'), [], [])).toBe('archer');
});

test('living and queued units count equally, so pending production fills composition gaps', () => {
  const p = player(1),
    b = building('barracks');
  expect(chooseAiProductionUnit(p, b, [], [])).toBe('archer');
  const living = [...units('archer', 5), ...units('militia', 1)];
  const queued = [...units('militia', 1), queue('archer', 'archer', 'archer', 'archer', 'archer', 'research:drills')];
  expect(chooseAiProductionUnit(p, b, queued, [])).toBe(chooseAiProductionUnit(p, b, living, []));
  expect(chooseAiProductionUnit(p, b, queued, [])).not.toBe('archer');
  expect(chooseAiProductionUnit(p, b, [...units('archer', 20, 1), {...queue('archer'), hp: 0}], [])).toBe('archer');
});

test('successive production reservations build a mixed force before any unit finishes training', () => {
  const p = player(),
    b = building('barracks'),
    pending: {kind: string}[] = [];
  b.queue = pending;
  const choices: string[] = [];
  for (let i = 0; i < 10; i++) {
    const choice = chooseAiProductionUnit(p, b, [b], [])!;
    choices.push(choice);
    pending.push({kind: choice});
    p.population += unitById.get(choice)!.population;
  }
  expect(choices).toContain('veteranRifle');
  expect(new Set(choices).size).toBeGreaterThanOrEqual(3);
  expect(choices.some((id) => unitById.get(id)!.tags.includes('anti-cavalry'))).toBe(true);
});

test('observed cavalry, artillery and structures adjust the counters', () => {
  const p = player(3);
  expect(chooseAiProductionUnit(p, building('barracks'), [], units('cavalry', 6, 1))).toBe('pikeman');
  const artillery = units('cannon', 6, 1);
  expect(chooseAiProductionUnit(p, building('stable'), [], artillery)).toBe('cavalry');
  expect(chooseAiProductionUnit(player(), building('factory'), [], [{...building('fort'), owner: 1}])).toBe('mortar');
  expect(
    chooseAiProductionUnit(
      p,
      building('barracks'),
      [],
      units('cavalry', 6, 1).map((e) => ({...e, hp: 0})),
    ),
  ).toBe('crossbow');
});

test('support production is limited by the combat force and includes pending support', () => {
  const p = player(),
    b = building('academy');
  expect(chooseAiProductionUnit(p, b, [], [])).toBeUndefined();
  const smallArmy = units('veteranRifle', 6);
  expect(chooseAiProductionUnit(p, b, smallArmy, [])).toBe('medic');
  expect(chooseAiProductionUnit(p, b, [...smallArmy, queue('medic')], [])).toBeUndefined();
  const army = [...units('veteranRifle', 15), ...units('cannon', 3), queue('medic', 'commander')];
  expect(chooseAiProductionUnit(p, b, army, [])).toBe('engineer');
  expect(chooseAiProductionUnit(p, b, [...army, queue('engineer')], [])).toBeUndefined();
});

test('choices are stable across input ordering and repeated calls without mutating inputs', () => {
  const p = player(),
    b = building('factory');
  const own = [...units('veteranRifle', 8), ...units('howitzer', 2), queue('mortar')];
  const observed = [...units('militia', 5, 1), ...units('cavalry', 2, 1), {...building('fort'), owner: 1}];
  const before = structuredClone({p, b, own, observed});
  const first = chooseAiProductionUnit(p, b, own, observed);
  for (let i = 0; i < 4; i++)
    expect(chooseAiProductionUnit(p, b, [...own].reverse(), [...observed].reverse())).toBe(first);
  expect({p, b, own, observed}).toEqual(before);
});
