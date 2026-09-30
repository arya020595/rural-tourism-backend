module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("products", "is_active", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: "product_type",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("products", "is_active");
  },
};
