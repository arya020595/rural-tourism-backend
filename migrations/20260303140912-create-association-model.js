'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {

      await queryInterface.createTable('associations', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        name: Sequelize.STRING,
        image: Sequelize.STRING,

        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal(
            "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
          ),
        },
        deleted_at: {
          allowNull: true,
          type: Sequelize.DATE
        }
      }, { transaction });

      await queryInterface.addColumn(
        'rt_users',
        'association_id',
        {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'associations',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        { transaction }
      );

    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {

      await queryInterface.removeColumn(
        'rt_users',
        'association_id',
        { transaction }
      );

      await queryInterface.dropTable(
        'associations',
        { transaction }
      );

    });
  }
};