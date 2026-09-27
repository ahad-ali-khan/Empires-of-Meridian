import {expect,test} from '@playwright/test';
test('short-window setup scrolls to launch and starts three independent AI opponents',async({page})=>{
 test.setTimeout(160000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewportSize({width:1280,height:720});await page.goto('/');await page.getByRole('button',{name:'Skirmish',exact:true}).click();
 await page.getByLabel('AI opponents').selectOption('3');await page.getByLabel('Visibility').selectOption('off');await page.getByRole('button',{name:'Launch match'}).scrollIntoViewIfNeeded();
 const button=await page.getByRole('button',{name:'Launch match'}).boundingBox();expect(button!.y+button!.height).toBeLessThanOrEqual(720);
 await page.getByRole('button',{name:'Launch match'}).click();await expect(page.locator('.top-hud').getByText('provisions',{exact:true})).toBeVisible({timeout:60000});
 expect(await page.evaluate(()=>(window as any).meridianInspect.snapshot().players.length)).toBe(4);
 await expect.poll(()=>page.evaluate(()=>{const m=(window as any).meridianInspect.metrics();return m.views-m.visibleViews;}),{timeout:10000}).toBeGreaterThan(10);
 console.log('Four-player frustum capture',await page.evaluate(()=>(window as any).meridianInspect.metrics()));
 await page.screenshot({path:'artifacts/four-player-skirmish.png'});expect(errors).toEqual([]);
});
