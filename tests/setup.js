/**
 * Jest Global Setup
 * Ensures database tables are created before tests run
 */

const sequelize = require("../config/db");

// Import all models so sequelize.sync() creates their tables
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
    // Authenticate and sync database tables
    await sequelize.authenticate();
    await sequelize.sync({ force: false });
    console.log("Test database setup complete");
  } catch (error) {
    console.error("Error setting up test database:", error);
    throw error;
  }
};
