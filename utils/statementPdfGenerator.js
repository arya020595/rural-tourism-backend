const { getBrowser } = require("./browserHelper");


function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(data) {
  const { company, ownerName, year, transactions, createdAt, fromDate, toDate, summary, overallTotal } = data;

  const rawLogo = company?.logoBase64 || null;
  const logoSrc = rawLogo
    ? (rawLogo.startsWith("data:") ? rawLogo : `data:image/png;base64,${rawLogo}`)
    : null;
  const companyLogoHtml = logoSrc
    ? `<img class="company-logo" src="${logoSrc}" alt="Company Logo" />`
    : `<div class="company-logo-placeholder">${escapeHtml(company?.name || "")}</div>`;

  const transactionRows = transactions
    .map(
      (t) => `
    <tr>
      <td>${escapeHtml(String(t.year))}</td>
      <td>${escapeHtml(t.month)}</td>
      <td>${escapeHtml(t.type)}</td>
      <td class="name-cell">${escapeHtml(t.name)}</td>
      <td class="center">${escapeHtml(String(t.noOfPax))}</td>
      <td class="right">RM ${escapeHtml(t.totalPrice)}</td>
    </tr>`,
    )
    .join("");

  const emptyRow =
    transactions.length === 0
      ? `<tr><td colspan="6" class="empty-row">No transactions found for ${escapeHtml(String(year))}</td></tr>`
      : "";

  const summaryRows = (summary || [])
    .map(
      (s) => `
    <tr>
      <td class="center">${escapeHtml(String(s.no))}</td>
      <td>${escapeHtml(s.name)}</td>
      <td class="center">${escapeHtml(s.type)}</td>
      <td class="center">${escapeHtml(String(s.totalPax))}</td>
      <td class="right">RM ${escapeHtml(s.totalRevenue)}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #222;
    font-size: 13px;
  }

  /* ── Header logos ── */
  .header-logos {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    margin-bottom: 20px;
  }
  .company-logo {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
  }
  .company-logo-placeholder {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: #e8e8e8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #666;
    text-align: center;
    padding: 8px;
  }
  /* ── Company info (centered, below logos) ── */
  .company-info {
    text-align: center;
    margin-bottom: 28px;
  }
  .company-name {
    font-size: 17px;
    font-weight: bold;
    color: #111;
    margin-bottom: 3px;
  }
  .company-est {
    font-size: 12px;
    color: #4a7c59;
  }

  /* ── Section header (dark green bar) ── */
  .section-header {
    background: #1a5c38;
    color: #fff;
    font-size: 13px;
    font-weight: bold;
    padding: 9px 16px;
    margin-bottom: 8px;
  }

  /* ── Business details table ── */
  .details-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #ddd;
    border-top: none;
    margin-bottom: 24px;
  }
  .details-table tr { border-bottom: 1px solid #eee; }
  .details-table tr:last-child { border-bottom: none; }
  .details-table td {
    padding: 10px 16px;
    vertical-align: top;
    line-height: 1.5;
  }
  .details-table td:first-child {
    font-weight: bold;
    width: 40%;
    color: #333;
  }
  .details-table td:last-child {
    color: #555;
    text-align: right;
  }

  /* ── Transaction table ── */
  .transaction-table {
    width: 100%;
    border-collapse: collapse;
  }
  .transaction-table thead tr { background: #1a5c38; }
  .transaction-table thead th {
    color: #fff;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: bold;
    text-align: left;
  }
  .transaction-table thead th.center { text-align: center; }
  .transaction-table thead th.right  { text-align: right; }
  .transaction-table tbody tr { border-bottom: 1px solid #eee; }
  .transaction-table tbody tr:nth-child(even) { background: #f8faf9; }
  .transaction-table tbody td {
    padding: 9px 12px;
    font-size: 12px;
    color: #333;
    vertical-align: top;
  }
  .transaction-table tbody td.center { text-align: center; }
  .transaction-table tbody td.right  { text-align: right; }
  .transaction-table tbody td.name-cell { max-width: 200px; word-wrap: break-word; }
  .empty-row {
    text-align: center;
    color: #999;
    padding: 28px 0 !important;
    font-style: italic;
  }

  /* ── Account Statement header ── */
  .account-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #1a5c38;
    color: #fff;
    font-size: 13px;
    font-weight: bold;
    padding: 9px 16px;
    margin-top: 20px;
  }
  .date-range {
    text-align: right;
    font-size: 12px;
    color: #555;
    font-style: italic;
    margin-bottom: 8px;
    margin-top: 4px;
  }

  /* ── Summary total row ── */
  .summary-total td {
    font-weight: bold;
    background: #1a5c38;
    color: #fff !important;
  }
</style>
</head>
<body>

  <!-- Header: company logo -->
  <div class="header-logos">
    ${companyLogoHtml}
  </div>

  <!-- Company name + established year -->
  <div class="company-info">
    <div class="company-name">${escapeHtml(company?.name || "-")}</div>
    <div class="company-est">Est. ${escapeHtml(String(company?.establishedYear || year))}</div>
  </div>

  <!-- Business Details -->
  <div class="section-header">Butiran Perniagaan/Business Details</div>
  <table class="details-table">
    <tr>
      <td>Nama Perniagaan/Business Name</td>
      <td>${escapeHtml(company?.name || "-")}</td>
    </tr>
    <tr>
      <td>Nama Pemilik/Owner Name</td>
      <td>${escapeHtml(ownerName || "-")}</td>
    </tr>
    <tr>
      <td>No. Perhubungan/Contact No.</td>
      <td>${escapeHtml(company?.contactNo || "-")}</td>
    </tr>
    <tr>
      <td>Alamat Perniagaan/Business Address</td>
      <td>${escapeHtml(company?.address || "-")}</td>
    </tr>
    <tr>
      <td>Lokasi/Location</td>
      <td>${escapeHtml(company?.location || "-")}</td>
    </tr>
  </table>

  <!-- Account Statement header + date range -->
  <div class="account-header">
    <span>Penyata Akaun/Account Statement</span>
    <span>Created at: ${escapeHtml(createdAt)}</span>
  </div>
  <div class="date-range">From ${escapeHtml(fromDate)} to ${escapeHtml(toDate)}</div>

  <!-- Transaction List -->
  <table class="transaction-table">
    <thead>
      <tr>
        <th>Year</th>
        <th>Month</th>
        <th>Type</th>
        <th>Name</th>
        <th class="center">No. of Pax</th>
        <th class="right">Total Price (RM)</th>
      </tr>
    </thead>
    <tbody>
      ${transactionRows}${emptyRow}
    </tbody>
  </table>

  <!-- Summary -->
  <div class="section-header" style="margin-top:48px;page-break-before:auto">Ringkasan Akaun/Summary of Account</div>
  <table class="transaction-table">
    <thead>
      <tr>
        <th class="center" style="width:48px">No.</th>
        <th>Name</th>
        <th class="center">Type</th>
        <th class="center">Total No. of Tourist</th>
        <th class="right">Total Revenue (RM)</th>
      </tr>
    </thead>
    <tbody>
      ${summaryRows}
      <tr class="summary-total">
        <td colspan="3">Overall Total</td>
        <td class="center">${escapeHtml(String(overallTotal?.totalPax ?? 0))}</td>
        <td class="right">RM ${escapeHtml(String(overallTotal?.totalRevenue ?? "0.00"))}</td>
      </tr>
    </tbody>
  </table>

</body>
</html>`;
}

async function generateTransactionStatementPdf(data) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(buildHtml(data), { waitUntil: "domcontentloaded" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "25mm", right: "25mm", bottom: "25mm", left: "25mm" },
    });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

module.exports = { generateTransactionStatementPdf };
