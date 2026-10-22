// Stella Sora's right-side wipe, illustration hover and native reading scroll.
async page => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const base = 'http://127.0.0.1:3002/web-portfolio/';
  const results = [];
  const browser = page.context().browser();
  for (const mode of ['desktop', 'reduced', 'mobile']) {
    const mobile = mode === 'mobile';
    const width = mobile ? 390 : 1920, height = mobile ? 844 : 1080;
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: mobile, isMobile: mobile, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' });
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', error => errors.push(error.message));
    const interest = tab.locator('[data-widget=interests]');
    const step = value => tab.waitForFunction(value => document.querySelector('[data-widget=interests]')?.dataset.interestScrollStep === String(value), value);
    const expanded = value => tab.waitForFunction(value => document.querySelector('[data-widget=interests]')?.dataset.interestExpanded === String(value), value);
    const settled = id => tab.waitForFunction(id => document.querySelector('[data-staged=true]')?.dataset.moving === 'false' && Math.abs(document.getElementById(id).getBoundingClientRect().top) < 2, id);
    const chooseSpeech = async () => {
      await interest.locator('[role=tab][aria-selected=true]').focus();
      await tab.keyboard.press('End');
      await tab.waitForFunction(() => {
        const node = document.querySelector('[data-widget=interests]');
        return node?.dataset.shownId === 'speech' && node.dataset.interestState === 'ready' && node.dataset.interestPhase === 'idle';
      });
    };
    const wheelStep = async (direction, value) => {
      await tab.mouse.wheel(0, direction * 240);
      await step(value);
      await tab.waitForTimeout(350);
    };
    try {
      await tab.goto(base + '?interest-reference=' + mode + '#interests');
      await tab.locator('[data-staged=true]').waitFor();
      if (mode === 'desktop') await tab.locator('[data-ready=true]').waitFor();
      await settled('interests');
      await tab.waitForFunction(() => document.querySelector('[data-widget=interests]')?.dataset.interestState === 'ready');
      await step(0);
      await tab.mouse.move(width - 12, height - 100);
      await expanded(false);
      const originalScroll = await tab.evaluate(() => scrollY);

      if (mobile) {
        await tab.mouse.move(25, 250);
        await tab.waitForTimeout(350);
        check(await interest.getAttribute('data-interest-expanded') === 'false', 'A coarse pointer activated desktop illustration hover');
        await chooseSpeech();
        await tab.mouse.move(width - 12, 440);
        await tab.mouse.wheel(0, 240);
        await settled('projects');
        check(await interest.getAttribute('data-interest-scroll-step') === '0', 'Mobile wheel entered the desktop wipe sequence');
        results.push({ mode, desktopHoverDisabled: true, noInternalWheelSteps: true, keyboardTopicSelection: true });
      } else {
        const plate = interest.locator('[data-interest-plate]');
        const closedWidth = await plate.evaluate(node => node.getBoundingClientRect().width);
        await tab.mouse.move(100, 300);
        await expanded(true);
        await tab.waitForTimeout(350);
        const openWidth = await plate.evaluate(node => node.getBoundingClientRect().width);
        check(openWidth > closedWidth + width * .2, 'Hover did not expand the illustration plate');
        check(Math.abs(openWidth / width - .9734) < .015, 'Expanded plate does not match the reference width');
        check(await interest.getAttribute('data-shown-id') === 'bci', 'Illustration hover changed the chosen topic');
        await interest.getByRole('button', { name: '관심 일러스트 접기', exact: true }).click();
        await expanded(false);
        await tab.waitForTimeout(350);
        await tab.mouse.move(100, 320);
        await tab.waitForTimeout(350);
        check(await interest.getAttribute('data-interest-expanded') === 'false', 'Pointer movement inside the plate reopened a dismissed illustration');
        check(Math.abs(await plate.evaluate(node => node.getBoundingClientRect().width) - closedWidth) < 2, 'Mouse close did not restore the plate width');
        await tab.mouse.move(width - 12, height - 100);
        await tab.mouse.move(100, 300);
        await expanded(true);
        await tab.waitForTimeout(350);
        await tab.mouse.move(width - 12, height - 100);
        await expanded(false);
        await tab.waitForTimeout(350);
        check(Math.abs(await plate.evaluate(node => node.getBoundingClientRect().width) - closedWidth) < 2, 'Pointer leave did not restore the illustration plate');

        const toggle = interest.getByRole('button', { name: '관심 일러스트 펼치기', exact: true });
        await toggle.focus();
        await tab.keyboard.press('Enter');
        await expanded(true);
        check(await interest.getAttribute('data-exploration-instant') === 'true', 'Keyboard expansion was not immediate');
        check(await interest.getByRole('button', { name: '관심 일러스트 접기', exact: true }).getAttribute('aria-expanded') === 'true', 'The illustration toggle did not expose its open state');
        await tab.keyboard.press('Escape');
        await expanded(false);
        check(await interest.locator('#interests-illustration').count() === 1, 'The illustration target is missing');
        await chooseSpeech();

        const reading = interest.locator('[role=tabpanel]:not([hidden]) [data-interest-reading]');
        check(await reading.evaluate(node => node.scrollHeight > node.clientHeight), 'The reading sample does not exercise overflow');
        const readingBox = await reading.boundingBox();
        await tab.mouse.move(readingBox.x + readingBox.width / 2, readingBox.y + readingBox.height / 2);
        await tab.mouse.wheel(0, 160);
        await tab.waitForTimeout(350);
        check(await reading.evaluate(node => node.scrollTop) > 0, 'Reading wheel did not scroll the explanation');
        check(await interest.getAttribute('data-interest-scroll-step') === '0', 'Reading wheel changed the artwork wipe');
        check(Math.abs(await tab.evaluate(() => scrollY) - originalScroll) < 2, 'Reading wheel moved the outer section');

        await tab.mouse.move(width - 12, height - 100);
        await expanded(false);
        const wipe = interest.locator('[data-interest-wipe]');
        const clips = [await wipe.evaluate(node => getComputedStyle(node).clipPath)];
        for (let event = 0; event < 5; event++) {
          await tab.mouse.wheel(0, 120);
          await tab.waitForTimeout(30);
        }
        await tab.waitForTimeout(350);
        check(await interest.getAttribute('data-interest-scroll-step') === '1', 'A rapid five-event wheel gesture advanced more than one artwork step');
        check(Math.abs(await tab.evaluate(() => scrollY) - originalScroll) < 2, 'A rapid wheel gesture escaped the interest section');
        await wheelStep(-1, 0);
        for (let value = 1; value <= 4; value++) {
          await wheelStep(1, value);
          clips.push(await wipe.evaluate(node => getComputedStyle(node).clipPath));
          check(Math.abs(await tab.evaluate(() => scrollY) - originalScroll) < 2, 'Internal artwork wheel changed the page position at step ' + value);
        }
        check(new Set(clips).size === 5, 'Each wheel step must reveal a distinct portion of the right-side image');
        check(clips[4].includes('100%'), 'The final wipe did not finish revealing the illustration');
        for (let value = 3; value >= 0; value--) await wheelStep(-1, value);
        check(await wipe.evaluate(node => getComputedStyle(node).clipPath) === clips[0], 'Reverse wheel did not restore the starting image mask');
        for (let value = 1; value <= 4; value++) await wheelStep(1, value);
        await tab.mouse.wheel(0, 240);
        await settled('projects');
        await step(0);
        await tab.getByRole('navigation', { name: '섹션 탐색', exact: true }).locator('a[href="#interests"]').click();
        await settled('interests');
        await step(0);
        check(await interest.getAttribute('data-shown-id') === 'speech', 'Returning to interests lost the chosen topic');
        await tab.waitForTimeout(1500);
        await tab.mouse.move(width - 12, height - 100);
        await tab.mouse.wheel(0, -240);
        await settled('about');
        results.push({ mode, hoverExpandsAndRestores: true, mouseCloseStaysClosed: true, reentryReopens: true, rapidWheelOneStep: true, keyboardToggleAndEscape: true, nativeReadingScroll: true, wheelSteps: 4, reverseWipe: true, fifthWheelLeaves: true, selectionPreserved: true, previousSectionAtZero: true });
      }
      check(errors.length === 0, mode + ': uncaught errors: ' + errors.join('; '));
    } finally { await context.close(); }
  }
  return results;
}
