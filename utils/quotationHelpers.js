/**
 * Small shared rules for Sebut Harga / Quotation: its number, Malaysia
 * "today", and the computed "expired" status (never stored).
 */

/**
 * sent      — saved and shared with the customer (the only open status)
 * accepted  — converted to a booking / receipt
 * cancelled — stopped by the operator
 * (expired is computed: sent and past valid_until)
 */
const QUOTATION_STATUSES = ["sent", "accepted", "cancelled"];
/** Statuses that can still be edited, cancelled or converted. */
const OPEN_STATUSES = ["sent"];
const DEFAULT_VALIDITY_DAYS = 7;

// Malaysia has no daylight saving, so the offset is constant.
const MALAYSIA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Today's date in Malaysia as YYYY-MM-DD, whatever the server's timezone. */
function malaysiaToday(now = Date.now()) {
  return new Date(now + MALAYSIA_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/** The UTC instant a Malaysia calendar day (YYYY-MM-DD) starts. */
function malaysiaDayStart(dateOnly) {
  return new Date(Date.parse(`${dateOnly}T00:00:00Z`) - MALAYSIA_UTC_OFFSET_MS);
}

/** YYYY-MM-DD + n days. */
function addDays(dateOnly, days) {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
function daysBetween(from, to) {
  return Math.round(
    (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000,
  );
}

/** "QT_0007" — derived from the id, like "BA_" + booking id on receipts. */
function quotationNo(id) {
  if (id === null || id === undefined) return null;
  return `QT_${String(id).padStart(4, "0")}`;
}

/** "QT_0007", "qt7", "QT-7" → 7; anything else → null. */
function parseQuotationNo(text) {
  const match = String(text || "").trim().match(/^QT[_\s-]?0*(\d+)$/i);
  return match ? Number(match[1]) : null;
}

function dateOnlyOf(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/**
 * Status as the user sees it: a sent quotation whose
 * valid-until date has passed is "expired".
 */
function effectiveStatus(record, today = malaysiaToday()) {
  const status = record.status;
  const validUntil = dateOnlyOf(record.validUntil ?? record.valid_until);
  if (OPEN_STATUSES.includes(status) && validUntil && validUntil < today) {
    return "expired";
  }
  return status;
}

module.exports = {
  QUOTATION_STATUSES,
  OPEN_STATUSES,
  DEFAULT_VALIDITY_DAYS,
  malaysiaToday,
  malaysiaDayStart,
  addDays,
  daysBetween,
  quotationNo,
  parseQuotationNo,
  dateOnlyOf,
  effectiveStatus,
};
