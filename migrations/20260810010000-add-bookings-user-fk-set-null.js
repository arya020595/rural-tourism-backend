"use strict";

/**
 * bookings.user_id was never given a real foreign key constraint (a gap from
 * the original create-table migration — company_id and product_id both got
 * explicit fix-up migrations, user_id didn't). This makes the existing
 * de-facto behaviour (bookings survive account deletion, since user_fullname/
 * operator_name/company_name are already denormalised onto the row) an
 * explicit, permanent guarantee: user_id is nullable, and deleting a user
 * sets it to NULL instead of leaving a dangling reference or ever cascading.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.changeColumn(
        "bookings",
        "user_id",
        {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        { transaction },
      );

      await queryInterface.addConstraint("bookings", {
        fields: ["user_id"],
        type: "foreign key",
        name: "bookings_user_id_fk",
        references: {
          table: "users",
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

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeConstraint(
        "bookings",
        "bookings_user_id_fk",
        { transaction },
      );

      await queryInterface.changeColumn(
        "bookings",
        "user_id",
        {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
