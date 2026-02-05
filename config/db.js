require("dotenv").config();
const { Sequelize } = require("sequelize");

// Create a new instance of Sequelize using environment variables
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST, // Use environment variable for host
    port: process.env.DB_PORT || 3306, // Specify the port from environment variable
    dialect: "mysql", // Specify the dialect as MySQL
    logging: process.env.NODE_ENV === "test" ? false : console.log, // Disable logging in test environment
  },
);

// Only auto-connect in non-test environments
if (process.env.NODE_ENV !== "test") {
  sequelize
    .authenticate()
    .then(() => console.log("Database connected successfully"))
    .catch((error) =>
      console.error("Unable to connect to the database:", error),
    );
}

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("Connection to MySQL has been established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

// Sync all models with the database (create tables if they don't exist)
const syncDatabase = async () => {
  try {
    await sequelize.sync({ force: false }); // Use { force: true } to drop tables and recreate them
    console.log("Database tables have been created or are up to date.");
  } catch (error) {
    console.error("Error syncing database:", error);
  }
};

// Call the test connection function only in non-test environment
if (process.env.NODE_ENV !== "test") {
  testConnection();
  // sync tables
  syncDatabase();
}

module.exports = sequelize; // Export the sequelize instance
