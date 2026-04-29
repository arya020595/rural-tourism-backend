"use strict";

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();

  return tables.some((table) => {
    if (typeof table === "string") {
      return table === tableName;
    }

    if (table && typeof table === "object") {
      return table.tableName === tableName || table.table_name === tableName;
    }

    return false;
  });
}

async function renameTableIfExists(queryInterface, fromTable, toTable) {
  const sourceExists = await tableExists(queryInterface, fromTable);
  const targetExists = await tableExists(queryInterface, toTable);
  if (sourceExists && !targetExists) {
    await queryInterface.renameTable(fromTable, toTable);
  }
}

module.exports = {
  async up(queryInterface) {
    await renameTableIfExists(queryInterface, "company", "companies");
    await renameTableIfExists(
      queryInterface,
      "activity_booking",
      "activity_bookings",
    );
    await renameTableIfExists(
      queryInterface,
      "accommodation_booking",
      "accommodation_bookings",
    );
    await renameTableIfExists(
      queryInterface,
      "activity_master_table",
      "activity_master_data",
    );
    await renameTableIfExists(
      queryInterface,
      "accommodation_list",
      "accommodations",
    );
    await renameTableIfExists(queryInterface, "conversation", "conversations");
  },

  async down(queryInterface) {
    await renameTableIfExists(queryInterface, "companies", "company");
    await renameTableIfExists(
      queryInterface,
      "activity_bookings",
      "activity_booking",
    );
    await renameTableIfExists(
      queryInterface,
      "accommodation_bookings",
      "accommodation_booking",
    );
    await renameTableIfExists(
      queryInterface,
      "activity_master_data",
      "activity_master_table",
    );
    await renameTableIfExists(
      queryInterface,
      "accommodations",
      "accommodation_list",
    );
    await renameTableIfExists(queryInterface, "conversations", "conversation");
  },
};
