"use strict";

/**
 * users.token_version — bumped whenever a user's password changes (self
 * change, forgot-password reset, or admin reset). Login tokens carry the
 * version they were issued with (`tv` claim); the authenticate middleware
 * rejects tokens whose version no longer matches, which logs the user out on
 * every other device after a password change.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "token_version", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "token_version");
  },
};
