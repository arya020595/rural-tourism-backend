const fs = require("fs");
const path = require("path");
const { getBrowser } = require("./puppeteerBrowser");
const { packageItemTypeLabel, packageItemWhen } = require("./packageItemFormat");

const EXPLORE_SABAH_BASE64 = (() => {
  try {
    const imgPath = path.join(
      __dirname,
      "../assets/explore_sabah-without_bg.png",
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

const MONTHS_MY = ["JANUARI","FEBRUARI","MAC","APRIL","MEI","JUN","JULAI","OGOS","SEPTEMBER","OKTOBER","NOVEMBER","DISEMBER"];

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
    id, touristFullName, companyName, totalPax, customerType,
    packageItems, status, operatorName, operatorEmail, location,
    totalPrice, createdAt, companyLogoBase64,
  } = data;

  // "Issued By" uses the operator who created the booking, falling back to the
  // company name when no operator name was recorded.
  const issuedByName = escapeHtml(String(operatorName || "").trim() || companyName) || "-";

  const companyLogoSrc = companyLogoBase64
    ? (companyLogoBase64.startsWith("data:") ? companyLogoBase64 : `data:image/png;base64,${companyLogoBase64}`)
    : null;

  const companyLogoHtml = companyLogoSrc
    ? `<img class="logo" src="${companyLogoSrc}" alt="Company Logo" />`
    : `<span class="logo-text">${escapeHtml(companyName) || "-"}</span>`;

  const exploreSabahHtml = EXPLORE_SABAH_BASE64
    ? `<img class="logo" src="data:image/png;base64,${EXPLORE_SABAH_BASE64}" alt="Explore Sabah" />`
    : `<span class="logo-text" style="color:#2e7d32;">Explore SABAH</span>`;

  const bookedByLabel = String(customerType || "tourist").toLowerCase() === "company"
    ? "NAMA SYARIKAT/<em>COMPANY NAME</em>"
    : "DITEMPAH OLEH/<em>BOOKED BY</em>";

  const dateStr = escapeHtml(formatDate(createdAt));

  // Itinerary table (what, when) — same as the deposit receipt. No item
  // prices: how the total is split between companies stays internal.
  const packageTableHtml = Array.isArray(packageItems) && packageItems.length > 0
    ? `
      <div class="pkg-section">
        <div class="row-label">PAKEJ/<em>PACKAGE</em></div>
        <table class="pkg-table">
          <thead>
            <tr>
              <th class="pkg-no">NO</th>
              <th>AKTIVITI / PENGINAPAN<br><em>ACTIVITY / ACCOMMODATION</em></th>
              <th class="pkg-when">TARIKH / MASA ITINERARI<br><em>ITINERARY DATE / TIME</em></th>
            </tr>
          </thead>
          <tbody>
            ${packageItems.map((item, i) => {
              const when = packageItemWhen(item);
              const type = packageItemTypeLabel(item);
              return `
            <tr>
              <td class="pkg-no">${i + 1}</td>
              <td>
                <div class="pkg-name">${escapeHtml(item.description) || "-"}</div>
                ${type ? `<div class="pkg-sub">${escapeHtml(type)}</div>` : ""}
              </td>
              <td class="pkg-when">${escapeHtml(when.main)}${when.sub ? `<div class="pkg-sub">(${escapeHtml(when.sub)})</div>` : ""}</td>
            </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`
    : "";

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
  }
  .header-logos { display: flex; align-items: flex-end; gap: 14px; }
  .logo { object-fit: contain; height: 52px; max-width: 160px; display: block; }
  .logo-text { font-size: 14px; font-weight: bold; color: #333; }
  .logo-divider { width: 1px; height: 42px; background: #111; }
  .title {
    font-size: 20px;
    font-weight: bold;
    color: #2e7d32;
    margin-bottom: 14px;
  }
  hr { border: none; border-top: 1.5px solid #ddd; margin-bottom: 22px; }
  .receipt-meta {
    text-align: right;
  }
  .receipt-no {
    font-size: 12px;
    font-weight: bold;
    color: #222;
    margin-bottom: 4px;
    white-space: nowrap;
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
  .receipt-body { padding: 0 0 10px; /* the hr above already gives a 22px gap */ }
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 46px;
    row-gap: 22px;
    align-items: start;
  }
  .receipt-row { display: flex; flex-direction: column; gap: 6px; }
  .row-label { color: #4f4f4f; font-size: 11px; font-weight: 700; text-transform: uppercase; line-height: 1.25; }
  .row-value { color: #141414; font-size: 20px; font-weight: 700; text-transform: uppercase; line-height: 1.18; }
  .package-value { color: #141414; font-size: 20px; font-weight: 700; text-transform: uppercase; line-height: 1.5; }
  .receipt-footer {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 24px;
    border-top: 1px solid #d2d2d2;
    border-bottom: 1px solid #d2d2d2;
    padding-top: 16px;
    padding-bottom: 16px;
    margin-top: 10px;
  }
  .issued-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #4f4f4f; margin-bottom: 6px; }
  .issued-name { font-size: 18px; font-weight: 700; color: #1e1e1e; text-transform: uppercase; }
  .issued-email { font-size: 13px; color: #333; }
  .total-block { text-align: right; }
  .total-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #333; }
  .total-amount { font-size: 26px; font-weight: 700; color: #1a1a1a; line-height: 1; }
  .pkg-section { margin-top: 22px; }
  .pkg-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .pkg-table th { font-size: 10px; font-weight: 700; color: #4f4f4f; text-align: left; letter-spacing: 0.3px; padding: 7px 10px; background: #f1f6f2; border-bottom: 1px solid #cfdcd3; }
  .pkg-table th em { font-weight: 400; }
  .pkg-table td { font-size: 14px; color: #141414; padding: 9px 10px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
  .pkg-table .pkg-no { width: 30px; text-align: center; }
  .pkg-table .pkg-when { width: 38%; }
  .pkg-name { font-weight: 700; text-transform: uppercase; }
  .pkg-sub { font-size: 11px; color: #777; }
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
      <div class="receipt-meta">
        <div class="receipt-no">NO RESIT / RECEIPT NO : ${escapeHtml(String(data.receiptNo ?? data.id ?? "-"))}</div>
        <div class="receipt-date">${dateStr}</div>
      </div>
    </div>

    <div class="title">RESIT PEMBAYARAN / PAYMENT RECEIPT</div>
    <hr>

    <div class="receipt-body">
      <div class="details-grid">
        <div class="receipt-row">
          <div class="row-label">${bookedByLabel}</div>
          <div class="row-value">${escapeHtml(touristFullName) || "-"}</div>
        </div>
        <div class="receipt-row">
          <div class="row-label">NAMA PERNIAGAAN/<em>BUSINESS NAME</em></div>
          <div class="row-value">${escapeHtml(companyName) || "-"}</div>
        </div>
        <div class="receipt-row">
          <div class="row-label">BILANGAN ORANG/<em>TOTAL PAX</em></div>
          <div class="row-value">${escapeHtml(String(totalPax || 0))} ORANG</div>
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
      ${packageTableHtml}
    </div>

    <div class="receipt-footer">
      <div class="issued-block">
        <div class="issued-label">DIKELUARKAN OLEH/ISSUED BY:</div>
        <div class="issued-name">${issuedByName}</div>
        <div class="issued-email">${escapeHtml(operatorEmail)}</div>
      </div>
      <div class="total-block">
        <div class="total-label">JUMLAH/TOTAL:</div>
        <div class="total-amount">RM ${escapeHtml(Number(totalPrice || 0).toFixed(2))}</div>
      </div>
    </div>

  </div>
</body>
</html>`;
}

async function generatePackageReceiptPdf(data, pdfUrl) {
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
    console.error("Package receipt PDF error:", { message: error?.message, stack: error?.stack });
    throw error;
  } finally {
    await page.close();
  }
}

module.exports = { generatePackageReceiptPdf };

