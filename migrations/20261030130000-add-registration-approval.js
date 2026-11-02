"use strict";

/**
 * Registration approval: a new operator company starts as "pending" and can
 * only log in once its association (or a superadmin) approves it. See
 * docs/design/REGISTRATION_APPROVAL_PLAN.md and docs/REGISTRATION_APPROVAL.md.
 *
 * companies.registration_status          pending | approved | rejected
 *                                        (default approved — every existing
 *                                        company keeps working unchanged)
 * companies.registration_submitted_at    when the operator registered
 * companies.registration_reviewed_by     user id of the approver
 * companies.registration_reviewed_at     when it was decided
 * companies.registration_rejection_reason
 *
 * Self-contained (CLAUDE.md): also creates the registration:approve
 * permission and gives it to the association role (superadmin has *:*).
 * Columns / index that the app's startup sequelize.sync() already added are
 * skipped.
 */

const PERMISSION = ["Approve Operator Registration", "registration:approve"];

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("companies");
    const add = async (name, definition) => {
      if (!columns[name]) await queryInterface.addColumn("companies", name, definition);
    };

    await add("registration_status", {
      type: Sequelize.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "approved",
    });
    await add("registration_submitted_at", { type: Sequelize.DATE, allowNull: true });
    await add("registration_reviewed_by", { type: Sequelize.INTEGER, allowNull: true });
    await add("registration_reviewed_at", { type: Sequelize.DATE, allowNull: true });
    await add("registration_rejection_reason", { type: Sequelize.TEXT, allowNull: true });

    // "Waiting n days" and sorting for companies that existed before.
    await queryInterface.sequelize.query(
      `UPDATE companies SET registration_submitted_at = created_at
       WHERE registration_submitted_at IS NULL`,
    );

    const indexes = await queryInterface.showIndex("companies");
    if (!indexes.some((index) => index.name === "idx_companies_registration_status")) {
      await queryInterface.addIndex("companies", ["registration_status"], {
        name: "idx_companies_registration_status",
      });
    }

    const [name, code] = PERMISSION;
    await queryInterface.sequelize.query(
      `INSERT INTO permissions (name, code, resource, section, created_at, updated_at)
       VALUES (:name, :code, 'registration', 'Association', NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         resource = 'registration',
         section = 'Association',
         updated_at = NOW()`,
      { replacements: { name, code } },
    );
    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO roles_permissions (role_id, permission_id)
       SELECT r.id, p.id
       FROM roles r, permissions p
       WHERE r.name = 'association' AND p.code = :code`,
      { replacements: { code } },
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE rp FROM roles_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code = 'registration:approve'
    `);
    await queryInterface.sequelize.query(
      `DELETE FROM permissions WHERE code = 'registration:approve'`,
    );

    const indexes = await queryInterface.showIndex("companies");
    if (indexes.some((index) => index.name === "idx_companies_registration_status")) {
      await queryInterface.removeIndex("companies", "idx_companies_registration_status");
    }
    const columns = await queryInterface.describeTable("companies");
    for (const name of [
      "registration_rejection_reason",
      "registration_reviewed_at",
      "registration_reviewed_by",
      "registration_submitted_at",
      "registration_status",
    ]) {
      if (columns[name]) await queryInterface.removeColumn("companies", name);
    }
  },
};
