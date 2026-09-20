const { chromium } = require("playwright");

/**
 * INE Store browser scraper
 *
 * Handles:
 * - Random cookie popup
 * - Hover-to-load price
 * - Reveal Price button
 * - Asynchronous price loading
 * - Multiple price number formats
 * - Multiple stock/availability badge formats
 * - Retry without unnecessarily restarting the browser
 */

async function scrapeWithBrowser(productUrl, options = {}) {
  const { headless = true, timeout = 30000 } = options;

  const TIMEOUTS = {
    pageLoad: timeout,
    priceBlock: 10000,
    hoverState: 8000,
    buttonActivation: 5000,
    priceLoad: 8000,
    revealAttempts: 3,
  };

  const browser = await chromium.launch({
    headless,
    slowMo: headless ? 0 : 200,
  });

  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 900,
    },
  });

  const page = await context.newPage();

  let cookieWatcher = null;

  try {
    // ==================================================
    // 1. OPEN PRODUCT PAGE
    // ==================================================

    console.log(`[SCRAPER] Opening: ${productUrl}`);

    await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.pageLoad,
    });

    console.log("[SCRAPER] Page loaded");

    await page.waitForTimeout(300);

    // ==================================================
    // 2. START COOKIE WATCHER
    // ==================================================

    cookieWatcher = startCookieWatcher(page);

    await dismissCookieIfPresent(page);

    // ==================================================
    // 3. PRODUCT NAME
    // ==================================================

    const productName = (await page.locator("h1").first().innerText()).trim();

    if (!productName) {
      throw new Error("Product name could not be extracted");
    }

    console.log(`[SCRAPER] Product: ${productName}`);

    // ==================================================
    // 4. PRICE BLOCK
    // ==================================================

    const priceBlock = page.locator(".price-block").first();

    await priceBlock.waitFor({
      state: "visible",
      timeout: TIMEOUTS.priceBlock,
    });

    console.log("[SCRAPER] Price block found");

    // ==================================================
    // 5. CHECK IF ALREADY REVEALED
    // ==================================================

    const successBlock = page.locator(".price-block.price-success").first();

    if (await isVisible(successBlock)) {
      console.log("[SCRAPER] Price is already revealed");
    } else {
      // ==================================================
      // 6. REVEAL PRICE BUTTON
      // ==================================================

      const revealButton = page
        .locator('button[aria-label="Reveal price"]')
        .first();

      await revealButton.waitFor({
        state: "attached",
        timeout: TIMEOUTS.priceBlock,
      });

      console.log("[SCRAPER] Reveal price button found");

      const priceStatus = priceBlock.locator(".price-substatus").first();

      console.log(
        `[SCRAPER] Initial price status: "${await safeText(priceStatus)}"`,
      );

      // ==================================================
      // 7. HOVER PRICE AREA
      // ==================================================

      await hoverPriceArea(page, priceBlock, priceStatus, TIMEOUTS.hoverState);

      console.log("[SCRAPER] Price area entered interactive state");

      // ==================================================
      // 8. REVEAL ATTEMPTS
      // ==================================================

      let priceRevealed = false;

      for (let attempt = 1; attempt <= TIMEOUTS.revealAttempts; attempt++) {
        console.log(
          `[SCRAPER] Reveal attempt ${attempt}/${TIMEOUTS.revealAttempts}`,
        );

        await dismissCookieIfPresent(page);

        // Re-establish hover before each attempt.
        await hoverPriceArea(page, priceBlock, priceStatus, 5000);

        console.log("[SCRAPER] Hovering over Reveal price button...");

        await revealButton.hover({
          force: true,
        });

        await page.waitForTimeout(250);

        const buttonEnabled = await waitForButtonEnabled(
          revealButton,
          TIMEOUTS.buttonActivation,
        );

        await logButtonState(revealButton, `Reveal attempt ${attempt}`);

        if (!buttonEnabled) {
          console.log("[SCRAPER] Reveal price button did not become enabled");

          if (attempt < TIMEOUTS.revealAttempts) {
            continue;
          }

          throw new Error("Reveal price button did not become enabled");
        }

        console.log("[SCRAPER] Reveal price button is enabled");

        // ==================================================
        // CLICK REVEAL PRICE
        // ==================================================

        console.log("[SCRAPER] Clicking Reveal price...");

        await revealButton.click({
          timeout: 3000,
        });

        console.log("[SCRAPER] Reveal price click completed");

        // Cookie can appear immediately after click.
        await dismissCookieIfPresent(page);

        // ==================================================
        // WAIT FOR PRICE SUCCESS
        // ==================================================

        console.log("[SCRAPER] Waiting for price...");

        priceRevealed = await waitForPriceSuccess(
          page,
          successBlock,
          TIMEOUTS.priceLoad,
        );

        if (priceRevealed) {
          console.log("[SCRAPER] Price successfully revealed");

          break;
        }

        console.log("[SCRAPER] Price did not appear yet");

        if (attempt < TIMEOUTS.revealAttempts) {
          console.log(
            "[SCRAPER] Re-establishing hover and retrying Reveal Price...",
          );

          await page.waitForTimeout(300);
        }
      }

      if (!priceRevealed) {
        throw new Error(
          "Price did not become available after Reveal Price attempts",
        );
      }
    }

    // ==================================================
    // 9. EXTRACT CURRENT PRICE
    // ==================================================

    const priceText = await extractCurrentPriceText(successBlock);

    console.log(`[SCRAPER] Raw price: ${priceText}`);

    const price = parsePrice(priceText);

    // ==================================================
    // 10. VALIDATE PRICE
    // ==================================================

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Invalid price extracted: "${priceText}"`);
    }

    console.log(`[SCRAPER] Price: ₹${price}`);

    // ==================================================
    // 11. EXTRACT STOCK / AVAILABILITY
    // ==================================================

    const stock = await extractStock(page, successBlock);

    console.log(`[SCRAPER] Stock: ${stock}`);

    if (!stock) {
      throw new Error("Stock information could not be extracted");
    }

    // ==================================================
    // 12. FINAL RESULT
    // ==================================================

    return {
      productName,
      price,
      stock,
      url: productUrl,
    };
  } finally {
    if (cookieWatcher) {
      clearInterval(cookieWatcher);
    }

    await browser.close();
  }
}

/* ======================================================
   PRICE AREA / HOVER
====================================================== */

async function hoverPriceArea(page, priceBlock, priceStatus, timeout) {
  await dismissCookieIfPresent(page);

  const box = await priceBlock.boundingBox();

  if (!box) {
    throw new Error("Price block has no bounding box");
  }

  console.log("[SCRAPER] Moving mouse outside price block...");

  await page.mouse.move(10, 10, {
    steps: 10,
  });

  await page.waitForTimeout(150);

  console.log("[SCRAPER] Hovering over price block...");

  await page.mouse.move(box.x + 20, box.y + box.height / 2, {
    steps: 30,
  });

  await page.waitForTimeout(250);

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 30,
  });

  console.log("[SCRAPER] Hovered over price block");

  const ready = await waitForInteractivePriceState(
    page,
    priceStatus,
    timeout,
    priceBlock,
  );

  if (!ready) {
    throw new Error(
      `Price area did not enter interactive state. ` +
        `Current status: "${await safeText(priceStatus)}"`,
    );
  }
}

async function waitForInteractivePriceState(
  page,
  priceStatus,
  timeout,
  priceBlock,
) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    await dismissCookieIfPresent(page);

    const text = await safeText(priceStatus);

    if (/check the current price and availability/i.test(text)) {
      console.log(`[SCRAPER] Hover status detected: "${text}"`);

      return true;
    }

    const box = await priceBlock.boundingBox();

    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
        steps: 10,
      });
    }

    await page.waitForTimeout(200);
  }

  return false;
}

/* ======================================================
   BUTTON
====================================================== */

async function waitForButtonEnabled(button, timeout) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      if (await button.isEnabled()) {
        return true;
      }
    } catch (error) {
      // DOM may be updating.
    }

    await sleep(100);
  }

  return false;
}

/* ======================================================
   PRICE SUCCESS
====================================================== */

async function waitForPriceSuccess(page, successBlock, timeout) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    await dismissCookieIfPresent(page);

    if (await isVisible(successBlock)) {
      return true;
    }

    await page.waitForTimeout(200);
  }

  return false;
}

/* ======================================================
   COOKIE HANDLING
====================================================== */

function startCookieWatcher(page) {
  let handling = false;

  const interval = setInterval(async () => {
    if (handling) {
      return;
    }

    handling = true;

    try {
      await dismissCookieIfPresent(page);
    } catch (error) {
      // Ignore watcher errors.
    } finally {
      handling = false;
    }
  }, 250);

  return interval;
}

async function dismissCookieIfPresent(page) {
  const selectors = [
    'button:has-text("ACCEPT")',
    '[role="button"]:has-text("ACCEPT")',
    'input[type="button"][value="ACCEPT"]',
    'input[type="submit"][value="ACCEPT"]',
  ];

  for (const frame of page.frames()) {
    for (const selector of selectors) {
      try {
        const button = frame.locator(selector).first();

        if ((await button.count()) === 0) {
          continue;
        }

        if (!(await button.isVisible())) {
          continue;
        }

        console.log("[COOKIE] Cookie popup detected");

        console.log("[COOKIE] Clicking ACCEPT...");

        await button.click({
          timeout: 2000,
        });

        console.log("[COOKIE] Cookie accepted");

        await page.waitForTimeout(200);

        return true;
      } catch (error) {
        // Try another selector.
      }
    }
  }

  return false;
}

/* ======================================================
   PRICE EXTRACTION
====================================================== */

async function extractCurrentPriceText(successBlock) {
  /*
   * The current price is the visible <b>
   * inside .price-main.
   *
   * Example:
   *
   * <b class="v5919fm">
   *     ₹5,963
   * </b>
   */

  const boldPrices = successBlock.locator(".price-main b");

  const boldCount = await boldPrices.count();

  for (let i = 0; i < boldCount; i++) {
    const candidate = boldPrices.nth(i);

    try {
      if (!(await candidate.isVisible())) {
        continue;
      }

      const text = (await candidate.innerText()).trim();

      if (/\d/.test(text)) {
        return text;
      }
    } catch (error) {
      // Continue.
    }
  }

  /*
   * Fallback: any visible price-like element.
   */

  const candidates = successBlock.locator(".price-main *");

  const count = await candidates.count();

  for (let i = 0; i < count; i++) {
    const candidate = candidates.nth(i);

    try {
      if (!(await candidate.isVisible())) {
        continue;
      }

      const text = (await candidate.innerText()).trim();

      if (/(?:₹|Rs\.?|INR)\s*[\d.,]+/i.test(text)) {
        return text;
      }
    } catch (error) {
      // Continue.
    }
  }

  /*
   * Final fallback.
   */

  const blockText = (await successBlock.innerText()).trim();

  const match = blockText.match(/(?:₹|Rs\.?|INR)\s*[\d.,]+/i);

  if (match) {
    return match[0];
  }

  throw new Error(
    `Could not find current displayed price. ` +
      `Success block text: "${blockText}"`,
  );
}

/**
 * Parse price robustly.
 *
 * Handles:
 *
 * ₹5,963
 * ₹5,963.00
 * ₹5.963,00
 * ₹9,295
 * ₹1,48,988
 * Rs. 32,672.00
 * INR 25,609
 */
function parsePrice(value) {
  if (!value) {
    return null;
  }

  let cleaned = String(value)
    .replace(/[^\d.,-]/g, "")
    .trim();

  if (!cleaned) {
    return null;
  }

  /*
   * Remove negative sign if present.
   * Product prices should be positive.
   */
  cleaned = cleaned.replace(/-/g, "");

  const hasComma = cleaned.includes(",");

  const hasDot = cleaned.includes(".");

  // --------------------------------------------------
  // Case 1:
  // Both comma and dot exist.
  //
  // Determine the LAST separator as decimal separator.
  //
  // Example:
  // 5.963,00  -> 5963
  // 32,672.00 -> 32672
  // --------------------------------------------------

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");

    const lastDot = cleaned.lastIndexOf(".");

    const decimalSeparator = lastComma > lastDot ? "," : ".";

    const thousandsSeparator = decimalSeparator === "," ? "." : ",";

    cleaned = cleaned.replace(new RegExp(`\\${thousandsSeparator}`, "g"), "");

    cleaned = cleaned.replace(decimalSeparator, ".");

    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : null;
  }

  // --------------------------------------------------
  // Case 2:
  // Only comma exists.
  //
  // Examples:
  //
  // 5,963     -> 5963
  // 1,48,988  -> 148988
  // 5963,00   -> 5963
  //
  // If exactly 2 digits follow comma, treat it
  // as decimal. Otherwise comma is thousands.
  // --------------------------------------------------

  if (hasComma && !hasDot) {
    const parts = cleaned.split(",");

    const lastPart = parts[parts.length - 1];

    if (parts.length === 2 && lastPart.length === 2) {
      cleaned = `${parts[0]}.${lastPart}`;
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }

    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : null;
  }

  // --------------------------------------------------
  // Case 3:
  // Only dot exists.
  //
  // Examples:
  //
  // 5963.00 -> 5963
  // 5.963   -> potentially 5963
  //
  // If exactly 2 digits follow dot, decimal.
  // Otherwise treat dot as thousands separator.
  // --------------------------------------------------

  if (hasDot && !hasComma) {
    const parts = cleaned.split(".");

    const lastPart = parts[parts.length - 1];

    if (parts.length === 2 && lastPart.length === 2) {
      const parsed = Number(cleaned);

      return Number.isFinite(parsed) ? parsed : null;
    }

    /*
     * 5.963 is a thousands-formatted price,
     * not ₹5.963 for this ecommerce site.
     */
    cleaned = cleaned.replace(/\./g, "");

    const parsed = Number(cleaned);

    return Number.isFinite(parsed) ? parsed : null;
  }

  // --------------------------------------------------
  // Case 4:
  // Plain integer
  // --------------------------------------------------

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

/* ======================================================
   STOCK / AVAILABILITY EXTRACTION
====================================================== */

/**
 * Extract availability from the price block.
 *
 * Observed formats:
 *
 * 137 IN STOCK
 *
 * IN STOCK - 15 LEFT
 *
 * SELLING FAST — 153 LEFT
 *
 * HURRY, JUST 149 LEFT
 *
 * OUT OF STOCK
 *
 * We inspect the price block first because the badge
 * belongs to the product's live price/availability
 * information.
 */
async function extractStock(page, successBlock) {
  // --------------------------------------------------
  // 1. Get text from price block
  // --------------------------------------------------

  let priceBlockText = "";

  try {
    priceBlockText = (await successBlock.innerText()).trim();
  } catch (error) {
    priceBlockText = "";
  }

  console.log(`[SCRAPER] Price block availability text: "${priceBlockText}"`);

  // --------------------------------------------------
  // 2. OUT OF STOCK
  // --------------------------------------------------

  if (/OUT\s*OF\s*STOCK/i.test(priceBlockText)) {
    return "OUT OF STOCK";
  }

  // --------------------------------------------------
  // 3. IN STOCK + LEFT
  //
  // Example:
  // IN STOCK - 15 LEFT
  // --------------------------------------------------

  const inStockLeft = priceBlockText.match(
    /IN\s*STOCK\s*[-–—]?\s*(\d+)\s*LEFT/i,
  );

  if (inStockLeft) {
    return `IN STOCK - ${inStockLeft[1]} LEFT`;
  }

  // --------------------------------------------------
  // 4. NUMBER + IN STOCK
  //
  // Example:
  // 137 IN STOCK
  // --------------------------------------------------

  const numberInStock = priceBlockText.match(/(\d+)\s*IN\s*STOCK/i);

  if (numberInStock) {
    return `${numberInStock[1]} IN STOCK`;
  }

  // --------------------------------------------------
  // 5. GENERIC IN STOCK
  // --------------------------------------------------

  if (/IN\s*STOCK/i.test(priceBlockText)) {
    return "IN STOCK";
  }

  // --------------------------------------------------
  // 6. "SELLING FAST — 153 LEFT"
  // --------------------------------------------------

  const sellingFast = priceBlockText.match(
    /SELLING\s*FAST\s*[-–—:]?\s*(\d+)\s*LEFT/i,
  );

  if (sellingFast) {
    return `SELLING FAST - ${sellingFast[1]} LEFT`;
  }

  // --------------------------------------------------
  // 7. "HURRY, JUST 149 LEFT"
  // --------------------------------------------------

  const hurryLeft = priceBlockText.match(/HURRY\s*,?\s*JUST\s*(\d+)\s*LEFT/i);

  if (hurryLeft) {
    return `HURRY, JUST ${hurryLeft[1]} LEFT`;
  }

  // --------------------------------------------------
  // 8. GENERIC NUMBER + LEFT
  //
  // This catches other wording we haven't explicitly
  // seen yet.
  // --------------------------------------------------

  const genericLeft = priceBlockText.match(/(\d+)\s*LEFT/i);

  if (genericLeft) {
    return `${genericLeft[1]} LEFT`;
  }

  // --------------------------------------------------
  // 9. Inspect visible elements
  //
  // Sometimes the badge text may not be included
  // cleanly in innerText().
  // --------------------------------------------------

  const badgeCandidates = successBlock.locator("span, b, strong, small, div");

  const count = await badgeCandidates.count();

  for (let i = 0; i < count; i++) {
    const candidate = badgeCandidates.nth(i);

    try {
      if (!(await candidate.isVisible())) {
        continue;
      }

      const text = (await candidate.innerText()).replace(/\s+/g, " ").trim();

      if (!text) {
        continue;
      }

      if (/OUT\s*OF\s*STOCK/i.test(text)) {
        return "OUT OF STOCK";
      }

      const leftMatch = text.match(/(\d+)\s*LEFT/i);

      if (leftMatch) {
        return text;
      }

      if (/\bIN\s*STOCK\b/i.test(text)) {
        return text;
      }
    } catch (error) {
      // Continue.
    }
  }

  // --------------------------------------------------
  // 10. Last fallback: whole page
  // --------------------------------------------------

  const bodyText = await page.locator("body").innerText();

  if (/OUT\s*OF\s*STOCK/i.test(bodyText)) {
    return "OUT OF STOCK";
  }

  const bodyInStockLeft = bodyText.match(/IN\s*STOCK\s*[-–—]?\s*(\d+)\s*LEFT/i);

  if (bodyInStockLeft) {
    return `IN STOCK - ${bodyInStockLeft[1]} LEFT`;
  }

  const bodyNumberStock = bodyText.match(/(\d+)\s*IN\s*STOCK/i);

  if (bodyNumberStock) {
    return `${bodyNumberStock[1]} IN STOCK`;
  }

  const bodySellingFast = bodyText.match(
    /SELLING\s*FAST\s*[-–—:]?\s*(\d+)\s*LEFT/i,
  );

  if (bodySellingFast) {
    return `SELLING FAST - ${bodySellingFast[1]} LEFT`;
  }

  const bodyHurry = bodyText.match(/HURRY\s*,?\s*JUST\s*(\d+)\s*LEFT/i);

  if (bodyHurry) {
    return `HURRY, JUST ${bodyHurry[1]} LEFT`;
  }

  const bodyLeft = bodyText.match(/(\d+)\s*LEFT/i);

  if (bodyLeft) {
    return `${bodyLeft[1]} LEFT`;
  }

  return null;
}

/* ======================================================
   HELPERS
====================================================== */

async function safeText(locator) {
  try {
    if ((await locator.count()) === 0) {
      return "";
    }

    return (await locator.innerText()).trim();
  } catch (error) {
    return "";
  }
}

async function isVisible(locator) {
  try {
    return await locator.isVisible();
  } catch (error) {
    return false;
  }
}

async function logButtonState(button, label) {
  try {
    console.log(`[SCRAPER] ${label} button state:`, {
      disabled: await button.isDisabled(),

      disabledAttribute: await button.getAttribute("disabled"),

      ariaDisabled: await button.getAttribute("aria-disabled"),

      className: await button.getAttribute("class"),
    });
  } catch (error) {
    console.log(`[SCRAPER] Could not inspect button: ${error.message}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  scrapeWithBrowser,
  parsePrice,
  extractStock,
};
