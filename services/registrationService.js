const { Op, QueryTypes } = require("sequelize");
const sequelize = require("../config/db");
const Company = require("../models/companyModel");
const UnifiedUser = require("../models/unifiedUserModel");
const Association = require("../models/associationModel");
const Role = require("../models/roleModel");
const Notification = require("../models/notificationModel");
const { emailService } = require("./emailService");
const { normalizeString, normalizeInt } = require("../utils/normalizers");
const { REGISTRATION_STATUSES } = require("../utils/registrationHelpers");
const {
  BadRequestError,
  ConflictError,
  NotFoundError,
} = require("./errors/AppError");

const LIST_STATUSES = ["all", ...REGISTRATION_STATUSES];
const MAX_REASON_LENGTH = 1000;
const NOTIFICATION_TYPE = "registration_pending";

/**
 * Registration approval (docs/REGISTRATION_APPROVAL.md). A company's
 * association is its users' association_id; association users act on their
 * own association's registrations, superadmins on all (incl. none).
 */
class RegistrationService {
  isAdmin(user) {
    return user?.role === "superadmin" || (Array.isArray(user?.permissions) && user.permissions.includes("*:*"));
  }

  /** `where` limiting companies to the approver's association. */
  scopeWhere(user) {
    if (this.isAdmin(user)) return {};
    const associationId = normalizeInt(user?.association_id, null);
    if (!associationId) return { id: null };
    return {
      id: {
        [Op.in]: sequelize.literal(
          `(SELECT company_id FROM users WHERE company_id IS NOT NULL AND association_id = ${associationId})`,
        ),
      },
    };
  }

  /* ── List ─────────────────────────────────────────────────────────── */

  async list(query = {}, user) {
    const page = Math.max(normalizeInt(query.page, 1) || 1, 1);
    const perPage = Math.min(Math.max(normalizeInt(query.per_page, 10) || 10, 1), 100);
    const status = normalizeString(query.status).toLowerCase() || "pending";
    if (!LIST_STATUSES.includes(status)) {
      throw new BadRequestError(`status must be one of: ${LIST_STATUSES.join(", ")}`);
    }

    const baseWhere = { ...this.scopeWhere(user) };
    const search = normalizeString(query.search);
    if (search) {
      baseWhere[Op.and] = [
        {
          [Op.or]: [
            { company_name: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            {
              id: {
                [Op.in]: sequelize.literal(
                  `(SELECT company_id FROM users WHERE company_id IS NOT NULL AND (name LIKE ${sequelize.escape(`%${search}%`)} OR username LIKE ${sequelize.escape(`%${search}%`)} OR email LIKE ${sequelize.escape(`%${search}%`)}))`,
                ),
              },
            },
          ],
        },
      ];
    }

    const where = status === "all" ? baseWhere : { ...baseWhere, registration_status: status };
    const { count, rows } = await Company.findAndCountAll({
      where,
      order: status === "pending"
        ? [["registration_submitted_at", "ASC"], ["id", "ASC"]] // oldest waiting first
        : [["registration_reviewed_at", "DESC"], ["registration_submitted_at", "DESC"], ["id", "DESC"]],
      limit: perPage,
      offset: (page - 1) * perPage,
    });

    return {
      rows: await this.withOwners(rows),
      counts: await this.countByStatus(baseWhere),
      pagination: { total: count, page, perPage, pages: Math.ceil(count / perPage) },
    };
  }

  async countByStatus(baseWhere) {
    const rows = await Company.findAll({
      attributes: ["registration_status", [sequelize.fn("COUNT", sequelize.col("id")), "total"]],
      where: baseWhere,
      group: ["registration_status"],
      raw: true,
    });
    const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };
    rows.forEach((row) => {
      counts[row.registration_status] = Number(row.total || 0);
      counts.all += Number(row.total || 0);
    });
    return counts;
  }

  /** Pending count for the association dashboard card / menu badge. */
  async pendingCount(user) {
    return Company.count({ where: { ...this.scopeWhere(user), registration_status: "pending" } });
  }

  /**
   * Attaches each company's owner (its operator_admin, else its first user),
   * association and reviewer — a few batched queries, not one per row.
   */
  async withOwners(companies) {
    if (!companies.length) return [];
    const ids = companies.map((company) => company.id);
    const users = await UnifiedUser.findAll({
      where: { company_id: ids },
      attributes: ["id", "name", "username", "email", "company_id", "association_id", "role_id", "is_active"],
      include: [{ model: Role, as: "role", attributes: ["name"], required: false }],
      order: [["id", "ASC"]],
    });
    const ownerByCompany = new Map();
    users.forEach((u) => {
      const current = ownerByCompany.get(u.company_id);
      const isAdminRole = u.role?.name === "operator_admin";
      if (!current || (isAdminRole && current.role?.name !== "operator_admin")) {
        ownerByCompany.set(u.company_id, u);
      }
    });

    const associationIds = [...new Set(users.map((u) => u.association_id).filter(Boolean))];
    const associations = associationIds.length
      ? await Association.findAll({ where: { id: associationIds }, attributes: ["id", "name"] })
      : [];
    const associationById = new Map(associations.map((a) => [a.id, a]));

    const reviewerIds = [...new Set(companies.map((c) => c.registration_reviewed_by).filter(Boolean))];
    const reviewers = reviewerIds.length
      ? await UnifiedUser.findAll({ where: { id: reviewerIds }, attributes: ["id", "name", "username"] })
      : [];
    const reviewerById = new Map(reviewers.map((r) => [r.id, r]));

    return companies.map((company) => {
      const owner = ownerByCompany.get(company.id) || null;
      return {
        company,
        owner,
        association: owner?.association_id ? associationById.get(owner.association_id) || null : null,
        reviewer: company.registration_reviewed_by ? reviewerById.get(company.registration_reviewed_by) || null : null,
      };
    });
  }

  /* ── Detail ───────────────────────────────────────────────────────── */

  async getRegistration(companyId) {
    const id = normalizeInt(companyId, null);
    if (id === null) throw new BadRequestError("Invalid company id");
    const company = await Company.findByPk(id);
    if (!company) throw new NotFoundError("Registration not found.");
    const [entry] = await this.withOwners([company]);
    return entry;
  }

  /* ── Decisions ────────────────────────────────────────────────────── */

  /** Pending → approved, or inactive → active again (same status). */
  async approve(companyId, user) {
    const entry = await this.decide(companyId, user, "approved", null);
    // In the background: SMTP takes seconds and the email is best effort.
    void this.sendDecisionEmail(entry, "approved");
    return entry;
  }

  /**
   * Pending → rejected, or active → deactivated (same status, reason
   * required either way).
   */
  async reject(companyId, reason, user) {
    const text = normalizeString(reason);
    if (!text) throw new BadRequestError("Sila nyatakan sebab / Please give a reason.");
    if (text.length > MAX_REASON_LENGTH) {
      throw new BadRequestError(`The reason can be at most ${MAX_REASON_LENGTH} characters.`);
    }
    const entry = await this.decide(companyId, user, "rejected", text);
    void this.sendDecisionEmail(entry, entry.previousStatus === "approved" ? "deactivated" : "rejected");
    return entry;
  }

  async decide(companyId, user, newStatus, reason) {
    const id = normalizeInt(companyId, null);
    if (id === null) throw new BadRequestError("Invalid company id");
    const transaction = await sequelize.transaction();
    let previousStatus;
    try {
      const company = await Company.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!company) throw new NotFoundError("Registration not found.");
      previousStatus = company.registration_status;
      if (previousStatus === newStatus) {
        throw new ConflictError(
          newStatus === "approved"
            ? "Syarikat ini sudah aktif / This company is already active."
            : "Syarikat ini sudah tidak aktif / This company is already inactive.",
        );
      }
      await company.update(
        {
          registration_status: newStatus,
          registration_reviewed_by: normalizeInt(user?.unified_user_id ?? user?.id, null),
          registration_reviewed_at: new Date(),
          registration_rejection_reason: newStatus === "rejected" ? reason : null,
        },
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    // The pending bell notifications for this company are done with.
    await Notification.update(
      { is_read: 1 },
      { where: { type: NOTIFICATION_TYPE, related_id: id, is_read: 0 } },
    ).catch(() => undefined);
    const entry = await this.getRegistration(id);
    return Object.assign(entry, { previousStatus });
  }

  /* ── Notifications & emails ───────────────────────────────────────── */

  /**
   * Bell notification for every active user of the company's association and
   * every superadmin. Called after a new operator registration is saved.
   */
  async notifyApprovers(company, owner) {
    const roles = await Role.findAll({ where: { name: ["association", "superadmin"] }, attributes: ["id", "name"] });
    const roleId = (name) => roles.find((r) => r.name === name)?.id;
    const conditions = [];
    if (roleId("superadmin")) conditions.push({ role_id: roleId("superadmin") });
    if (roleId("association") && owner?.association_id) {
      conditions.push({ role_id: roleId("association"), association_id: owner.association_id });
    }
    if (!conditions.length) return 0;

    const approvers = await UnifiedUser.findAll({
      where: { [Op.or]: conditions, is_active: { [Op.ne]: false } },
      attributes: ["id"],
    });
    if (!approvers.length) return 0;

    const who = [owner?.name, owner?.username].filter(Boolean).join(" — ");
    await Notification.bulkCreate(
      approvers.map((approver) => ({
        user_id: approver.id,
        user_type: "operator",
        title: "Pendaftaran baharu menunggu kelulusan / New registration awaiting approval",
        // The bell shows the message only, so it must explain itself.
        message: `Pendaftaran baharu / New registration: ${company.company_name}${who ? ` (${who})` : ""}`.slice(0, 250),
        type: NOTIFICATION_TYPE,
        related_id: company.id,
        is_read: 0,
      })),
    );
    return approvers.length;
  }

  /**
   * Email the operator the decision. Best effort — never fails the decision,
   * and callers don't wait for it.
   */
  async sendDecisionEmail(entry, decision) {
    const to = entry?.owner?.email || entry?.company?.email;
    if (!to) return false;
    try {
      const name = entry.owner?.name || entry.owner?.username || entry.company.company_name;
      const loginUrl = `${String(process.env.CORS_ORIGIN || "http://localhost:8100").split(",")[0].trim()}/login`;
      if (decision === "approved") {
        await emailService.sendRegistrationApprovedEmail(to, name, entry.company.company_name, loginUrl);
      } else if (decision === "deactivated") {
        await emailService.sendCompanyDeactivatedEmail(
          to,
          name,
          entry.company.company_name,
          entry.company.registration_rejection_reason,
          entry.association?.name || null,
        );
      } else {
        await emailService.sendRegistrationRejectedEmail(
          to,
          name,
          entry.company.company_name,
          entry.company.registration_rejection_reason,
          entry.association?.name || null,
        );
      }
      return true;
    } catch (error) {
      console.error(`[registration] ${decision} email to ${to} failed:`, error?.message);
      return false;
    }
  }
}

module.exports = new RegistrationService();
