/**
 * Jest Global Teardown
 * Closes all database connections after tests complete
 */

const sequelize = require("../config/db");

module.exports = async () => {
  try {
    // Close all database connections
    await sequelize.close();
    console.log("Database connections closed successfully");
  } catch (error) {
    console.error("Error closing database connections:", error);
  }
};
