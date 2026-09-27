import {describe, expect, test} from 'vitest';
import {chooseIntent, featuresFor, teacherIntent, trainPolicy, trainingSet} from '../../packages/sim/src/ai-policy';
import {createMatch} from '../../packages/sim/src/index';

describe('tiny faction policy', () => {
  test('learns the deterministic teacher policy', () => {
    const examples = trainingSet(512, 9);
    const model = trainPolicy(examples);
    const accuracy =
      examples.filter((example) => chooseIntent(model, example.features) === example.intent).length / examples.length;
    expect(accuracy).toBeGreaterThan(0.94);
  });

  test('is deterministic for the same game state', () => {
    const a = createMatch({v: 1, seed: 42, difficulty: 'standard', mode: 'skirmish', populationCap: 100, gameSpeed: 1});
    const b = createMatch({v: 1, seed: 42, difficulty: 'standard', mode: 'skirmish', populationCap: 100, gameSpeed: 1});
    const model = trainPolicy(trainingSet(512, 9));
    expect(featuresFor(a, 2)).toEqual(featuresFor(b, 2));
    expect(chooseIntent(model, featuresFor(a, 2))).toBe(chooseIntent(model, featuresFor(b, 2)));
  });

  test('teacher prioritizes recovery, defense, attack, then development', () => {
    expect(
      teacherIntent({
        army: 0.5,
        enemyNearBase: 0,
        knownEnemies: 0,
        injuredArmy: 0.5,
        age: 0,
        resources: 0,
        populationPressure: 0,
      }),
    ).toBe('regroup');
    expect(
      teacherIntent({
        army: 0.1,
        enemyNearBase: 0.2,
        knownEnemies: 0,
        injuredArmy: 0,
        age: 0,
        resources: 0,
        populationPressure: 0,
      }),
    ).toBe('defend');
    expect(
      teacherIntent({
        army: 0.5,
        enemyNearBase: 0,
        knownEnemies: 0.2,
        injuredArmy: 0,
        age: 0,
        resources: 0,
        populationPressure: 0,
      }),
    ).toBe('engage');
    expect(
      teacherIntent({
        army: 0.1,
        enemyNearBase: 0,
        knownEnemies: 0,
        injuredArmy: 0,
        age: 0,
        resources: 0,
        populationPressure: 0,
      }),
    ).toBe('develop');
  });
});
