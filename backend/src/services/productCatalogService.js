const { chromium } = require("playwright");

const MOCK_STORE_URL =
  process.env.MOCK_STORE_URL || "https://demo.inelabteamdev.com/";

const MAX_PAGES = 50;
const MAX_RESULTS = 20;

/**
 * Handles the cookie popup/overlay that sometimes appears
 * and blocks clicks on product cards or pagination buttons.
 */
async function handleCookiePopup(page) {
  const selectors = [
    'button:has-text("Accept All")',
    'button:has-text("Accept")',
    'button:has-text("Allow")',
    'button:has-text("I agree")',
    'button:has-text("Agree")',
    'button:has-text("Got it")',
  ];

  // First try the known cookie buttons.
  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();

      if (await button.isVisible({ timeout: 500 })) {
        console.log(`Cookie popup detected. Clicking: ${selector}`);

        await button.click({
          force: true,
          timeout: 5000,
        });

        await page.waitForTimeout(300);
        return true;
      }
    } catch (_) {
      // Try the next selector.
    }
  }

  // Fallback: if the overlay exists, look for a button inside it.
  try {
    const overlay = page.locator(".cookie-overlay").first();

    if (await overlay.isVisible({ timeout: 500 })) {
      console.log(
        "Cookie overlay detected. Looking for button inside overlay...",
      );

      const buttons = overlay.locator("button");
      const buttonCount = await buttons.count();

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);

        try {
          if (await button.isVisible({ timeout: 300 })) {
            const text = ((await button.innerText()) || "").trim();

            console.log(
              `Clicking cookie overlay button${text ? `: ${text}` : ""}`,
            );

            await button.click({
              force: true,
              timeout: 5000,
            });

            await page.waitForTimeout(500);

            // Verify whether overlay disappeared.
            if (!(await overlay.isVisible({ timeout: 500 }))) {
              return true;
            }
          }
        } catch (_) {
          // Try next button.
        }
      }
    }
  } catch (_) {
    // Cookie overlay is not present.
  }

  return false;
}

/**
 * Waits until the browser reaches a product URL.
 *
 * The store can navigate asynchronously, so we don't rely only
 * on Playwright's navigation event.
 */
async function waitForProductUrl(page, timeout = 10000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const url = page.url();

    if (/\/product\/\d+/.test(url)) {
      return url;
    }

    await page.waitForTimeout(250);
  }

  return null;
}

/**
 * Opens a product from a listing page and returns its product URL.
 *
 * Uses retries because individual product clicks can occasionally
 * fail while the store is loading or handling an overlay.
 */
async function openProductAndGetUrl(page, button, productName) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await handleCookiePopup(page);

      await button.waitFor({
        state: "visible",
        timeout: 5000,
      });

      await button.scrollIntoViewIfNeeded();

      const listingUrlBeforeClick = page.url();

      console.log(
        `Opening "${productName}" (attempt ${attempt}/${maxAttempts})...`,
      );

      // Start waiting for either navigation or URL change.
      await Promise.allSettled([
        page.waitForURL(/\/product\/\d+/, {
          timeout: 12000,
        }),

        button.click({
          force: true,
          timeout: 10000,
        }),
      ]);

      // Additional polling handles async/client-side navigation.
      const productUrl = await waitForProductUrl(page, 5000);

      if (productUrl) {
        return productUrl;
      }

      console.warn(
        `Attempt ${attempt}/${maxAttempts}: product URL did not appear for "${productName}".`,
      );

      // If the page changed to something unexpected, return to listing.
      if (page.url() !== listingUrlBeforeClick) {
        try {
          await page.goBack({
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });

          await page.waitForTimeout(1000);
        } catch (_) {
          // Ignore; next retry will attempt the button again.
        }
      }

      await handleCookiePopup(page);
      await page.waitForTimeout(1000);
    } catch (error) {
      console.warn(
        `Attempt ${attempt}/${maxAttempts} failed for "${productName}": ${error.message}`,
      );

      if (attempt < maxAttempts) {
        try {
          await handleCookiePopup(page);
        } catch (_) {}

        await page.waitForTimeout(1000);
      }
    }
  }

  return null;
}

/**
 * Waits for product cards to be available on the listing page.
 */
async function waitForProductCards(page, timeout = 15000) {
  try {
    await page.locator("article.tile").first().waitFor({
      state: "visible",
      timeout,
    });

    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Gets the product name from a product card.
 *
 * IMPORTANT:
 * We only use .tile-name.
 * We do NOT use generic h1/h2/h3 selectors because the product
 * detail page contains generic headings such as "All products".
 */
async function getProductNameFromCard(card) {
  try {
    const nameElement = card.locator(".tile-name").first();

    const name = ((await nameElement.innerText()) || "").trim();

    return name;
  } catch (_) {
    return "";
  }
}

/**
 * Searches the mock store by partial/full product name.
 *
 * The store contains 50 pages with 20 products per page.
 *
 * Example:
 *   searchProducts("Domus Smartwatch Neo")
 *   searchProducts("Smartwatch")
 */
async function searchProducts(query) {
  const normalizedQuery = String(query || "")
    .trim()
    .toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  let browser;

  const results = [];
  const seenUrls = new Set();

  try {
    browser = await chromium.launch({
      headless: true,
    });

    const context = await browser.newContext({
      viewport: {
        width: 1440,
        height: 900,
      },
    });

    const page = await context.newPage();

    page.setDefaultTimeout(15000);

    console.log(`Searching store for: "${query}"`);

    await page.goto(MOCK_STORE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(1000);

    await handleCookiePopup(page);

    const cardsLoaded = await waitForProductCards(page);

    if (!cardsLoaded) {
      throw new Error("Could not load product cards from mock store.");
    }

    for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
      if (results.length >= MAX_RESULTS) {
        break;
      }

      console.log(`Searching store page ${pageNumber}/${MAX_PAGES}...`);

      await handleCookiePopup(page);

      // Make sure product cards are loaded before reading them.
      const cardsReady = await waitForProductCards(page, 15000);

      if (!cardsReady) {
        console.warn(`Could not load product cards on page ${pageNumber}.`);

        continue;
      }

      const cards = page.locator("article.tile");
      const cardCount = await cards.count();

      const matches = [];

      /*
       * First scan the page and collect matching indexes.
       *
       * We use .tile-name ONLY so category/brand/SKU text cannot
       * create false matches.
       */
      for (let i = 0; i < cardCount; i++) {
        const card = cards.nth(i);

        const productName = await getProductNameFromCard(card);

        if (!productName) {
          continue;
        }

        if (productName.toLowerCase().includes(normalizedQuery)) {
          matches.push({
            index: i,
            name: productName,
          });
        }
      }

      console.log(
        `Found ${matches.length} matching product(s) on page ${pageNumber}.`,
      );

      /*
       * Open every matching product.
       */
      for (const match of matches) {
        if (results.length >= MAX_RESULTS) {
          break;
        }

        /*
         * IMPORTANT:
         * Re-query the DOM after every navigation.
         *
         * Playwright locators can become stale/reordered after
         * returning from the product page.
         */
        await handleCookiePopup(page);

        const currentCards = page.locator("article.tile");
        const currentCardCount = await currentCards.count();

        if (match.index >= currentCardCount) {
          console.warn(
            `Product index ${match.index} is no longer available for "${match.name}".`,
          );
          continue;
        }

        const currentCard = currentCards.nth(match.index);

        const currentName = await getProductNameFromCard(currentCard);

        if (
          !currentName ||
          currentName.toLowerCase() !== match.name.toLowerCase()
        ) {
          console.warn(`Product card changed before opening "${match.name}".`);
          continue;
        }

        const button = currentCard.locator("button.tile-cta").first();

        let productUrl = await openProductAndGetUrl(page, button, match.name);

        if (!productUrl) {
          console.warn(
            `Could not open product "${match.name}" at index ${match.index}: product URL did not appear.`,
          );

          /*
           * Make sure we are back on the listing page before
           * continuing with the next product/page.
           */
          if (/\/product\/\d+/.test(page.url())) {
            try {
              await page.goBack({
                waitUntil: "domcontentloaded",
                timeout: 15000,
              });

              await page.waitForTimeout(1000);
            } catch (_) {}
          }

          await handleCookiePopup(page);
          continue;
        }

        console.log(`Matched: ${match.name} (${productUrl})`);

        /*
         * Avoid duplicate products in the API response.
         */
        if (!seenUrls.has(productUrl)) {
          seenUrls.add(productUrl);

          results.push({
            name: match.name,
            url: productUrl,
          });
        }

        /*
         * Return to the SAME paginated listing page.
         *
         * Do NOT use page.goto(MOCK_STORE_URL) here because that
         * can reset pagination back to page 1.
         */
        try {
          await page.goBack({
            waitUntil: "domcontentloaded",
            timeout: 15000,
          });
        } catch (error) {
          console.warn(
            `Could not go back after opening "${match.name}": ${error.message}`,
          );

          /*
           * If browser history fails, reload the current store.
           * This is only a fallback.
           */
          await page.goto(MOCK_STORE_URL, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
        }

        await page.waitForTimeout(1000);

        await handleCookiePopup(page);

        /*
         * Wait until cards are available again.
         */
        await waitForProductCards(page, 15000);
      }

      if (results.length >= MAX_RESULTS) {
        break;
      }

      /*
       * Move to next page.
       */
      await handleCookiePopup(page);

      const nextButton = page
        .getByRole("button", {
          name: /next/i,
        })
        .first();

      let nextExists = false;

      try {
        nextExists = await nextButton.isVisible({
          timeout: 2000,
        });
      } catch (_) {
        nextExists = false;
      }

      if (!nextExists) {
        console.log("Next button not found. Ending search.");
        break;
      }

      /*
       * Check whether Next is disabled.
       */
      try {
        const disabled = await nextButton.isDisabled();

        if (disabled) {
          console.log("Reached the last page.");
          break;
        }
      } catch (_) {}

      const oldFirstProductName = await getProductNameFromCard(
        page.locator("article.tile").first(),
      );

      try {
        await nextButton.scrollIntoViewIfNeeded();

        await nextButton.click({
          force: true,
          timeout: 10000,
        });
      } catch (error) {
        console.warn(
          `Could not click Next on page ${pageNumber}: ${error.message}`,
        );

        /*
         * Cookie overlay may have appeared between our first
         * cookie check and the click.
         */
        await handleCookiePopup(page);

        try {
          await nextButton.click({
            force: true,
            timeout: 10000,
          });
        } catch (retryError) {
          console.warn(
            `Retrying Next failed on page ${pageNumber}: ${retryError.message}`,
          );
          break;
        }
      }

      /*
       * Wait for the listing contents to actually change.
       *
       * The store uses client-side pagination, so URL changes
       * cannot be used as the page-change signal.
       */
      const pageChangedStart = Date.now();
      let pageChanged = false;

      while (Date.now() - pageChangedStart < 10000) {
        await page.waitForTimeout(300);

        const firstProductName = await getProductNameFromCard(
          page.locator("article.tile").first(),
        );

        if (firstProductName && firstProductName !== oldFirstProductName) {
          pageChanged = true;
          break;
        }
      }

      if (!pageChanged) {
        /*
         * It may still have changed even if the first product
         * happened to be identical. Give the page a little time.
         */
        await page.waitForTimeout(1000);
      }

      await handleCookiePopup(page);

      const nextPageLoaded = await waitForProductCards(page, 10000);

      if (!nextPageLoaded) {
        console.warn(
          `Product cards did not load after moving from page ${pageNumber}.`,
        );
        break;
      }
    }

    return results;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

module.exports = {
  searchProducts,
};
