/**
 * Jest Global Setup
 * Ensures database tables are created before tests run
 */

const sequelize = require("../config/db");

module.exports = async () => {
  try {
    // Authenticate and sync database tables
    await sequelize.authenticate();
    await sequelize.sync({ force: false });
    console.log("Test database setup complete");
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }
};
