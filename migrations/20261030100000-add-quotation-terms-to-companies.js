"use strict";

/**
 * companies.quotation_terms — a company's own default "Nota & Terma / Notes &
 * Terms" for new quotations (saved from the quotation form). NULL = use the
 * standard text built into the app. Each quotation keeps its own copy in
 * quotations.notes, so changing the default never alters sent quotations.
 *
 * Skips the column if the app's startup sequelize.sync() already added it.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("companies");
    if (!columns.quotation_terms) {
      await queryInterface.addColumn("companies", "quotation_terms", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("companies");
    if (columns.quotation_terms) {
      await queryInterface.removeColumn("companies", "quotation_terms");
    }
  },
};
