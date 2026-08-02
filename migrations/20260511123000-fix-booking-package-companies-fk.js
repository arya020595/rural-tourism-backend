"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      const constraintNames = [
        "booking_package_companies_ibfk_2",
        "booking_package_companies_ibfk_3",
        "booking_package_companies_referrer_id_fk",
        "booking_package_companies_referee_id_fk",
      ];

      for (const name of constraintNames) {
        try {
          await queryInterface.removeConstraint(
            "booking_package_companies",
            name,
            { transaction },
          );
        } catch (error) {
          // Ignore if constraint does not exist.
        }
      }

      await queryInterface.addConstraint("booking_package_companies", {
        fields: ["referrer_id"],
        type: "foreign key",
        name: "booking_package_companies_referrer_id_fk",
        references: {
          table: "companies",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
        transaction,
      });

      await queryInterface.addConstraint("booking_package_companies", {
        fields: ["referee_id"],
        type: "foreign key",
        name: "booking_package_companies_referee_id_fk",
        references: {
          table: "companies",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
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
      const constraintNames = [
        "booking_package_companies_referrer_id_fk",
        "booking_package_companies_referee_id_fk",
      ];

      for (const name of constraintNames) {
        try {
          await queryInterface.removeConstraint(
            "booking_package_companies",
            name,
            { transaction },
          );
        } catch (error) {
          // Ignore if constraint does not exist.
        }
      }

      await queryInterface.addConstraint("booking_package_companies", {
        fields: ["referrer_id"],
        type: "foreign key",
        name: "booking_package_companies_referrer_id_fk",
        references: {
          table: "company",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
        transaction,
      });

      await queryInterface.addConstraint("booking_package_companies", {
        fields: ["referee_id"],
        type: "foreign key",
        name: "booking_package_companies_referee_id_fk",
        references: {
          table: "company",
          field: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
        transaction,
      });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
