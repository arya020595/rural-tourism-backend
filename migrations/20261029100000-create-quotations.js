"use strict";

/**
 * Sebut Harga / Quotation — price offers an operator sends a customer before
 * they book. Converted into a booking (or straight into a paid receipt) via
 * POST /api/bookings with quotation_id; see docs/QUOTATION_MODULE.md.
 *
 * quotations       — one per quotation; the number shown is "QT_" + id (not
 *                    stored, like "BA_" + booking id). Expired is computed
 *                    from valid_until, never stored.
 * quotation_items  — same shape as booking_package_companies so conversion is
 *                    a straight copy.
 *
 * Self-contained (CLAUDE.md): also creates the quotation:* permissions and
 * gives them to operator_admin (all) and operator_staff (read/create/update).
 */

const PERMISSIONS = [
  ["View Quotations", "quotation:read"],
  ["Create Quotation", "quotation:create"],
  ["Edit Quotation", "quotation:update"],
  ["Cancel Quotation", "quotation:delete"],
];

const ROLE_PERMISSIONS = {
  operator_admin: [
    "quotation:read",
    "quotation:create",
    "quotation:update",
    "quotation:delete",
  ],
  operator_staff: ["quotation:read", "quotation:create", "quotation:update"],
};

// The app's startup sequelize.sync() creates missing tables from the models,
// so on a server that started before this migration ran the tables may
// already exist — skip whatever is there.
async function tableExists(queryInterface, table) {
  const tables = await queryInterface.showAllTables();
  return tables
    .map((t) => (typeof t === "string" ? t : t.tableName))
    .includes(table);
}

async function addIndexIfMissing(queryInterface, table, fields, options) {
  const indexes = await queryInterface.showIndex(table);
  if (indexes.some((index) => index.name === options.name)) return;
  await queryInterface.addIndex(table, fields, options);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "quotations"))) {
      await queryInterface.createTable("quotations", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
        company_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        prepared_by_name: { type: Sequelize.STRING(255), allowNull: true },
        customer_name: { type: Sequelize.STRING(255), allowNull: false },
        phone_number: { type: Sequelize.STRING(50), allowNull: false },
        email: { type: Sequelize.STRING(255), allowNull: true },
        citizenship: {
          type: Sequelize.STRING(100),
          allowNull: false,
          defaultValue: "domestic",
        },
        no_of_pax_domestik: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        no_of_pax_antarbangsa: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        quotation_date: { type: Sequelize.DATEONLY, allowNull: false },
        valid_until: { type: Sequelize.DATEONLY, allowNull: false },
        notes: { type: Sequelize.TEXT, allowNull: true },
        status: {
          type: Sequelize.ENUM("sent", "accepted", "cancelled"),
          allowNull: false,
          defaultValue: "sent",
        },
        total_amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
        },
        booking_id: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: "bookings", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        sent_at: { type: Sequelize.DATE, allowNull: true },
        accepted_at: { type: Sequelize.DATE, allowNull: true },
        cancelled_at: { type: Sequelize.DATE, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "quotations",
      ["company_id", "status"],
      {
        name: "idx_quotations_company_status",
      },
    );
    await addIndexIfMissing(
      queryInterface,
      "quotations",
      ["company_id", "quotation_date"],
      {
        name: "idx_quotations_company_date",
      },
    );
    // One booking per quotation; NULLs (not yet converted) never collide.
    await addIndexIfMissing(queryInterface, "quotations", ["booking_id"], {
      name: "uq_quotations_booking_id",
      unique: true,
    });

    if (!(await tableExists(queryInterface, "quotation_items"))) {
      await queryInterface.createTable("quotation_items", {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
        quotation_id: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: "quotations", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        product_type: {
          type: Sequelize.ENUM("activity", "accommodation"),
          allowNull: false,
        },
        company_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        company_name: { type: Sequelize.STRING(255), allowNull: true },
        product_id: { type: Sequelize.INTEGER, allowNull: true },
        description: { type: Sequelize.TEXT, allowNull: false },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
        // Stored "as typed" (Malaysia wall-clock in the UTC fields), like
        // bookings.activity_date.
        activity_date: { type: Sequelize.DATE, allowNull: true },
        check_in_date: { type: Sequelize.DATEONLY, allowNull: true },
        check_out_date: { type: Sequelize.DATEONLY, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    await addIndexIfMissing(
      queryInterface,
      "quotation_items",
      ["quotation_id", "sort_order"],
      {
        name: "idx_quotation_items_quotation",
      },
    );

    for (const [name, code] of PERMISSIONS) {
      await queryInterface.sequelize.query(
        `INSERT INTO permissions (name, code, resource, section, created_at, updated_at)
         VALUES (:name, :code, 'quotation', 'Quotation', NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           resource = 'quotation',
           section = 'Quotation',
           updated_at = NOW()`,
        { replacements: { name, code } },
      );
    }

    for (const [role, codes] of Object.entries(ROLE_PERMISSIONS)) {
      await queryInterface.sequelize.query(
        `INSERT IGNORE INTO roles_permissions (role_id, permission_id)
         SELECT r.id, p.id
         FROM roles r, permissions p
         WHERE r.name = :role
           AND p.code IN (:codes)`,
        { replacements: { role, codes } },
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE rp FROM roles_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE p.code LIKE 'quotation:%'
    `);
    await queryInterface.sequelize.query(
      `DELETE FROM permissions WHERE code LIKE 'quotation:%'`,
    );
    await queryInterface.dropTable("quotation_items");
    await queryInterface.dropTable("quotations");
  },
};
