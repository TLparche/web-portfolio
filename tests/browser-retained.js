// Retained card/extension and tab/gallery styles, including interrupted motion.
async page => {
  const base = page.url().split('#')[0].split('?')[0];
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [], captures = [];
  const watch = error => errors.push(error.message);
  page.on('pageerror', watch);
  const go = async (tab, id) => { await tab.evaluate(id => document.getElementById(id).scrollIntoView({ behavior: 'instant' }), id); await tab.waitForTimeout(550); };
  try {
    for (const [width, height] of [[1440,1000], [1024,650], [390,844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(base + '?retained=' + width);
      if (width > 900) await page.locator('[data-ready=true]').waitFor();
      await page.mouse.move(width - 2, height - 2);
      await go(page, 'skills');
      const skills = page.locator('#skills'), plate = skills.locator('[data-skill-plate]');
      check(await skills.getByRole('tab').count() === 4, 'Skill portrait rail missing');
      check(await skills.locator('[aria-label$="숙련도 입력 전"]').count() === 4 && await skills.locator('meter').count() === 0, 'Draft proficiency changed');
      check(await skills.getByRole('tab').first().locator('img').evaluate(n => n.complete && n.naturalWidth > 0), 'Skill portrait missing');
      const closed = await plate.evaluate(n => ({width:n.getBoundingClientRect().width, clip:getComputedStyle(n).clipPath}));
      if (width > 900) check(closed.clip.includes('20.45%'), 'Original closed plate proportion missing');
      const first = `output/playwright/retained-skills-${width}.png`;
      await page.screenshot({path:first}); captures.push(first);
      const toggle = skills.getByRole('button', {name:'TOOLBOX', exact:true});
      await toggle.focus(); await page.keyboard.press('Enter');
      check(await plate.getAttribute('data-open') === 'true', 'Keyboard cannot open toolbox');
      check(await skills.locator('[data-widget=skills]').getAttribute('data-instant') === 'true', 'Keyboard motion was not skipped');
      check(await skills.getByRole('complementary').getByText('TypeScript',{exact:true}).count() === 1, 'Toolbox data missing');
      await page.keyboard.press('Escape');
      check(await plate.getAttribute('data-open') === 'false' && await toggle.evaluate(n => n === document.activeElement), 'Toolbox Escape/focus return failed');
      await skills.getByRole('tab').first().focus(); await page.keyboard.press('End');
      check(await skills.getByRole('tabpanel').getByRole('heading',{name:'LANGUAGES',exact:true}).isVisible(), 'Skill keyboard selection failed');
      await page.keyboard.press('Home');
      if (width > 900) {
        await skills.locator('[data-skill-column]').hover();
        await page.waitForTimeout(550);
        const expanded = await plate.evaluate(n => ({width:n.getBoundingClientRect().width, clip:getComputedStyle(n).clipPath}));
        check(expanded.width === closed.width && expanded.clip === 'inset(0px)', 'Extension should reveal without animating layout width');
        check(await skills.getByRole('complementary').isVisible(), 'Pointer cannot open original extension');
        const path = `output/playwright/retained-skills-open-${width}.png`; await page.screenshot({path}); captures.push(path);
        await skills.getByRole('button',{name:'기술 확장 패널 닫기'}).click();
      } else {
        await toggle.click(); await page.waitForTimeout(350);
        check(await skills.getByRole('complementary').isVisible(), 'Touch toolbox missing');
        await toggle.click();
      }
      await go(page, 'activities');
      const activities = page.locator('#activities');
      check(await activities.getByRole('tab').count() === 3, 'Activity tabs missing');
      const thumbnails = activities.locator('[aria-label="활동 썸네일"]');
      check(await thumbnails.getByRole('button').count() === 3, 'Original thumbnail row missing');
      await thumbnails.getByRole('button').last().click();
      check(await activities.getByRole('tab').last().getAttribute('aria-selected') === 'true', 'Thumbnail did not select tab');
      await activities.getByRole('tab').first().click(); await page.keyboard.press('ArrowLeft');
      check(await activities.getByRole('tab').last().getAttribute('aria-selected') === 'true', 'Activity keyboard wrap failed');
      await activities.getByRole('tab').first().click();
      await page.waitForTimeout(550); await go(page, 'activities');
      await activities.locator('[data-copy]').evaluate(n=>n.scrollTop=0);
      if(width===1024)check(await activities.locator('[data-copy]').evaluate(n=>n.scrollHeight<=n.clientHeight+2),'Compact activity gallery needs an inner scroll before opening records');
      const path = `output/playwright/retained-activities-${width}.png`; await page.screenshot({path}); captures.push(path);
      await activities.getByRole('tabpanel').locator('summary').click();
      check(await activities.getByRole('tabpanel').locator('details').evaluate(n => n.open), 'Activity record cannot open');
      await activities.getByRole('tabpanel').locator('summary').focus(); await page.keyboard.press('Escape');
      check(await activities.getByRole('tabpanel').locator('details').evaluate(n => !n.open), 'Activity Escape failed');
      await activities.getByRole('tab').nth(1).click();
      await activities.getByRole('tab').last().click();
      await page.waitForTimeout(550);
      check(await activities.getByRole('tabpanel').getByRole('heading',{name:'낯선 관점과의 만남'}).isVisible(), 'Rapid selection lost latest content');
      check((await activities.locator('[data-art-src]').getAttribute('data-art-src')).includes('scene-10'), 'Rapid selection lost latest poster');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Retained layouts overflow');
    }
    for (const mode of ['reduced','no-js','no-webgl','touch']) {
      const context = await page.context().browser().newContext({viewport:mode==='touch'?{width:390,height:844}:{width:1440,height:1000}, hasTouch:mode==='touch', reducedMotion:mode==='reduced'?'reduce':'no-preference', javaScriptEnabled:mode!=='no-js'});
      if (mode==='no-webgl') await context.addInitScript(() => { const getContext=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(type,...args) { return type.startsWith('webgl') ? null : getContext.call(this,type,...args); }; });
      try {
        const tab = await context.newPage(), media=[];
        tab.on('request', request => { if (/\.mp4|VideoScene/.test(request.url())) media.push(request.url()); });
        await tab.goto(base + '?retained=' + mode);
        for (const id of ['skills','activities']) {
          await go(tab, id);
          check(await tab.locator('#'+id).getByRole('heading').count() > 0, mode+' '+id+' is blank');
          check(await tab.evaluate(id => { const node=document.getElementById(id); return node.nextElementSibling.getBoundingClientRect().top >= node.getBoundingClientRect().bottom - 1; }, id), mode+' sections overlap');
        }
        if (mode === 'reduced') {
          await go(tab,'skills'); await tab.locator('#skills').getByRole('tab').last().click();
          check(await tab.locator('#skills [data-content-reveal]').first().evaluate(n => n.getAnimations().length === 0), 'Reduced-motion content animates');
        } else if (mode==='no-js') {
          check(await tab.locator('#skills').getByRole('heading',{name:'SIGNAL PROCESSING',exact:true}).isVisible(), 'No-JS skill data missing');
          check(await tab.locator('#activities').getByRole('heading',{name:'낯선 관점과의 만남',exact:true}).isVisible(), 'No-JS activity data missing');
        } else if (mode==='touch') {
          await go(tab,'skills');
          await tab.locator('#skills').getByRole('button',{name:'TOOLBOX',exact:true}).tap();
          check(await tab.locator('#skills [data-skill-plate]').getAttribute('data-open')==='true','Touch expansion failed');
          await tab.locator('#skills').getByRole('button',{name:'TOOLBOX',exact:true}).tap();
          check(await tab.locator('#skills [data-skill-plate]').getAttribute('data-open')==='false','Touch collapse failed');
          await go(tab,'activities');
          await tab.locator('#activities').getByRole('tab').last().tap();
          check(await tab.locator('#activities').getByRole('tab').last().getAttribute('aria-selected')==='true','Touch activity selection failed');
        }
        check(media.length===0,mode+' loaded moving background');
      } finally { await context.close(); }
    }
    check(errors.length===0,errors.join('\n'));
    return {captures,retainedLayouts:true,keyboard:true,toolbox:true,rapidSelection:true,noJs:true,noWebgl:true,touch:true,reducedMotion:true,errors};
  } finally { page.off('pageerror',watch); }
}
