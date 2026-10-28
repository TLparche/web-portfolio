// Records the implemented reference interactions, using the same routes as the browser checks.
async page => {
  const base=process.env.PREVIEW_URL || 'http://127.0.0.1:3111/web-portfolio/';
  const context=await page.context().browser().newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'output/playwright/implementation-reference',size:{width:1440,height:1000}}});
  const tab=await context.newPage(),video=tab.video();
  try {
    await tab.goto(base+'#projects');
    await tab.locator('#work-domain-platform').waitFor();
    await tab.screenshot({path:'output/playwright/implementation-reference/domains.png'});
    await tab.locator('#work-domain-platform').press('Enter');
    await tab.getByRole('button',{name:'콘텐츠 제작',exact:true}).click();
    await tab.locator('#work-open-holo-studio').click();
    await tab.getByRole('link',{name:'자세한 기록 읽기'}).click();
    await tab.getByRole('heading',{level:1}).waitFor();
    await tab.getByRole('button',{name:'점군 장면과 슬롯 타임라인을 편집하는 holo-studio 확대'}).click();
    await tab.keyboard.press('Escape');
    await tab.getByRole('link',{name:'출력 · 편집한 장면을 영상으로',exact:true}).filter({visible:true}).click();
    await tab.screenshot({path:'output/playwright/implementation-reference/detail.png'});
    await tab.getByRole('link',{name:'전체 경험으로',exact:true}).click();
    await tab.getByRole('link',{name:'플랫폼·도구 개발',exact:true}).click();
    await tab.getByRole('link',{name:'콘텐츠 제작',exact:true}).click();
  } finally {await context.close();}
  await video.saveAs('output/playwright/implementation-reference/interaction.webm');
  return {recording:'output/playwright/implementation-reference/interaction.webm'};
}
