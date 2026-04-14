const repl = require("repl");
const bcrypt = require("bcrypt");
const sequelize = require("../config/db");
require("../models/associations");

// Import all models
const Accom = require("../models/accomModel");
const User = require("../models/unifiedUserModel");
const Tourist = require("../models/touristModel");
const BookingActivity = require("../models/bookingActivityModel");
const BookingAccommodation = require("../models/bookingAccommodationModel");
const OperatorActivity = require("../models/operatorActivitiesModel");
const ActivityMasterData = require("../models/activityMasterDataModel");
const Notification = require("../models/notificationModel");
const Form = require("../models/formModel");

async function startConsole() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected!\n");
    console.log("📦 Available models:");
    console.log("   Accom, User, Tourist, BookingActivity,");
    console.log(
      "   BookingAccommodation, OperatorActivity, ActivityMasterData,"
    );
    console.log("   Notification, Form, sequelize\n");
    console.log("💡 Examples:");
    console.log("   await ActivityMasterData.findAll()");
    console.log("   await ActivityMasterData.findOne({ where: { id: 1 } })");
    console.log("   await Accom.update({ price: 100 }, { where: { id: 1 } })");
    console.log("   await User.count()");
    console.log("\n");

    const replServer = repl.start({
      prompt: "RT-Backend > ",
      useColors: true,
      // Enable await support
      replMode: repl.REPL_MODE_STRICT,
    });

    // Attach models to REPL context
    replServer.context.sequelize = sequelize;
    replServer.context.bcrypt = bcrypt;
    replServer.context.Accom = Accom;
    replServer.context.User = User;
    replServer.context.Tourist = Tourist;
    replServer.context.BookingActivity = BookingActivity;
    replServer.context.BookingAccommodation = BookingAccommodation;
    replServer.context.OperatorActivity = OperatorActivity;
    replServer.context.ActivityMasterData = ActivityMasterData;
    replServer.context.Notification = Notification;
    replServer.context.Form = Form;

    // Helper function to reload models
    replServer.context.reload = () => {
      console.log("Reloading models...");
      Object.keys(require.cache).forEach((key) => {
        if (key.includes("/models/")) {
          delete require.cache[key];
        }
      });
      console.log("Done! Restart console to see changes.");
    };

    // Close database on exit
    replServer.on("exit", async () => {
      console.log("\n👋 Closing database connection...");
      await sequelize.close();
      process.exit();
    });
  } catch (error) {
    console.error("❌ Unable to connect to database:", error.message);
    process.exit(1);
  }
}

startConsole();
