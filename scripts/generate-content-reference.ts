import {writeFile} from 'node:fs/promises';
import {buildings, CONTENT_VERSION, dispatchDescription, dispatches, units} from '../packages/content/src/index.ts';
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

## Dispatches

All starter cards are once per match. Cancellation before departure refunds the reserved tokens. Departures occur after 5 seconds. Deliveries wait for a completed owned central hall or fort, population capacity, and clear spawn positions.

| ID | Name | Age | Tokens | Arrival | Delivery |
| --- | --- | ---: | ---: | ---: | --- |
${dispatches.map((x) => `| ${x.id} | ${x.name} | ${x.age} | ${x.tokenCost} | ${x.arrivalTicks / 20}s | ${dispatchDescription(x)} |`).join('\n')}
`;
await writeFile(new URL('../docs/GAMEPLAY_REFERENCE.md', import.meta.url), document);
