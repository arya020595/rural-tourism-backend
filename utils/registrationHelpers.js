/**
 * Registration approval — shared rules used by login, the per-request session
 * check and the approval API (docs/REGISTRATION_APPROVAL.md).
 *
 * Statuses as the association sees them: pending = Menunggu/Pending,
 * approved = Aktif/Active, rejected = Tidak Aktif/Inactive (a rejected
 * registration or a member the association deactivated).
 */

const REGISTRATION_STATUSES = ["pending", "approved", "rejected"];

const REGISTRATION_CODES = {
  pending: "REGISTRATION_PENDING",
  rejected: "REGISTRATION_REJECTED",
};

/**
 * Why a company's users may not use the system yet, or null when they may.
 * A company with no status (older rows) counts as approved.
 */
function registrationBlock(company) {
  const status = company?.registration_status || "approved";
  if (status === "pending") {
    return {
      code: REGISTRATION_CODES.pending,
      message:
        "Pendaftaran anda sedang menunggu kelulusan persatuan. / Your registration is awaiting approval from your association.",
      reason: null,
    };
  }
  if (status === "rejected") {
    const reason = company.registration_rejection_reason || null;
    return {
      code: REGISTRATION_CODES.rejected,
      message:
        `Akaun syarikat anda tidak aktif${reason ? ` (Sebab: ${reason})` : ""}. Sila hubungi persatuan anda. / ` +
        `Your company account is inactive${reason ? ` (Reason: ${reason})` : ""}. Please contact your association.`,
      reason,
    };
  }
  return null;
}

/** Whole days between two dates (for "waiting n days"). */
function daysSince(date, now = new Date()) {
  if (!date) return null;
  const from = new Date(date);
  if (Number.isNaN(from.getTime())) return null;
  return Math.max(0, Math.floor((now - from) / 86400000));
}

module.exports = {
  REGISTRATION_STATUSES,
  REGISTRATION_CODES,
  registrationBlock,
  daysSince,
};
