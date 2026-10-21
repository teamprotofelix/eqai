// Run with `node tests/mobile-visibility.cjs` (Playwright + Chromium required).
// Optional: EQAI_TEST_INDEX=/path/to/old-index.html verifies the regression fails.
// EQAI_SCREENSHOT_DIR=/path saves real viewport screenshots; no DOM/style overrides.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium, devices } = require('playwright');

const root = path.resolve(__dirname, '..');
const shots = process.env.EQAI_SCREENSHOT_DIR;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    if (pathname === '/' && process.env.EQAI_TEST_INDEX) file = process.env.EQAI_TEST_INDEX;
    else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (error, body) => {
        res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
        res.end(error ? 'Not found' : body);
    });
});

async function settled(page) {
    await page.evaluate(() => new Promise(resolve => {
        let previous = scrollY, stable = 0;
        function frame() {
            stable = Math.abs(scrollY - previous) < 0.5 ? stable + 1 : 0;
            previous = scrollY;
            if (stable >= 8) resolve(); else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }));
}

async function readable(card) {
    await card.scrollIntoViewIfNeeded();
    const state = await card.evaluate(element => {
        const ancestors = [];
        for (let node = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            ancestors.push({ tag: node.id || node.tagName, opacity: style.opacity, display: style.display, visibility: style.visibility });
        }
        const rect = element.getBoundingClientRect();
        const y = (Math.max(rect.top, 80) + Math.min(rect.bottom, innerHeight)) / 2;
        const hit = document.elementFromPoint(rect.x + rect.width / 2, y);
        return { ancestors, hit: !!hit && element.contains(hit), inViewport: rect.top < innerHeight && rect.bottom > 0 };
    });
    assert.ok(state.ancestors.every(s => Number(s.opacity) >= 0.9 && s.display !== 'none' && s.visibility === 'visible'), JSON.stringify(state));
    assert.ok(state.inViewport && state.hit, 'Card is in view and unobscured');
    await card.locator('img').evaluate(img => img.decode());
}

async function allCards(page) {
    const cards = page.locator('.service-card');
    assert.equal(await cards.count(), 18);
    for (const card of await cards.all()) await readable(card);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal overflow');
}

async function screenshot(page, name) {
    if (!shots) return;
    fs.mkdirSync(shots, { recursive: true });
    await page.locator('.hero-ctas a[href="#services"]').click();
    await settled(page);
    await page.screenshot({ path: path.join(shots, name + '.jpg'), type: 'jpeg', quality: 75 });
}

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
    try {
        console.log('Chromium', browser.version(), '(mobile emulation, not an Android device)');
        for (const scenario of [
            { name: 'viewport-360', viewport: { width: 360, height: 640 } },
            { name: 'pixel-390', ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
            { name: 'landscape', ...devices['Pixel 5'], viewport: { width: 844, height: 390 } },
            { name: 'desktop', viewport: { width: 1440, height: 1000 } }
        ]) {
            const { name, ...options } = scenario;
            const context = await browser.newContext({ ...options, reducedMotion: 'no-preference' });
            // Tests exercise local app HTML, JS and images. External fonts/icons and
            // destination pages are stubbed, never presented as production checks.
            await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.fulfill({ status: 200, body: '', contentType: route.request().resourceType() === 'stylesheet' ? 'text/css' : 'text/html' }));
            const page = await context.newPage();
            const errors = [], failed = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            page.on('requestfailed', request => failed.push(request.url()));
            page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) failed.push(response.url()); });
            await page.goto(base + '/');
            assert.equal(await page.locator('#serviceGrid .service-card').count(), 15);
            assert.equal(await page.locator('#researchGrid .research-card').count(), 3);
            await page.locator('.hero-ctas a[href="#services"]').click();
            await settled(page);
            await readable(page.locator('#serviceGrid .service-card').first());
            await allCards(page);
            console.log('PASS', name, 'normal-motion initial visit, CTA and all 18 cards/ancestors/images');

            for (const lang of ['ko', 'en', 'ja']) {
                while (await page.getAttribute('html', 'lang') !== lang) await page.locator('#langToggle').click();
                for (const theme of ['dark', 'light']) {
                    if (await page.getAttribute('html', 'data-theme') !== theme) await page.locator('#themeToggle').click();
                    await page.locator('[data-filter="diagnosis"]').click();
                    await page.locator('#serviceSearch').fill('skill');
                    assert.equal(await page.locator('.service-card:not(.is-hidden)').count(), 1);
                    await readable(page.locator('.service-card[href="https://skill.inwardis.chatgpt.site/"]'));
                    assert.equal(await page.locator('#research').isVisible(), false);
                    await page.locator('[data-filter="daily"]').click();
                    assert.equal(await page.locator('.service-card:not(.is-hidden)').count(), 0);
                    assert.equal(await page.locator('#emptyState').isVisible(), true);
                    await page.locator('#serviceSearch').fill('');
                    await page.locator('[data-filter="research"]').click();
                    assert.equal(await page.locator('#serviceGrid').isVisible(), false);
                    assert.equal(await page.locator('.service-card:not(.is-hidden)').count(), 3);
                    for (const card of await page.locator('.research-card').all()) await readable(card);
                    await page.locator('[data-filter="all"]').click();
                    await allCards(page);
                    assert.equal(await page.locator('#emptyState').isVisible(), false);
                    if (['viewport-360', 'desktop'].includes(name)) await screenshot(page, name + '-' + lang + '-' + theme);
                }
            }
            // Language and theme changes preserve the filter/search AND condition.
            await page.locator('[data-filter="diagnosis"]').click();
            await page.locator('#serviceSearch').fill('skill');
            await page.locator('#langToggle').click(); await page.locator('#themeToggle').click();
            assert.equal(await page.locator('#serviceSearch').inputValue(), 'skill');
            assert.equal(await page.locator('[data-filter="diagnosis"]').getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('.service-card:not(.is-hidden)').count(), 1);
            await page.locator('#serviceSearch').fill(''); await page.locator('[data-filter="all"]').click();

            for (const hash of ['#services', '#research']) {
                await page.goto(base + '/' + hash); await settled(page);
                await readable(page.locator(hash + ' .service-card').first());
                await page.reload(); await settled(page);
                await readable(page.locator(hash + ' .service-card').first());
            }
            await page.goto(base + '/#services'); await page.goto(base + '/#research'); await page.goBack();
            await settled(page); await readable(page.locator('#serviceGrid .service-card').first());
            await page.setViewportSize({ width: options.viewport.height, height: options.viewport.width });
            await readable(page.locator('#serviceGrid .service-card').last());
            await page.setViewportSize(options.viewport);
            // A real second tab/background transition; headless lifecycle fidelity is limited.
            const second = await context.newPage(); await second.bringToFront(); await page.bringToFront(); await second.close();
            await readable(page.locator('#serviceGrid .service-card').first());
            if (options.viewport.width < 768) {
                await page.locator('#navToggle').click();
                assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'), 'true');
                await page.locator('#siteNav a[href="#services"]').click();
                assert.equal(await page.locator('#navToggle').getAttribute('aria-expanded'), 'false');
            }
            const card = page.locator('#serviceGrid .service-card').first();
            await card.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
            assert.equal(await card.evaluate(e => e === document.activeElement && getComputedStyle(e).outlineStyle === 'solid'), true);
            assert.equal(await card.getAttribute('rel'), 'noopener noreferrer');
            const opened = page.waitForEvent('popup'); await page.keyboard.press('Enter');
            const popup = await opened; await popup.waitForLoadState();
            assert.equal(popup.url(), await card.getAttribute('href')); await popup.close();
            assert.deepEqual(errors, []); assert.deepEqual(failed, []);
            console.log('PASS', name, '6 language/theme combinations, filters, anchors, reload, history, resize, tab return, keyboard, no local errors');
            await context.close();
        }
        // Separate robustness checks: these are fault injection, not the original reproduction.
        for (const mode of ['reduced-motion', 'no-observer', 'observer-throws', 'observer-silent', 'canvas-null', 'canvas-throws']) {
            const context = await browser.newContext({ viewport: { width: 360, height: 640 }, reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference' });
            await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.fulfill({ status: 200, body: '' }));
            const page = await context.newPage(); const errors = [];
            page.on('pageerror', e => errors.push(e.message));
            await page.addInitScript(mode => {
                if (mode === 'no-observer') delete window.IntersectionObserver;
                if (mode === 'observer-throws') window.IntersectionObserver = class { constructor() { throw Error('injected observer failure'); } };
                if (mode === 'observer-silent') window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
                if (mode === 'canvas-null') HTMLCanvasElement.prototype.getContext = () => null;
                if (mode === 'canvas-throws') HTMLCanvasElement.prototype.getContext = () => { throw Error('injected canvas failure'); };
            }, mode);
            await page.goto(base + '/#services');
            await readable(page.locator('#serviceGrid .service-card').first());
            await page.locator('[data-filter="research"]').click(); await readable(page.locator('.research-card').first());
            await page.locator('[data-filter="all"]').click(); await page.locator('#serviceSearch').fill('skill');
            await page.locator('#langToggle').click(); await page.locator('#themeToggle').click();
            assert.equal(await page.locator('.service-card:not(.is-hidden)').count(), 1);
            await readable(page.locator('.service-card:not(.is-hidden)'));
            assert.deepEqual(errors, []);
            if (mode.startsWith('canvas-')) {
                await page.reload();
                assert.equal(await page.getAttribute('html', 'data-theme'), await page.evaluate(() => localStorage.getItem('moip_theme')));
                await readable(page.locator('#serviceGrid .service-card').first());
            }
            console.log('PASS robustness', mode, '(expected errors:', errors.length + ')');
            await context.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
