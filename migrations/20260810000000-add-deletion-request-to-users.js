"use strict";

/**
 * Audit columns for self-service account deletion requests. A user requests
 * deletion of their own account; an admin reviews and actions it (approve →
 * delete the account, or reject). Required for Google Play's Data Safety
 * "account deletion" declaration.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "deletion_requested_at", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("users", "deletion_reason", {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("users", "deletion_reviewed_by", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn("users", "deletion_reviewed_at", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "deletion_requested_at");
    await queryInterface.removeColumn("users", "deletion_reason");
    await queryInterface.removeColumn("users", "deletion_reviewed_by");
    await queryInterface.removeColumn("users", "deletion_reviewed_at");
  },
};
