import {writeFile} from 'node:fs/promises';
import {
  buildings,
  CONTENT_VERSION,
  dispatchDescription,
  dispatches,
  units,
  councilChoices,
  councilModifiers,
  advancements,
} from '../packages/content/src/index.ts';
const rows = (items: {id: string; name: string; age: number}[]) =>
  items.map((x) => `| ${x.id} | ${x.name} | ${x.age} |`).join('\n');
const document = `# Gameplay content reference

Generated from validated content version ${CONTENT_VERSION}. Do not edit by hand.

## Units

| ID | Name | Age |
| --- | --- | ---: |
${rows(units)}

## Buildings

| ID | Name | Age |
| --- | --- | ---: |
${rows(buildings)}

## Council advancement

| Council | Age | Immediate delivery | Permanent effect |
| --- | ---: | --- | --- |
${councilChoices
  .map(
    (c) =>
      `| ${c.name} | ${c.age} | ${Object.entries(c.delivery)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n / 100} ${k}`)
        .join(' · ')} | ${councilModifiers[c.modifier].description} |`,
  )
  .join('\n')}

Advancement requires a completed central hall and pauses without one. Only one council can be chosen for each advancement. Repeated identical modifiers are not stacked. Different modifiers add within their rate group; military and artillery groups apply in order, then building damage resistance, with integer rounding at each damage stage.

${advancements
  .map(
    (a) =>
      `- Age ${a.age}: ${a.ticks / 20}s; ${Object.entries(a.cost)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n / 100} ${k}`)
        .join(' · ')}.`,
  )
  .join('\n')}

## Dispatches

All starter cards are once per match. Cancellation before departure refunds the reserved tokens. Departures occur after 5 seconds. Deliveries wait for a completed owned central hall or fort, population capacity, and clear spawn positions.

| ID | Name | Age | Tokens | Arrival | Delivery |
| --- | --- | ---: | ---: | ---: | --- |
${dispatches.map((x) => `| ${x.id} | ${x.name} | ${x.age} | ${x.tokenCost} | ${x.arrivalTicks / 20}s | ${dispatchDescription(x)} |`).join('\n')}
`;
await writeFile(new URL('../docs/GAMEPLAY_REFERENCE.md', import.meta.url), document);
