# Mobile service visibility regression

Run from the repository root:

```sh
node tests/mobile-visibility.cjs
```

Requires Node.js, Playwright and Chromium. The prepared cloud environment already provides them. For another machine, install test tooling outside the checkout (no app dependencies or lockfiles change):

```sh
npm install --prefix /tmp/eqai-ui-tests playwright@1.62.1
/tmp/eqai-ui-tests/node_modules/.bin/playwright install chromium
NODE_PATH=/tmp/eqai-ui-tests/node_modules node tests/mobile-visibility.cjs
```

The test prefers `/usr/bin/chromium` when available, otherwise Playwright's installed Chromium. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to select another Chromium executable. A temporary HTTP server starts on a free loopback port and closes after the tests. External fonts/icons and link destinations receive empty responses; local HTML/JS/images are served unchanged.

The checks use normal motion first, inspect ancestor opacity/display/visibility and hit testing, and decode images. They never add `.visible`, override opacity or fake successful observer callbacks. Mobile viewport checks and Pixel 5 emulation are desktop Chromium runs, not Android device tests. Tab switching is checked; OS background suspension is not simulated.

Coverage: 360×640, 390×844 with mobile emulation, 844×390 landscape, 1440×1000 desktop; KO/EN/JA and both themes; scrolling all 18 cards; search/filter AND, research-only and empty results; hash navigation, reload, history, orientation-sized viewport changes, keyboard/new tab and mobile navigation. Separate robustness cases disable the observer, throw on construction, withhold callbacks, enable reduced motion, or return null/throw from canvas context creation. Canvas failure must leave saved theme restoration and card controls working without JavaScript errors.

To verify that this detects the original bug, provide the unmodified main HTML from before the fix:

```sh
git show bd168df:index.html > /tmp/eqai-mobile-before.html
EQAI_TEST_INDEX=/tmp/eqai-mobile-before.html node tests/mobile-visibility.cjs
```

That run must fail on the first mobile card's ancestor opacity. To save screenshots of service headings, search and cards, set `EQAI_SCREENSHOT_DIR` to a directory outside the checkout (or a review evidence directory). See [the recorded review](../docs/reviews/mobile-service-visibility/README.md) for reproduction evidence and limitations.
