"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("bookings", "idempotency_key", {
      type: Sequelize.STRING(36),
      allowNull: true,
      defaultValue: null,
      after: "id",
    });

    await queryInterface.addColumn("bookings", "version", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: "idempotency_key",
    });

    await queryInterface.addIndex("bookings", ["idempotency_key"], {
      unique: true,
      name: "bookings_idempotency_key_unique",
      where: {
        idempotency_key: { [Sequelize.Op.ne]: null },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "bookings",
      "bookings_idempotency_key_unique",
    );
    await queryInterface.removeColumn("bookings", "version");
    await queryInterface.removeColumn("bookings", "idempotency_key");
  },
};
