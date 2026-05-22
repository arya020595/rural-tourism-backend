const IS_PRODUCTION = process.env.NODE_ENV === "production";

let _browser = null;

async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    if (IS_PRODUCTION) {
      const puppeteer = require("puppeteer-core");
      const chromium = require("@sparticuz/chromium");
      _browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          "--disable-crash-reporter",
          "--disable-dev-shm-usage",
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      const puppeteer = require("puppeteer");
      _browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    }
  }
  return _browser;
}

module.exports = { getBrowser };
