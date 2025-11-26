// scrape.js
import puppeteer from "puppeteer";

export async function scrapeReact(url, { timeout = 30000 } = {}) {
  if (!url) return "NO_URL";

  let browser;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // set a sensible viewport & user-agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
    );

    // navigate and wait for network idle
    await page.goto(url, { waitUntil: "networkidle2", timeout });

    // optional: wait for main element if you know it
    // await page.waitForSelector('body', { timeout: 5000 });

    // get text content (you can adapt to pick selectors)
    const content = await page.evaluate(() => {
      // remove scripts and styles (should not be present in textContent)
      return document.body.innerText || "";
    });

    // return trimmed slice to avoid huge messages
    return content.replace(/\s+/g, " ").trim().slice(0, 60_000); // large enough
  } catch (err) {
    return "SCRAPE_ERROR_" + (err && err.message ? err.message : String(err));
  } finally {
    if (browser) await browser.close();
  }
}
