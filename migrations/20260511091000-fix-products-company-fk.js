"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const constraintNames = [
        "products_ibfk_1",
        "products_company_id_foreign_idx",
      ];

      for (const name of constraintNames) {
        try {
          await queryInterface.removeConstraint("products", name, {
            transaction,
          });
        } catch (error) {
          // Ignore if constraint does not exist.
        }
      }

      await queryInterface.addConstraint("products", {
        fields: ["company_id"],
        type: "foreign key",
        name: "products_company_id_foreign_idx",
        references: {
          table: "companies",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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
        "products",
        "products_company_id_foreign_idx",
        { transaction },
      );

      await queryInterface.addConstraint("products", {
        fields: ["company_id"],
        type: "foreign key",
        name: "products_company_id_foreign_idx",
        references: {
          table: "companies",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
