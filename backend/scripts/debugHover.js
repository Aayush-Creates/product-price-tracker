const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: {
      width: 1440,
      height: 900,
    },
  });

  const page = await context.newPage();

  try {
    const url = "https://demo.inelabteamdev.com/product/450";

    console.log("[DEBUG] Opening:", url);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(1000);

    // ==================================================
    // PRODUCT
    // ==================================================

    console.log("[DEBUG] Product:", await page.locator("h1").innerText());

    // ==================================================
    // LOCATORS
    // ==================================================

    const priceBlock = page.locator(".price-block").first();

    const priceStatus = priceBlock.locator(".price-substatus").first();

    const revealButton = page
      .locator('button[aria-label="Reveal price"]')
      .first();

    // ==================================================
    // INITIAL STATE
    // ==================================================

    console.log("\n========== INITIAL ==========");

    console.log("[DEBUG] Price block count:", await priceBlock.count());

    console.log("[DEBUG] Status count:", await priceStatus.count());

    console.log("[DEBUG] Button count:", await revealButton.count());

    console.log("[DEBUG] Status:", await priceStatus.innerText());

    console.log("[DEBUG] Button disabled:", await revealButton.isDisabled());

    // ==================================================
    // BOUNDING BOXES
    // ==================================================

    console.log("\n========== BOUNDING BOXES ==========");

    const priceBlockBox = await priceBlock.boundingBox();

    const priceStatusBox = await priceStatus.boundingBox();

    const buttonBox = await revealButton.boundingBox();

    console.log("[DEBUG] price-block:", priceBlockBox);

    console.log("[DEBUG] price-status:", priceStatusBox);

    console.log("[DEBUG] reveal-button:", buttonBox);

    // ==================================================
    // HIDDEN STATE DOM
    // ==================================================

    console.log("\n========== PRICE BLOCK DOM ==========");

    const priceBlockHTML = await priceBlock.evaluate(
      (element) => element.outerHTML,
    );

    console.log(priceBlockHTML);

    // ==================================================
    // COMPUTED STYLE
    // ==================================================

    console.log("\n========== COMPUTED STYLE ==========");

    const styleInfo = await priceBlock.evaluate((element) => {
      const style = window.getComputedStyle(element);

      return {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        position: style.position,
        zIndex: style.zIndex,
      };
    });

    console.log(styleInfo);

    // ==================================================
    // ELEMENT AT DIFFERENT POSITIONS
    // ==================================================

    if (!priceBlockBox) {
      throw new Error("Price block has no bounding box");
    }

    console.log("\n========== ELEMENTS AT POSITIONS ==========");

    const positions = [
      {
        name: "left",
        x: priceBlockBox.x + 20,
        y: priceBlockBox.y + priceBlockBox.height / 2,
      },

      {
        name: "middle",
        x: priceBlockBox.x + priceBlockBox.width / 2,
        y: priceBlockBox.y + priceBlockBox.height / 2,
      },

      {
        name: "right",
        x: priceBlockBox.x + priceBlockBox.width - 20,
        y: priceBlockBox.y + priceBlockBox.height / 2,
      },

      {
        name: "top",
        x: priceBlockBox.x + priceBlockBox.width / 2,
        y: priceBlockBox.y + 10,
      },

      {
        name: "bottom",
        x: priceBlockBox.x + priceBlockBox.width / 2,
        y: priceBlockBox.y + priceBlockBox.height - 10,
      },
    ];

    for (const position of positions) {
      const element = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y);

          if (!el) {
            return null;
          }

          return {
            tagName: el.tagName,
            id: el.id,
            className: typeof el.className === "string" ? el.className : "",
            text: (el.innerText || "").trim().slice(0, 150),
          };
        },
        {
          x: position.x,
          y: position.y,
        },
      );

      console.log(`[DEBUG] ${position.name}:`, element);
    }

    // ==================================================
    // MOUSE TEST
    // ==================================================

    console.log("\n========== MOUSE HOVER TEST ==========");

    // Start completely away from price block.
    await page.mouse.move(10, 10);

    await page.waitForTimeout(1000);

    console.log("[DEBUG] Mouse positioned outside price block");

    // ------------------------------------------
    // Move to LEFT
    // ------------------------------------------

    console.log("\n[DEBUG] Moving to LEFT...");

    await page.mouse.move(
      priceBlockBox.x + 20,
      priceBlockBox.y + priceBlockBox.height / 2,
      {
        steps: 50,
      },
    );

    await page.waitForTimeout(1500);

    console.log("[DEBUG] Status after LEFT:", await priceStatus.innerText());

    console.log(
      "[DEBUG] Button disabled after LEFT:",
      await revealButton.isDisabled(),
    );

    // ------------------------------------------
    // Move to MIDDLE
    // ------------------------------------------

    console.log("\n[DEBUG] Moving to MIDDLE...");

    await page.mouse.move(
      priceBlockBox.x + priceBlockBox.width / 2,
      priceBlockBox.y + priceBlockBox.height / 2,
      {
        steps: 50,
      },
    );

    await page.waitForTimeout(1500);

    console.log("[DEBUG] Status after MIDDLE:", await priceStatus.innerText());

    console.log(
      "[DEBUG] Button disabled after MIDDLE:",
      await revealButton.isDisabled(),
    );

    // ------------------------------------------
    // Move to RIGHT
    // ------------------------------------------

    console.log("\n[DEBUG] Moving to RIGHT...");

    await page.mouse.move(
      priceBlockBox.x + priceBlockBox.width - 20,
      priceBlockBox.y + priceBlockBox.height / 2,
      {
        steps: 50,
      },
    );

    await page.waitForTimeout(1500);

    console.log("[DEBUG] Status after RIGHT:", await priceStatus.innerText());

    console.log(
      "[DEBUG] Button disabled after RIGHT:",
      await revealButton.isDisabled(),
    );

    // ==================================================
    // BUTTON HOVER
    // ==================================================

    if (buttonBox) {
      console.log("\n========== BUTTON HOVER ==========");

      await page.mouse.move(10, 10);

      await page.waitForTimeout(1000);

      await page.mouse.move(
        buttonBox.x + buttonBox.width / 2,
        buttonBox.y + buttonBox.height / 2,
        {
          steps: 50,
        },
      );

      await page.waitForTimeout(1500);

      console.log("[DEBUG] Status over button:", await priceStatus.innerText());

      console.log(
        "[DEBUG] Button disabled over button:",
        await revealButton.isDisabled(),
      );

      console.log(
        "[DEBUG] Button class:",
        await revealButton.getAttribute("class"),
      );
    }

    // ==================================================
    // LIST EVENT HANDLERS
    // ==================================================

    console.log("\n========== EVENT LISTENER DIAGNOSTIC ==========");

    const eventInfo = await priceBlock.evaluate((element) => {
      const result = {
        onmouseenter: typeof element.onmouseenter,
        onmouseover: typeof element.onmouseover,
        onmousemove: typeof element.onmousemove,
        onpointerenter: typeof element.onpointerenter,
        onpointerover: typeof element.onpointerover,
      };

      return result;
    });

    console.log(eventInfo);

    // ==================================================
    // SCREENSHOT
    // ==================================================

    await page.screenshot({
      path: "debug-hover-final.png",
      fullPage: false,
    });

    console.log("\n[DEBUG] Screenshot saved as:");

    console.log("debug-hover-final.png");

    console.log("\n[DEBUG] Browser will remain open.");

    // Keep browser open.
    await new Promise(() => {});
  } catch (error) {
    console.error("\n[DEBUG ERROR]", error);

    await browser.close();
  }
})();
