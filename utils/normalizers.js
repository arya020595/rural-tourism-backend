function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeInt(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeNullableDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parses a "wall-clock" date/time — what the operator picked, in Malaysia
 * time — and stores it exactly as typed in the UTC fields, e.g.
 * "2026-01-04T18:54:00" -> 2026-01-04T18:54:00.000Z. Readers take the
 * date/time straight from the string (no timezone conversion).
 *
 * Plain `new Date("2026-01-04T18:54:00")` uses the server process's own
 * timezone, so the same booking was stored 8 hours apart on a Malaysia-time
 * machine and on the UTC production server. Values that already carry a
 * timezone ("Z" or "+08:00") are kept as given.
 */
function normalizeWallClockDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const text = String(value).trim().replace(" ", "T");
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const isDateTime = /^\d{4}-\d{2}-\d{2}T\d{1,2}:\d{2}/.test(text);
  const date = new Date(isDateTime && !hasZone ? `${text}Z` : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
}

function isValidDate(value) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function isValidTime(value) {
  if (!value) return false;
  const text = String(value).trim();
  return (
    /^([01]\d|2[0-3]):([0-5]\d)$/.test(text) ||
    /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(text) ||
    /^([01]?\d|2[0-3]):([0-5]\d)\s*([AP]M)$/i.test(text)
  );
}

module.exports = {
  normalizeString,
  normalizeInt,
  normalizeNumber,
  normalizeNullableDate,
  normalizeWallClockDate,
  normalizeDateOnly,
  isValidDate,
  isValidTime,
};
