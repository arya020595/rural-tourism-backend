/**
 * Jest Global Setup
 * Ensures database tables are created before tests run
 *
 * This setup file:
 * 1. Authenticates with the test database
 * 2. Temporarily disables foreign key checks
 * 3. Recreates all tables (force: true)
 * 4. Re-enables foreign key checks
 * 5. Loads all model associations
 */

const sequelize = require("../config/db");
const mysql = require("mysql2/promise");

// Import all models in dependency order to ensure proper table creation
require("../models/userModel");
require("../models/touristModel");
require("../models/activityMasterDataModel");
require("../models/operatorActivitiesModel");
require("../models/bookingActivityModel");
require("../models/bookingAccommodationModel");
require("../models/accomModel");
require("../models/formModel");
require("../models/notificationModel");
require("../models/conversationModel");
require("../models/associations");

module.exports = async () => {
  try {
    console.log("🔧 Setting up test database...");

    if (process.env.NODE_ENV === "test") {
      const testDatabaseName =
        process.env.DB_TEST_NAME || `${process.env.DB_NAME}_test`;

      const bootstrapConnection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      });

      await bootstrapConnection.query(
        `CREATE DATABASE IF NOT EXISTS \`${testDatabaseName}\``,
      );
      await bootstrapConnection.end();

      console.log(`✓ Test database ready (${testDatabaseName})`);
    }

    // Authenticate database connection
    await sequelize.authenticate();
    console.log("✓ Database connection established");

    // Disable foreign key checks to allow safe table recreation
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
    console.log("✓ Foreign key checks disabled");

    // Recreate all tables from models
    await sequelize.sync({ force: true });
    console.log("✓ Database tables synchronized");

    // Re-enable foreign key checks
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("✓ Foreign key checks re-enabled");

    console.log("✅ Test database setup complete\n");
  } catch (error) {
    console.error("❌ Error setting up test database:");
    console.error(`   ${error.name}: ${error.message}`);

    if (error.original) {
      console.error(
        `   SQL Error: ${error.original.sqlMessage || error.original.message}`,
      );
    }

    throw error;
  }
};
