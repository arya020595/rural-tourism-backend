"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const constraintNames = [
        "bookings_ibfk_3",
        "bookings_company_id_foreign_idx",
      ];

      for (const name of constraintNames) {
        try {
          await queryInterface.removeConstraint("bookings", name, {
            transaction,
          });
        } catch (error) {
          // Ignore if constraint does not exist.
        }
      }

      await queryInterface.addConstraint("bookings", {
        fields: ["company_id"],
        type: "foreign key",
        name: "bookings_company_id_foreign_idx",
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
        "bookings",
        "bookings_company_id_foreign_idx",
        { transaction },
      );

      await queryInterface.addConstraint("bookings", {
        fields: ["company_id"],
        type: "foreign key",
        name: "bookings_company_id_foreign_idx",
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
};
