import {writeFile} from 'node:fs/promises';
import {buildings,CONTENT_VERSION,dispatches,units} from '../packages/content/src/index.ts';
const rows=(items:{id:string;name:string;age:number;description:string}[])=>items.map(x=>`| ${x.id} | ${x.name} | ${x.age} | ${x.description} |`).join('\n');
const document=`# Gameplay content reference\n\nGenerated from validated content version ${CONTENT_VERSION}. Do not edit by hand.\n\n## Units\n\n| ID | Name | Age | Purpose |\n| --- | --- | ---: | --- |\n${rows(units)}\n\n## Buildings\n\n| ID | Name | Age | Purpose |\n| --- | --- | ---: | --- |\n${rows(buildings)}\n\n## Dispatches\n\n${dispatches.map(x=>`- **${x.name}** (Age ${x.age}, ${x.tokenCost} token): delivers ${x.amount/100} ${x.resource}.`).join('\n')}\n`;
await writeFile(new URL('../docs/GAMEPLAY_REFERENCE.md',import.meta.url),document);
