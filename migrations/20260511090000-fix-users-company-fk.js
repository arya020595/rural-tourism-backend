"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      try {
        await queryInterface.removeConstraint(
          "users",
          "users_company_id_foreign_idx",
          { transaction },
        );
      } catch (error) {
        // Ignore if constraint does not exist.
      }

      await queryInterface.addConstraint("users", {
        fields: ["company_id"],
        type: "foreign key",
        name: "users_company_id_foreign_idx",
        references: {
          table: "companies",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeConstraint(
        "users",
        "users_company_id_foreign_idx",
        { transaction },
      );

      await queryInterface.addConstraint("users", {
        fields: ["company_id"],
        type: "foreign key",
        name: "users_company_id_foreign_idx",
        references: {
          table: "company",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
