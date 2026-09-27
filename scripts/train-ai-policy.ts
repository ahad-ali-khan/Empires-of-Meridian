import {writeFileSync} from 'node:fs';
import {createMatch, step} from '../packages/sim/src/index';
import {
  chooseIntent,
  featuresFor,
  teacherIntent,
  trainPolicy,
  type TrainingExample,
} from '../packages/sim/src/ai-policy';

function simulationExamples(seedStart: number, matches: number, ticks: number): TrainingExample[] {
  const examples: TrainingExample[] = [];
  for (let match = 0; match < matches; match++) {
    const state = createMatch({
      v: 1,
      seed: seedStart + match,
      difficulty: 'standard',
      mode: 'skirmish',
      populationCap: 100,
      gameSpeed: 1,
      aiCount: 1,
    });
    for (let tick = 0; tick < ticks; tick++) {
      if (state.tick % 50 === 0) {
        const features = featuresFor(state, 2);
        examples.push({features, intent: teacherIntent(features)});
      }
      step(state, []);
    }
  }
  return examples;
}

const examples = simulationExamples(20260922, 12, 600);
const validation = simulationExamples(20300922, 4, 600);
const model = trainPolicy(examples, 120, 0.2);
const accuracy =
  examples.filter((example) => chooseIntent(model, example.features) === example.intent).length / examples.length;
const validationAccuracy =
  validation.filter((example) => chooseIntent(model, example.features) === example.intent).length / validation.length;
const output = process.argv[2] ?? 'packages/sim/src/ai-policy-model.json';
writeFileSync(output, `${JSON.stringify(model, null, 2)}\n`);
console.log(
  `trained ${examples.length} simulated states; train accuracy ${(accuracy * 100).toFixed(1)}%; validation accuracy ${(validationAccuracy * 100).toFixed(1)}%; wrote ${output}`,
);
