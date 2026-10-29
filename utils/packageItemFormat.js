/**
 * Formatting for package items on the deposit and payment receipt PDFs:
 * the item's type label and its "Tarikh / Masa" (date / time) text.
 *
 * activity_date is stored "as typed" (Malaysia wall-clock in the UTC fields)
 * and check-in/out are plain dates, so everything is read from the UTC parts
 * — the server's timezone never shifts a day.
 */

function utcDate(value) {
  if (!value) return null;
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T00:00:00Z` : value,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "29-10-2026" */
function formatDayDmy(value) {
  const date = utcDate(value);
  if (!date) return "-";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getUTCFullYear()}`;
}

/** "03:23 PM", or "" when no time was picked (stored as midnight). */
function formatTime12h(value) {
  const date = utcDate(value);
  if (!date) return "";
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  if (hours === 0 && minutes === 0) return "";
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${String(hours % 12 || 12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function isAccommodationItem(item = {}) {
  const type = String(item.productType || "").toLowerCase();
  return type === "accommodation" || (!type && !!item.checkInDate);
}

/** "Aktiviti/Activity", "Penginapan/Accommodation" or "" (older items). */
function packageItemTypeLabel(item = {}) {
  const type = String(item.productType || "").toLowerCase();
  if (type === "activity") return "Aktiviti/Activity";
  if (type === "accommodation") return "Penginapan/Accommodation";
  return "";
}

/**
 * When the customer comes, as plain text parts:
 *   activity      → { main: "29-10-2026, 03:23 PM", sub: "" }
 *   accommodation → { main: "31-10-2026 – 01-11-2026", sub: "1 malam/night" }
 *   no dates      → { main: "-", sub: "" }
 */
function packageItemWhen(item = {}) {
  if (isAccommodationItem(item)) {
    if (!item.checkInDate) return { main: "-", sub: "" };
    const checkIn = formatDayDmy(item.checkInDate);
    if (!item.checkOutDate) return { main: checkIn, sub: "" };
    const nights = Math.round(
      (utcDate(String(item.checkOutDate).slice(0, 10)) -
        utcDate(String(item.checkInDate).slice(0, 10))) /
        86400000,
    );
    return {
      main: `${checkIn} – ${formatDayDmy(item.checkOutDate)}`,
      sub: `${nights} malam/night${nights === 1 ? "" : "s"}`,
    };
  }
  if (!item.activityDate) return { main: "-", sub: "" };
  const time = formatTime12h(item.activityDate);
  return { main: `${formatDayDmy(item.activityDate)}${time ? `, ${time}` : ""}`, sub: "" };
}

/** Attributes to load for the receipts (BookingPackageCompany). */
const PACKAGE_ITEM_RECEIPT_ATTRIBUTES = [
  "description",
  "perPrice",
  "productType",
  "activityDate",
  "checkInDate",
  "checkOutDate",
];

function toReceiptPackageItem(p) {
  return {
    description: p.description,
    perPrice: Number(p.perPrice || 0),
    productType: p.productType,
    activityDate: p.activityDate,
    checkInDate: p.checkInDate,
    checkOutDate: p.checkOutDate,
  };
}

module.exports = {
  packageItemTypeLabel,
  packageItemWhen,
  PACKAGE_ITEM_RECEIPT_ATTRIBUTES,
  toReceiptPackageItem,
};
