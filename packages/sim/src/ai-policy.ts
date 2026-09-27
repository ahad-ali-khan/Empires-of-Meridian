import type {Entity, MatchState} from './index';
import {visibleTo} from './visibility';

export const AI_INTENTS = ['develop', 'defend', 'engage', 'regroup'] as const;
export type AiIntent = (typeof AI_INTENTS)[number];
export const AI_FEATURES = [
  'army',
  'enemyNearBase',
  'knownEnemies',
  'injuredArmy',
  'age',
  'resources',
  'populationPressure',
] as const;
export type AiFeatures = Record<(typeof AI_FEATURES)[number], number>;

export interface PolicyModel {
  version: 1;
  actions: readonly AiIntent[];
  features: readonly string[];
  weights: number[][];
  bias: number[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function featuresFor(state: MatchState, owner: number): AiFeatures {
  const player = state.players[owner - 1];
  const mine = state.entities.filter((e) => e.owner === owner && e.hp > 0);
  const army = mine.filter((e) => e.category === 'unit' && !['worker', 'explorer'].includes(e.kind));
  const hall = mine.find((e) => e.kind === 'hall');
  const visibleEnemies = state.entities.filter(
    (e) => e.owner !== 0 && e.owner !== owner && e.hp > 0 && visibleTo(state, owner as 1 | 2 | 3 | 4, e),
  );
  const enemyNearBase = hall ? visibleEnemies.filter((e) => distance(e, hall) < 24 * 256).length : 0;
  const injuredArmy = army.filter((e) => e.hp * 4 < e.maxHp).length;
  const resourceTotal = player ? Object.values(player.resources).reduce((sum, value) => sum + value, 0) : 0;
  return {
    army: clamp01(army.length / 24),
    enemyNearBase: clamp01(enemyNearBase / 8),
    knownEnemies: clamp01(visibleEnemies.length / 24),
    injuredArmy: clamp01(injuredArmy / Math.max(1, army.length)),
    age: clamp01(((player?.age ?? 1) - 1) / 3),
    resources: clamp01(resourceTotal / 160000),
    populationPressure: clamp01((player?.population ?? 0) / Math.max(1, player?.populationCap ?? 1)),
  };
}

function distance(a: Pick<Entity, 'x' | 'z'>, b: Pick<Entity, 'x' | 'z'>) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
}

export function teacherIntent(features: AiFeatures): AiIntent {
  if (features.injuredArmy > 0.45) return 'regroup';
  if (features.enemyNearBase > 0) return 'defend';
  if (features.army >= 0.3 && features.knownEnemies > 0) return 'engage';
  return 'develop';
}

function vector(features: AiFeatures) {
  return AI_FEATURES.map((name) => features[name]);
}

function scores(model: PolicyModel, features: AiFeatures) {
  const input = vector(features);
  return model.actions.map(
    (_, action) => model.bias[action] + model.weights[action].reduce((sum, weight, i) => sum + weight * input[i], 0),
  );
}

export function chooseIntent(model: PolicyModel, features: AiFeatures): AiIntent {
  const values = scores(model, features);
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return model.actions[best];
}

export interface TrainingExample {
  features: AiFeatures;
  intent: AiIntent;
}

export function trainPolicy(examples: readonly TrainingExample[], epochs = 160, learningRate = 0.2): PolicyModel {
  const model: PolicyModel = {
    version: 1,
    actions: AI_INTENTS,
    features: AI_FEATURES,
    weights: AI_INTENTS.map(() => AI_FEATURES.map(() => 0)),
    bias: AI_INTENTS.map(() => 0),
  };
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const example of examples) {
      const input = vector(example.features);
      const values = scores(model, example.features);
      const target = model.actions.indexOf(example.intent);
      const predicted = values.reduce((best, value, i) => (value > values[best] ? i : best), 0);
      if (predicted === target) continue;
      for (let i = 0; i < input.length; i++) {
        model.weights[target][i] += learningRate * input[i];
        model.weights[predicted][i] -= learningRate * input[i];
      }
      model.bias[target] += learningRate;
      model.bias[predicted] -= learningRate;
    }
  }
  return model;
}

export function trainingSet(size = 512, seed = 17): TrainingExample[] {
  let state = seed >>> 0;
  const next = () => {
    state = Math.imul(state ^ (state >>> 16), 2246822519) >>> 0;
    return state / 0x100000000;
  };
  const examples = Array.from({length: size}, () => {
    const features = Object.fromEntries(AI_FEATURES.map((name) => [name, next()])) as AiFeatures;
    return {features, intent: teacherIntent(features)};
  });
  const edgeCases: AiFeatures[] = [
    {army: 0, enemyNearBase: 0, knownEnemies: 0, injuredArmy: 0, age: 0, resources: 0.4, populationPressure: 0.25},
    {army: 0.2, enemyNearBase: 0, knownEnemies: 0, injuredArmy: 0, age: 0.25, resources: 0.8, populationPressure: 0.5},
    {army: 0.5, enemyNearBase: 0, knownEnemies: 0.3, injuredArmy: 0, age: 0.5, resources: 0.6, populationPressure: 0.7},
    {
      army: 0.6,
      enemyNearBase: 0.8,
      knownEnemies: 0.5,
      injuredArmy: 0,
      age: 0.5,
      resources: 0.4,
      populationPressure: 0.8,
    },
    {
      army: 0.6,
      enemyNearBase: 0,
      knownEnemies: 0.5,
      injuredArmy: 0.8,
      age: 0.5,
      resources: 0.4,
      populationPressure: 0.8,
    },
  ];
  return [...examples, ...edgeCases.map((features) => ({features, intent: teacherIntent(features)}))];
}

export const DEFAULT_AI_POLICY = trainPolicy(trainingSet());
