async page => {
  await page.setViewportSize({width:1440,height:1000});
  for (const id of ['experience','certifications','education','awards']) {
    await page.evaluate(id=>document.getElementById(id).scrollIntoView({behavior:'instant'}),id);
    await page.waitForTimeout(700);
    await page.screenshot({path:`output/playwright/before-game-${id}.png`});
  }
}
