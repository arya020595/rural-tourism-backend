"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    await queryInterface.sequelize.transaction(async (transaction) => {
      if (table.user_email && !table.email_address) {
        await queryInterface.renameColumn(
          tableName,
          "user_email",
          "email_address",
          { transaction },
        );
      }

      if (table.full_name && !table.owner_full_name) {
        await queryInterface.renameColumn(
          tableName,
          "full_name",
          "owner_full_name",
          { transaction },
        );
      }

      if (table.company_logo && !table.operator_logo_image) {
        await queryInterface.renameColumn(
          tableName,
          "company_logo",
          "operator_logo_image",
          { transaction },
        );
      }

      const latestTable = await queryInterface.describeTable(tableName);

      if (!latestTable.business_address) {
        await queryInterface.addColumn(
          tableName,
          "business_address",
          {
            type: Sequelize.TEXT("long"),
            allowNull: true,
          },
          { transaction },
        );
      }

      if (!latestTable.location) {
        await queryInterface.addColumn(
          tableName,
          "location",
          {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          { transaction },
        );
      }

      if (!latestTable.contact_no) {
        await queryInterface.addColumn(
          tableName,
          "contact_no",
          {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          { transaction },
        );
      }

      if (!latestTable.no_of_full_time_staff) {
        await queryInterface.addColumn(
          tableName,
          "no_of_full_time_staff",
          {
            type: Sequelize.INTEGER,
            allowNull: true,
          },
          { transaction },
        );
      }

      if (!latestTable.no_of_part_time_staff) {
        await queryInterface.addColumn(
          tableName,
          "no_of_part_time_staff",
          {
            type: Sequelize.INTEGER,
            allowNull: true,
          },
          { transaction },
        );
      }

      if (!latestTable.motac_license_file) {
        await queryInterface.addColumn(
          tableName,
          "motac_license_file",
          {
            type: Sequelize.TEXT("long"),
            allowNull: true,
          },
          { transaction },
        );
      }

      if (!latestTable.trading_operation_license) {
        await queryInterface.addColumn(
          tableName,
          "trading_operation_license",
          {
            type: Sequelize.TEXT("long"),
            allowNull: true,
          },
          { transaction },
        );
      }

      if (!latestTable.homestay_certificate) {
        await queryInterface.addColumn(
          tableName,
          "homestay_certificate",
          {
            type: Sequelize.TEXT("long"),
            allowNull: true,
          },
          { transaction },
        );
      }

      if (!latestTable.confirmed_password) {
        await queryInterface.addColumn(
          tableName,
          "confirmed_password",
          {
            type: Sequelize.STRING(255),
            allowNull: true,
          },
          { transaction },
        );
      }
    });
  },

  async down(queryInterface) {
    const tableName = "rt_users";
    const table = await queryInterface.describeTable(tableName);

    await queryInterface.sequelize.transaction(async (transaction) => {
      if (table.confirmed_password) {
        await queryInterface.removeColumn(tableName, "confirmed_password", {
          transaction,
        });
      }
      if (table.homestay_certificate) {
        await queryInterface.removeColumn(tableName, "homestay_certificate", {
          transaction,
        });
      }
      if (table.trading_operation_license) {
        await queryInterface.removeColumn(
          tableName,
          "trading_operation_license",
          { transaction },
        );
      }
      if (table.motac_license_file) {
        await queryInterface.removeColumn(tableName, "motac_license_file", {
          transaction,
        });
      }
      if (table.no_of_part_time_staff) {
        await queryInterface.removeColumn(tableName, "no_of_part_time_staff", {
          transaction,
        });
      }
      if (table.no_of_full_time_staff) {
        await queryInterface.removeColumn(tableName, "no_of_full_time_staff", {
          transaction,
        });
      }
      if (table.contact_no) {
        await queryInterface.removeColumn(tableName, "contact_no", {
          transaction,
        });
      }
      if (table.location) {
        await queryInterface.removeColumn(tableName, "location", {
          transaction,
        });
      }
      if (table.business_address) {
        await queryInterface.removeColumn(tableName, "business_address", {
          transaction,
        });
      }

      const latestTable = await queryInterface.describeTable(tableName);

      if (latestTable.operator_logo_image && !latestTable.company_logo) {
        await queryInterface.renameColumn(
          tableName,
          "operator_logo_image",
          "company_logo",
          { transaction },
        );
      }
      if (latestTable.owner_full_name && !latestTable.full_name) {
        await queryInterface.renameColumn(
          tableName,
          "owner_full_name",
          "full_name",
          { transaction },
        );
      }
      if (latestTable.email_address && !latestTable.user_email) {
        await queryInterface.renameColumn(
          tableName,
          "email_address",
          "user_email",
          { transaction },
        );
      }
    });
  },
};
