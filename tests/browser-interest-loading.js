// Controlled image decode delays, reversals, failures and keyboard focus.
async page => {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const context = await page.context().browser().newContext({ viewport: { width: 1440, height: 1000 } });
  const browserPage = await context.newPage();
  const errors = [];
  browserPage.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(() => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    const control = window.interestDecodeTest = {
      armed: false,
      requests: [],
      fallbackPaths: [],
      // Release each decode independently; delay is milliseconds, fail simulates decode rejection.
      release(id, delay = 0, fail = false) {
        const request = this.requests.find(entry => entry.id === id);
        if (!request || request.state !== 'waiting') throw new Error('Decode request is not waiting: ' + id);
        request.state = 'scheduled';
        setTimeout(() => {
          request.state = fail ? 'rejected' : 'resolved';
          if (fail) request.reject(new DOMException('Controlled decode failure', 'EncodingError'));
          else request.resolve();
        }, delay);
      }
    };
    HTMLImageElement.prototype.decode = function () {
      const decoded = nativeDecode.call(this);
      const path = new URL(this.src).pathname;
      if (!control.armed || (!path.includes('/art/interests/') && !control.fallbackPaths.some(suffix => path.endsWith(suffix)))) return decoded;
      const request = { id: control.requests.length + 1, src: this.src, state: 'waiting', finished: false };
      control.requests.push(request);
      const gate = new Promise((resolve, reject) => { request.resolve = resolve; request.reject = reject; });
      return Promise.all([decoded, gate]).then(() => { request.finished = true; }, error => { request.finished = true; throw error; });
    };
  });
  const widget = browserPage.locator('[data-widget=interests]');
  const rail = widget.getByRole('tablist', { name: '관심분야 선택' });
  const topic = id => browserPage.locator('#interests-tab-' + id);
  const ready = async id => {
    await browserPage.waitForFunction(id => {
      const node = document.querySelector('[data-widget=interests]');
      return node?.dataset.interestState === 'ready' && node.dataset.shownId === id && node.dataset.interestPhase === 'idle';
    }, id);
  };
  const ticket = async (id, suffix = '/' + id + '.png') => {
    await browserPage.waitForFunction(suffix => window.interestDecodeTest.requests.some(entry => entry.state === 'waiting' && entry.src.endsWith(suffix)), suffix);
    return browserPage.evaluate(suffix => window.interestDecodeTest.requests.findLast(entry => entry.state === 'waiting' && entry.src.endsWith(suffix)).id, suffix);
  };
  const release = async (id, delay = 0, fail = false) => {
    await browserPage.evaluate(({ id, delay, fail }) => window.interestDecodeTest.release(id, delay, fail), { id, delay, fail });
  };
  const scene = () => widget.evaluate(node => ({
    shown: node.dataset.shownId,
    art: node.querySelector('[data-interest-hero]').dataset.artSrc,
    panel: node.querySelector('[role=tabpanel]:not([hidden])').id,
    selected: node.querySelector('[role=tab][aria-selected=true]').id
  }));
  try {
    await browserPage.goto('http://127.0.0.1:3002/web-portfolio/?interest-decode-check#interests');
    await browserPage.locator('[data-ready=true]').waitFor();
    await ready('bci');
    await browserPage.evaluate(() => { window.interestDecodeTest.armed = true; });
    const initial = await scene();

    // Keep the old scene intact until the final rapid selection finishes decoding.
    await widget.getByRole('button', { name: '다음 관심분야', exact: true }).click();
    const first = await ticket('eeg-fmri');
    await widget.getByRole('button', { name: '다음 관심분야', exact: true }).click();
    const second = await ticket('alignment');
    await widget.getByRole('button', { name: '다음 관심분야', exact: true }).click();
    const last = await ticket('representation');
    check(await widget.getAttribute('data-requested-id') === 'representation', 'The latest topic request was lost');
    check(JSON.stringify(await scene()) === JSON.stringify(initial), 'Pending decode changed the displayed scene');
    await release(last, 20);
    await ready('representation');
    const latest = await scene();
    check(latest.art.endsWith('/representation.png') && latest.panel.endsWith('-representation') && latest.selected.endsWith('-representation'), 'Image, copy and selection did not commit together');
    await release(second, 30);
    await release(first, 60);
    await browserPage.waitForFunction(() => window.interestDecodeTest.requests.every(entry => entry.state === 'resolved' && entry.finished));
    await browserPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    check(JSON.stringify(await scene()) === JSON.stringify(latest), 'A stale decode overwrote the latest selection');

    // Tab away while keyboard selection is loading; decoding must not reclaim focus.
    await topic('representation').focus();
    await browserPage.keyboard.press('Home');
    const keyboard = await ticket('bci');
    check(await topic('bci').evaluate(node => node === document.activeElement), 'Home did not focus the pending first topic');
    for (let step = 0; step < 5 && await rail.evaluate(node => node.contains(document.activeElement)); step++) await browserPage.keyboard.press('Tab');
    check(!await rail.evaluate(node => node.contains(document.activeElement)), 'Tab did not leave the topic rail');
    await browserPage.evaluate(() => { window.interestDecodeTest.focusAfterTab = document.activeElement; });
    await release(keyboard, 40);
    await ready('bci');
    check(await browserPage.evaluate(() => document.activeElement === window.interestDecodeTest.focusAfterTab), 'Decode completion stole focus after Tab left the rail');

    // Both image failures still expose the requested copy and remove the previous character.
    await browserPage.evaluate(() => { window.interestDecodeTest.fallbackPaths = ['/bg/morph/scene-05-still.webp']; });
    await topic('bci').focus();
    await browserPage.keyboard.press('ArrowRight');
    const failed = await ticket('eeg-fmri');
    const beforeFailure = await scene();
    await release(failed, 20, true);
    const fallback = await ticket('eeg-fmri', '/bg/morph/scene-05-still.webp');
    check(JSON.stringify(await scene()) === JSON.stringify(beforeFailure), 'The current scene changed before fallback decoding finished');
    await release(fallback, 20, true);
    await browserPage.waitForFunction(() => document.querySelector('[data-widget=interests]').dataset.interestState === 'error');
    const failedScene = await scene();
    check(failedScene.shown === 'eeg-fmri' && failedScene.panel.endsWith('-eeg-fmri') && failedScene.selected.endsWith('-eeg-fmri'), 'Failed images made the requested explanation inaccessible');
    check(failedScene.art === '' && await widget.locator('[data-interest-hero] img[data-visible=true], [data-interest-backdrop] img[data-visible=true]').count() === 0, 'A previous character remained behind the failed topic copy');
    check((await widget.locator('[data-interest-hero]').innerText()).includes('이미지를 불러오지 못했습니다'), 'The empty hero did not explain the image failure');
    check(await widget.getByRole('status').innerText() !== '', 'Decode failure did not report a status');
    check(await widget.locator('button[aria-controls=interests-extension]').count() === 0, 'The old exploration toggle remains');
    const reading = widget.locator('[role=tabpanel]:not([hidden]) [data-interest-reading]');
    await reading.focus();
    await browserPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    check(await reading.evaluate(node => node === document.activeElement), 'Failed decode left a pending focus restoration');
    check(errors.length === 0, 'Uncaught browser errors: ' + errors.join('; '));
    return { passed: ['latest decode wins', 'atomic image and copy', 'Tab focus remains outside rail', 'failed artwork retries fallback', 'both failed images retain requested explanation'], requests: await browserPage.evaluate(() => window.interestDecodeTest.requests.map(({ id, src, state }) => ({ id, src, state }))) };
  } finally {
    await context.close();
  }
}
