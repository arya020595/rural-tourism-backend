const IS_LINUX = process.platform === "linux";

let _browser = null;

async function getBrowser() {
  if (!_browser || !_browser.isConnected()) {
    if (IS_LINUX) {
      const puppeteer = require("puppeteer-core");
      const chromium = require("@sparticuz/chromium");
      _browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    } else {
      const puppeteer = require("puppeteer");
      _browser = await puppeteer.launch({ headless: true });
    }
  }
  return _browser;
}

module.exports = { getBrowser };
