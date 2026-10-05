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
  frontierRules,
  treasureDefinitions,
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

## Trade and frontier objectives

- Completed markets buy ${frontierRules.exchangeLot / 100} Provisions, Timber or Metal for ${frontierRules.buyCoin / 100} Coin; selling the same lot returns ${frontierRules.sellCoin / 100} Coin. Invalid exchanges never spend resources.
- Markets improve nearby gathering by ${(frontierRules.marketRate - 10000) / 100}% within ${frontierRules.marketRadius / 256} world units. Fractional work is retained rather than rounded away each tick.
- Right-click a neutral or opposing trade site with units to claim it at its boundary. One unit takes ${frontierRules.siteCaptureTicks / 20}s; up to three contributors accelerate capture. Opposing nearby units contest capture and pause payouts.
- Captured sites pay ${frontierRules.siteIncome / 100} of the selected resource every ${frontierRules.siteIncomeTicks / 20}s. Nearby completed markets, player-built trade depots and commerce council/research bonuses add to this rate; identical structures do not stack. The selection panel shows the actual current payout.
- Right-click treasures with an explorer. Living linked guards must be defeated before the ${frontierRules.treasureWorkTicks / 20}s collection completes. Rewards are delivered once.
- Explorers become incapacitated at zero health and retain their population reservation. A living ally can approach and rescue them in ${frontierRules.reviveTicks / 20}s. Unthreatened territory near a completed hall or fort permits ${frontierRules.safeRecoveryTicks / 20}s recovery. Paid return costs ${frontierRules.recallCoin / 100} Coin and requires a completed hall and a clear spawn position. All recoveries restore half health.

| Treasure | Guards | Resources | Renown |
| --- | ---: | --- | ---: |
${treasureDefinitions
  .map(
    (t) =>
      `| ${t.name} | ${t.guards} | ${Object.entries(t.reward)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${n / 100} ${k}`)
        .join(' · ')} | ${t.renown / 1000} |`,
  )
  .join('\n')}

Neutral sites and caches are generated with footprint and reachability checks. Static fog memory retains last-observed sites and treasures; hidden changes are revealed only when revisited. Site ownership, selected income, disputes, recovery and partial interaction work persist in saves. Moving trade convoys, neutral alliance contracts and trade-dominance victory are future work.

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
