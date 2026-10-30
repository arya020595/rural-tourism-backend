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


const MONTHS_MY = [
  "JANUARI",
  "FEBRUARI",
  "MAC",
  "APRIL",
  "MEI",
  "JUN",
  "JULAI",
  "OGOS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DISEMBER",
];

function formatHeaderDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = MONTHS_MY[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatActivityDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  // activity_date is stored "as typed" — read the UTC parts so the date is
  // the one the operator picked whatever the server's timezone.
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function buildHtml(data) {
  const {
    id,
    bookingType,
    touristFullName,
    companyName,
    productName,
    packageItems,
    totalPax,
    location,
    activityDate,
    checkInDate,
    checkOutDate,
    totalOfNight,
    status,
    operatorName,
    operatorEmail,
    totalPrice,
    totalDeposit,
    createdAt,
    companyLogoBase64,
  } = data;

  const isAccommodation = bookingType === "accommodation";
  const headerDate = escapeHtml(formatHeaderDate(createdAt));

  const companyLogoSrc = companyLogoBase64
    ? (companyLogoBase64.startsWith("data:") ? companyLogoBase64 : `data:image/png;base64,${companyLogoBase64}`)
    : null;
  const companyLogoHtml = companyLogoSrc
    ? `<div class="logo-company"><img src="${companyLogoSrc}" alt="Company Logo" /></div>`
    : `<div class="logo-company-name">${escapeHtml(companyName) || "-"}</div>`;

  const exploreSabahHtml = EXPLORE_SABAH_BASE64
    ? `<div class="logo-explore"><img src="data:image/png;base64,${EXPLORE_SABAH_BASE64}" alt="Explore Sabah" /></div>`
    : `<div class="logo-explore"><span class="explore-word">Explore</span><span class="sabah-word">SABAH</span><div class="sub">NORTH BORNEO, MALAYSIA</div></div>`;
  const activityDateFormatted = escapeHtml(formatActivityDate(activityDate));
  const checkInFormatted = escapeHtml(formatActivityDate(checkInDate));
  const checkOutFormatted = escapeHtml(formatActivityDate(checkOutDate));
  const totalNightsDisplay = escapeHtml(`${totalOfNight || 0} MALAM/NIGHTS`);
  const totalPaxDisplay = escapeHtml(`${totalPax || 0} ORANG`);
  const totalPriceFormatted = escapeHtml(Number(totalPrice || 0).toFixed(2));
  const totalDepositFormatted = escapeHtml(Number(totalDeposit || 0).toFixed(2));
  const safeTouristFullName = escapeHtml(touristFullName) || "-";
  const safeCompanyName = escapeHtml(companyName) || "-";
  const safeProductName = escapeHtml(productName) || "-";
  const safeLocation = escapeHtml(location) || "-";
  const safeStatus = escapeHtml((status || "").toUpperCase()) || "-";
  // Fall back to the company name when no operator name was provided,
  // matching the e-receipt PDF behaviour.
  const safeOperatorName =
    escapeHtml(String(operatorName || "").trim() || companyName) || "-";
  const safeOperatorEmail = escapeHtml(operatorEmail);

  const isPackage = bookingType === "package";

  // Product label + value differ per booking type. Package bookings list their
  // items instead of a single product name.
  const productLabel = isAccommodation
    ? "PENGINAPAN/<em>ACCOMMODATION</em>"
    : isPackage
      ? "PAKEJ/<em>PACKAGE</em>"
      : "AKTIVITI/<em>ACTIVITY</em>";

  const packageItemsHtml =
    Array.isArray(packageItems) && packageItems.length
      ? packageItems
          .map(
            (item, i) =>
              `<div>${i + 1}. ${escapeHtml(String(item.description || "-"))}</div>`,
          )
          .join("")
      : "-";

  const productValueHtml = isPackage ? packageItemsHtml : safeProductName;

  // Package: an itinerary table (what, when) replaces the plain list, and the
  // footer shows package total, deposit paid and balance. Item prices are not
  // shown — how the total is split between companies stays internal.
  const packageTableHtml =
    isPackage && Array.isArray(packageItems) && packageItems.length
      ? `
  <div class="pkg-section">
    <div class="field-label">PAKEJ/<em>PACKAGE</em></div>
    <table class="pkg-table">
      <thead>
        <tr>
          <th class="pkg-no">NO</th>
          <th>AKTIVITI / PENGINAPAN<br><em>ACTIVITY / ACCOMMODATION</em></th>
          <th class="pkg-when">TARIKH / MASA ITINERARI<br><em>ITINERARY DATE / TIME</em></th>
        </tr>
      </thead>
      <tbody>
        ${packageItems
          .map(
            (item, i) => `
        <tr>
          <td class="pkg-no">${i + 1}</td>
          <td>
            <div class="pkg-name">${escapeHtml(String(item.description || "-"))}</div>
            ${packageItemTypeLabel(item) ? `<div class="pkg-sub">${escapeHtml(packageItemTypeLabel(item))}</div>` : ""}
          </td>
          <td class="pkg-when">${escapeHtml(packageItemWhen(item).main)}${packageItemWhen(item).sub ? `<br><span class="pkg-sub">(${escapeHtml(packageItemWhen(item).sub)})</span>` : ""}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`
      : "";

  // Every booking type: total, deposit paid and the balance still to pay.
  const balance = Math.max(0, Number(totalPrice || 0) - Number(totalDeposit || 0));
  const totalLabel = isPackage
    ? "JUMLAH PAKEJ/<em>PACKAGE TOTAL</em>"
    : "JUMLAH/<em>TOTAL</em>";
  const totalsHtml = `
    <div class="total-block">
      <div class="amount-row"><span>${totalLabel} (RM)</span><span>${totalPriceFormatted}</span></div>
      <div class="amount-row"><span>DEPOSIT DIBAYAR/<em>DEPOSIT PAID</em> (RM)</span><span>${totalDepositFormatted}</span></div>
      <div class="amount-row amount-balance"><span>BAKI/<em>BALANCE</em> (RM)</span><span>${escapeHtml(balance.toFixed(2))}</span></div>
    </div>`;

  // Date rows differ per booking type.
  const dateRows = isAccommodation
    ? `
    <div>
      <div class="field-label">TARIKH DAFTAR MASUK/<em>CHECK IN DATE</em></div>
      <div class="field-value">${checkInFormatted}</div>
    </div>
    <div>
      <div class="field-label">TARIKH DAFTAR KELUAR/<em>CHECK OUT DATE</em></div>
      <div class="field-value">${checkOutFormatted}</div>
    </div>
    <div>
      <div class="field-label">JUMLAH MALAM/<em>TOTAL NO. OF NIGHTS</em></div>
      <div class="field-value">${totalNightsDisplay}</div>
    </div>`
    : `
    <div>
      <div class="field-label">${isPackage ? "TARIKH TEMPAHAN DIBUAT/<em>DATE BOOKING MADE</em>" : "TARIKH &amp; MASA/<em>ACTIVITY DATE &amp; TIME</em>"}</div>
      <div class="field-value">${isPackage ? activityDateFormatted : escapeHtml(packageItemWhen({ productType: "activity", activityDate }).main)}</div>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    padding: 48px 52px;
    color: #222;
    font-size: 13px;
  }

  /* â”€â”€ Header â”€â”€ */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 28px;
  }
  .logo-area {
    display: flex;
    align-items: center;
    gap: 0;
  }
  .logo-company {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-right: 16px;
    max-height: 64px;
  }
  .logo-company img {
    max-height: 64px;
    max-width: 100px;
    object-fit: contain;
  }
  .logo-company-name {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-right: 16px;
    font-size: 14px;
    font-weight: bold;
    color: #333;
  }
  .logo-divider {
    width: 1px;
    height: 64px;
    background: #ccc;
    margin: 0 16px;
  }
  .logo-explore img {
    max-height: 64px;
    max-width: 130px;
    object-fit: contain;
  }
  .booking-id-area {
    text-align: right;
    font-size: 12px;
    color: #555;
    line-height: 1.6;
  }
  .booking-id-area .id {
    font-weight: bold;
    color: #222;
  }

  /* â”€â”€ Title â”€â”€ */
  .title {
    font-size: 20px;
    font-weight: bold;
    color: #2e7d32;
    margin-bottom: 14px;
  }
  hr {
    border: none;
    border-top: 1.5px solid #ddd;
    margin-bottom: 22px;
  }
  /* Same 16px gap above the footer as the deposit notice has below it. */
  hr.footer-divider {
    margin-bottom: 16px;
  }

  /* â”€â”€ Info grid â”€â”€ */
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    row-gap: 22px;
    column-gap: 30px;
    margin-bottom: 22px;
  }
  .field-label {
    font-size: 9px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    margin-bottom: 5px;
  }
  .field-label em {
    font-style: italic;
  }
  .field-value {
    font-size: 18px;
    font-weight: bold;
    color: #111;
    text-transform: uppercase;
  }
  .full-width {
    grid-column: 1 / -1;
  }

  /* â”€â”€ Footer: issued-by (left) + total (right) â”€â”€ */
  .receipt-footer {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 24px;
  }
  .issued-label {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    color: #4f4f4f;
    margin-bottom: 6px;
  }
  .issued-name {
    font-size: 18px;
    font-weight: bold;
    color: #1e1e1e;
    text-transform: uppercase;
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
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #333;
    margin-bottom: 4px;
  }
  .total-value {
    font-size: 26px;
    font-weight: bold;
    color: #111;
    line-height: 1;
  }
  /* Package itinerary table + amounts */
  .pkg-section {
    margin-bottom: 22px;
  }
  .pkg-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
  }
  .pkg-table th {
    font-size: 9px;
    font-weight: bold;
    color: #555;
    text-align: left;
    letter-spacing: 0.3px;
    padding: 6px 8px;
    background: #f1f6f2;
    border-bottom: 1px solid #cfdcd3;
  }
  .pkg-table th em {
    font-style: italic;
    font-weight: normal;
  }
  .pkg-table td {
    font-size: 13px;
    color: #111;
    padding: 8px;
    border-bottom: 1px solid #e3e3e3;
    vertical-align: top;
  }
  .pkg-table .pkg-no {
    width: 28px;
    text-align: center;
  }
  .pkg-table .pkg-when {
    width: 38%;
  }
  .pkg-name {
    font-weight: bold;
    text-transform: uppercase;
  }
  .pkg-sub {
    font-size: 10px;
    color: #777;
  }
  .amount-row {
    display: flex;
    justify-content: space-between;
    gap: 24px;
    font-size: 12px;
    color: #333;
    padding: 2px 0;
  }
  .amount-row span:last-child {
    font-weight: bold;
    color: #111;
  }
  .amount-row em {
    font-style: italic;
  }
  .amount-balance {
    margin-top: 4px;
    padding-top: 6px;
    border-top: 1px solid #cfcfcf;
    font-size: 14px;
  }
  .amount-balance span:last-child {
    font-size: 20px;
  }
  .deposit-notice {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #d2d2d2;
    text-align: center;
    font-size: 12px;
    line-height: 1.6;
    color: #6d6d6d;
  }
  .deposit-notice em {
    font-style: italic;
  }
</style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="logo-area">
      ${exploreSabahHtml}
      <div class="logo-divider"></div>
      ${companyLogoHtml}
    </div>
    <div class="booking-id-area">
      <div>${headerDate}</div>
    </div>
  </div>

  <div class="title">PENGESAHAN TEMPAHAN / BOOKING CONFIRMATION</div>
  <hr>

  <!-- Info grid -->
  <div class="grid">
    <div>
      <div class="field-label">DITEMPAH OLEH/<em>BOOKED BY</em></div>
      <div class="field-value">${safeTouristFullName}</div>
    </div>
    <div>
      <div class="field-label">NAMA PERNIAGAAN/<em>BUSINESS NAME</em></div>
      <div class="field-value">${safeCompanyName}</div>
    </div>
    ${isPackage ? "" : `<div>
      <div class="field-label">${productLabel}</div>
      <div class="field-value">${productValueHtml}</div>
    </div>`}
    <div>
      <div class="field-label">BILANGAN ORANG/<em>TOTAL PAX</em></div>
      <div class="field-value">${totalPaxDisplay}</div>
    </div>
    <div>
      <div class="field-label">LOKASI/<em>LOCATION</em></div>
      <div class="field-value">${safeLocation}</div>
    </div>
    ${dateRows}
    <div class="${isPackage ? "" : "full-width"}">
      <div class="field-label">STATUS PEMBAYARAN/<em>PAYMENT STATUS</em></div>
      <div class="field-value">${safeStatus}</div>
    </div>
  </div>
${packageTableHtml}

  <hr class="footer-divider">

  <!-- Footer: issued-by (left) + total (right), matching the payment receipt -->
  <div class="receipt-footer">
    <div class="issued-block">
      <div class="issued-label">DIKELUARKAN OLEH/ISSUED BY:</div>
      <div class="issued-name">${safeOperatorName}</div>
      <div class="issued-email">${safeOperatorEmail}</div>
    </div>
    ${totalsHtml}
  </div>

  <div class="deposit-notice">
    Deposit tempahan adalah TIDAK BOLEH DIPULANGKAN. Tiada bayaran balik untuk pembatalan atau ketidakhadiran.<br>
    <em>Booking deposit is NON-REFUNDABLE. No refund for cancellations or no-shows.</em>
  </div>

</body>
</html>`;
}

async function generateBookingConfirmationPdf(data) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(buildHtml(data), { waitUntil: "domcontentloaded" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    return pdfBuffer;
  } catch (error) {
    console.error("Puppeteer PDF generation failed:", {
      message: error?.message || String(error),
      stack: error?.stack,
    });
    throw error;
  } finally {
    await page.close();
  }
}

module.exports = { generateBookingConfirmationPdf };

