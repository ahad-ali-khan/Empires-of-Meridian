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
  technologies,
  supportAbilities,
  unitById,
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

## Contextual and queued orders

Right-click selects a contextual order. Hold Shift to append rather than replace; each unit has at most 32 pending orders. Stop clears queued orders and active directives. Active harvesting runs until the local resource work finishes; a queued move does not interrupt each carry/deposit trip. Permanent patrol and guard orders require Stop or a replacement order before later queued orders can run. Missing or newly hidden targets are skipped with feedback at activation. Failed movement releases the active order after ten failed recovery intervals, permitting the next queued order. Queued commands remain private to their owner.

- Attack-move (T): engage visible enemies along the route, then resume toward the destination. Pursuit is bounded; fleeing enemies are temporarily ignored after exceeding the pursuit limit.
- Patrol (P): travel between the starting point and destination, engaging nearby enemies and resuming the current leg afterwards.
- Guard (G): follow and defend a friendly unit or building; stop guarding if that target dies or enters a garrison.
- Heal (H): medics approach injured friendly living units and treat them on fixed simulation ticks. Idle medics seek nearby injured friendlies. Machines cannot be healed; worker repairs handle buildings separately.
- Escape cancels targeting; WASD continues to control the camera. Selection shows the active order and pending order list.

${supportAbilities.map((a) => `- ${unitById.get(a.unitId)?.name ?? a.unitId}: ${a.description} Range ${a.range / 256} world units; interval ${a.cooldown / 20}s.`).join('\n')}

## Research and production

Research and unit training share a first-in, first-out building queue. Costs are reserved at ordering. Cancel a job before it starts for a full refund; after work starts, half its cost is refunded. Cancellation releases reserved population. Destroying a building loses its queue without refunds. Research is once per player; prerequisites must be completed before ordering. Training bonuses do not accelerate research. Council and research rate bonuses add within each modifier group.

| Technology | Building | Age | Time | Cost | Effect | Prerequisites |
| --- | --- | ---: | ---: | --- | --- | --- |
${technologies
  .map(
    (t) =>
      `| ${t.name} | ${t.building} | ${t.age} | ${t.ticks / 20}s | ${Object.entries(t.cost)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n / 100} ${k}`)
        .join(' · ')} | ${councilModifiers[t.modifier].description} | ${t.prerequisites.join(', ') || 'None'} |`,
  )
  .join('\n')}

## Dispatches

All starter cards are once per match. Cancellation before departure refunds the reserved tokens. Departures occur after 5 seconds. Deliveries wait for a completed owned central hall or fort, population capacity, and clear spawn positions.

| ID | Name | Age | Tokens | Arrival | Delivery |
| --- | --- | ---: | ---: | ---: | --- |
${dispatches.map((x) => `| ${x.id} | ${x.name} | ${x.age} | ${x.tokenCost} | ${x.arrivalTicks / 20}s | ${dispatchDescription(x)} |`).join('\n')}
`;
await writeFile(new URL('../docs/GAMEPLAY_REFERENCE.md', import.meta.url), document);
