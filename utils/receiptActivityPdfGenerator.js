const fs = require("fs");
const path = require("path");
const { getBrowser } = require("./puppeteerBrowser");

const EXPLORE_SABAH_BASE64 = (() => {
  try {
    const imgPath = path.join(
      __dirname,
      "../../rural-tourism-frontend/src/assets/icon/explore_sabah-without_bg.png",
    );
    return fs.readFileSync(imgPath).toString("base64");
  } catch {
    return null;
  }
})();

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MONTHS_MY = ["JAN","FEB","MAC","APR","MEI","JUN","JUL","OGO","SEP","OKT","NOV","DIS"];

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS_MY[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function buildHtml(data, pdfUrl) {
  const {
    id, touristFullName, companyName, activityName,
    totalPax, location, status, operatorName, operatorEmail,
    totalPrice, createdAt, companyLogoBase64,
  } = data;

  const companyLogoSrc = companyLogoBase64
    ? (companyLogoBase64.startsWith("data:") ? companyLogoBase64 : `data:image/png;base64,${companyLogoBase64}`)
    : null;

  const companyLogoHtml = companyLogoSrc
    ? `<img class="logo" src="${companyLogoSrc}" alt="Company Logo" />`
    : `<span class="logo-text">${escapeHtml(companyName) || "-"}</span>`;

  const exploreSabahHtml = EXPLORE_SABAH_BASE64
    ? `<img class="logo" src="data:image/png;base64,${EXPLORE_SABAH_BASE64}" alt="Explore Sabah" />`
    : `<span class="logo-text" style="color:#2e7d32;">Explore SABAH</span>`;

  const dateStr = escapeHtml(formatDate(createdAt));
  const qrDataUrl = pdfUrl;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #ffffff;
    font-family: Arial, Helvetica, sans-serif;
    padding: 40px 48px;
    color: #222;
  }
  .receipt-card {
    width: 100%;
  }
  .receipt-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding-bottom: 20px;
    border-bottom: 1px solid #d2d2d2;
  }
  .header-logos {
    display: flex;
    align-items: flex-end;
    gap: 14px;
  }
  .logo {
    object-fit: contain;
    height: 52px;
    max-width: 160px;
    display: block;
  }
  .logo-text {
    font-size: 14px;
    font-weight: bold;
    color: #333;
  }
  .logo-divider {
    width: 1px;
    height: 42px;
    background: #111;
  }
  .receipt-date {
    font-size: 18px;
    font-weight: 600;
    color: #222;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    white-space: nowrap;
    font-family: monospace;
  }
  .receipt-body {
    padding: 20px 0 10px;
  }
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 46px;
    row-gap: 22px;
    align-items: start;
  }
  .receipt-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row-label {
    color: #4f4f4f;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1.25;
  }
  .row-value {
    color: #141414;
    font-size: 20px;
    font-weight: 700;
    text-transform: uppercase;
    line-height: 1.18;
  }
  .receipt-footer {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 24px;
    border-top: 1px solid #d2d2d2;
    padding-top: 16px;
    margin-top: 10px;
  }
  .issued-name {
    font-size: 18px;
    font-weight: 700;
    color: #1e1e1e;
    text-transform: uppercase;
  }
  .issued-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #4f4f4f;
    margin-bottom: 6px;
  }
  .issued-email {
    font-size: 13px;
    color: #333;
  }
  .total-block {
    text-align: right;
  }
  .total-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #333;
  }
  .total-amount {
    font-size: 26px;
    font-weight: 700;
    color: #1a1a1a;
    line-height: 1;
  }
  .receipt-qr-section {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #d2d2d2;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
  }
  .qr-text {
    text-align: right;
    font-size: 11px;
    line-height: 1.5;
    color: #2d2d2d;
  }
  .qr-en { font-style: italic; }
  .qr-img {
    width: 100px;
    height: 100px;
  }
</style>
</head>
<body>
  <div class="receipt-card">
    <div class="receipt-header">
      <div class="header-logos">
        ${exploreSabahHtml}
        <div class="logo-divider"></div>
        ${companyLogoHtml}
      </div>
      <div class="receipt-date">${dateStr}</div>
    </div>

    <div class="receipt-body">
      <div class="details-grid">
        <div class="receipt-row">
          <div class="row-label">DITEMPAH OLEH/<em>BOOKED BY</em></div>
          <div class="row-value">${escapeHtml(touristFullName) || "-"}</div>
        </div>
        <div class="receipt-row">
          <div class="row-label">AKTIVITI/<em>ACTIVITY</em></div>
          <div class="row-value">${escapeHtml(activityName) || "-"}</div>
        </div>
        <div class="receipt-row">
          <div class="row-label">BILANGAN ORANG/<em>TOTAL PAX</em></div>
          <div class="row-value">${escapeHtml(String(totalPax || 0))} ORANG</div>
        </div>
        <div class="receipt-row">
          <div class="row-label">NAMA PERNIAGAAN/<em>BUSINESS NAME</em></div>
          <div class="row-value">${escapeHtml(companyName) || "-"}</div>
        </div>
        <div class="receipt-row">
          <div class="row-label">LOKASI/<em>LOCATION</em></div>
          <div class="row-value">${escapeHtml(location) || "-"}</div>
        </div>
        <div class="receipt-row">
          <div class="row-label">STATUS PEMBAYARAN/<em>PAYMENT STATUS</em></div>
          <div class="row-value">${escapeHtml((status || "paid").toUpperCase())}</div>
        </div>
      </div>
    </div>

    <div class="receipt-footer">
      <div class="issued-block">
        <div class="issued-label">DIKELUARKAN OLEH/ISSUED BY:</div>
        <div class="issued-name">${escapeHtml(companyName) || "-"}</div>
        <div class="issued-email">${escapeHtml(operatorEmail)}</div>
      </div>
      <div class="total-block">
        <div class="total-label">JUMLAH/TOTAL:</div>
        <div class="total-amount">RM ${escapeHtml(Number(totalPrice || 0).toFixed(2))}</div>
      </div>
    </div>

    <div class="receipt-qr-section">
      <div class="qr-text">
        <span>Imbas di sini untuk mendapatkan resit anda</span><br>
        <span class="qr-en">Scan here to get your receipt</span>
      </div>
      <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrDataUrl)}" alt="QR" />
    </div>
  </div>
</body>
</html>`;
}

async function generateActivityReceiptPdf(data, pdfUrl) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildHtml(data, pdfUrl), { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    return pdfBuffer;
  } catch (error) {
    console.error("Activity receipt PDF error:", { message: error?.message, stack: error?.stack });
    throw error;
  } finally {
    await page.close();
  }
}

module.exports = { generateActivityReceiptPdf };
