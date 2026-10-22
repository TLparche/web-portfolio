// Regressions for small wheel gestures, the cover, and resizing during navigation.
async page => {
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const browserPage = await context.newPage();
  const base = 'http://127.0.0.1:3002/web-portfolio/';
  const results = [];
  const settled = async id => {
    await browserPage.waitForFunction(id => {
      const portfolio = document.querySelector('[data-staged=true]');
      const section = document.getElementById(id);
      if (!portfolio || !section || portfolio.dataset.moving !== 'false') return false;
      const top = section.getBoundingClientRect().top + scrollY;
      return location.hash === '#' + id && Math.abs(scrollY - top) < 2 && !section.querySelector('[data-panel]')?.inert;
    }, id);
  };
  const open = async (id, width = 1440, height = 1000) => {
    await browserPage.setViewportSize({ width, height });
    await browserPage.goto(base + '?navigation-edge=' + width + '-' + id + '#' + id);
    await browserPage.locator('[data-staged=true]').waitFor();
    if (width > 900) await browserPage.locator('[data-ready=true]').waitFor();
    await browserPage.waitForFunction(id => Math.abs(document.getElementById(id).getBoundingClientRect().top) < 2, id);
  };
  try {
    await open('about');
    await browserPage.mouse.move(700, 180);
    for (let index = 0; index < 30; index++) {
      await browserPage.mouse.wheel(0, 5);
      await browserPage.waitForTimeout(15);
    }
    await settled('interests');
    results.push('Small wheel deltas accumulate into one section change');

    await open('preview');
    await browserPage.keyboard.press('PageDown');
    await settled('about');
    results.push('PageDown from the cover opens the introduction');

    for (const [width, height] of [[1024, 650], [390, 844]]) {
      await open('about', 1920, 1080);
      await browserPage.mouse.move(700, 180);
      await browserPage.mouse.wheel(0, 300);
      await browserPage.locator('[data-moving=true]').waitFor();
      await browserPage.waitForTimeout(260);
      await browserPage.setViewportSize({ width, height });
      await settled('interests');
      await browserPage.waitForTimeout(1100);
      await settled('interests');
      results.push('Resize during navigation settles on the requested section at ' + width + '×' + height);
    }
    return { passed: results };
  } finally {
    await context.close();
  }
}
