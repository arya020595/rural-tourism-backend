/**
 * Quotation serializer — converts Sequelize model instances into a consistent
 * API response shape.
 *
 * `status` is the effective status (an open quotation past its valid-until
 * date shows as "expired"); `stored_status` is what is saved. The can_* flags
 * tell the app which buttons to show, so it does not repeat the rules.
 */
const { policy } = require("../policies");
const {
  OPEN_STATUSES,
  malaysiaToday,
  daysBetween,
  quotationNo,
  dateOnlyOf,
  effectiveStatus,
} = require("../utils/quotationHelpers");

function money(value) {
  return Number(value || 0).toFixed(2);
}

function serializeItem(item, ownCompanyId) {
  const plain = item.toJSON ? item.toJSON() : item;
  return {
    id: plain.id,
    sort_order: plain.sortOrder,
    product_type: plain.productType,
    company_id: plain.companyId,
    company_name: plain.companyName,
    product_id: plain.productId,
    description: plain.description,
    amount: money(plain.amount),
    activity_date: plain.activityDate ?? null,
    check_in_date: plain.checkInDate ?? null,
    check_out_date: plain.checkOutDate ?? null,
    is_own: Number(plain.companyId) === Number(ownCompanyId),
  };
}

function permissionsFor(record, user, status) {
  if (!user) {
    return { can_edit: false, can_convert: false, can_convert_receipt: false, can_cancel: false };
  }
  const rules = policy("quotation", user, record);
  const open = OPEN_STATUSES.includes(record.status);
  return {
    // An expired quotation stays editable so its valid-until date can be extended.
    can_edit: open && rules.update(),
    can_convert: open && status !== "expired" && rules.convert("booking"),
    can_convert_receipt: open && status !== "expired" && rules.convert("receipt"),
    can_cancel: open && rules.cancel(),
  };
}

function serialize(quotation, user = null, today = malaysiaToday()) {
  const plain = quotation.toJSON ? quotation.toJSON() : quotation;
  const status = effectiveStatus(plain, today);
  const validUntil = dateOnlyOf(plain.validUntil);
  const items = Array.isArray(plain.items)
    ? [...plain.items]
        .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id))
        .map((item) => serializeItem(item, plain.companyId))
    : undefined;

  return {
    id: plain.id,
    quotation_no: quotationNo(plain.id),
    status,
    stored_status: plain.status,
    company_id: plain.companyId,
    company_name: plain.company?.company_name ?? null,
    customer_name: plain.customerName,
    phone_number: plain.phoneNumber,
    email: plain.email,
    citizenship: plain.citizenship,
    no_of_pax_domestik: plain.noOfPaxDomestik,
    no_of_pax_antarbangsa: plain.noOfPaxAntarbangsa,
    total_pax: Number(plain.noOfPaxDomestik || 0) + Number(plain.noOfPaxAntarbangsa || 0),
    quotation_date: dateOnlyOf(plain.quotationDate),
    valid_until: validUntil,
    // For the "n days left" hint; only meaningful while still open.
    days_left:
      OPEN_STATUSES.includes(plain.status) && validUntil
        ? daysBetween(today, validUntil)
        : null,
    notes: plain.notes,
    total_amount: money(plain.totalAmount),
    prepared_by_name: plain.preparedByName,
    booking_id: plain.bookingId,
    booking_status: plain.booking?.status ?? null,
    sent_at: plain.sentAt,
    accepted_at: plain.acceptedAt,
    cancelled_at: plain.cancelledAt,
    ...permissionsFor(plain, user, status),
    ...(items ? { items } : {}),
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };
}

/** List rows: no items or notes. */
function serializeMany(quotations, user = null) {
  const today = malaysiaToday();
  return quotations.map((quotation) => {
    const { notes, items, ...row } = serialize(quotation, user, today);
    return row;
  });
}

module.exports = { serialize, serializeMany, serializeItem };
