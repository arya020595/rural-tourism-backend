const sequelize = require("../config/db");
const { ServiceUnavailableError } = require("./errors/AppError");

/**
 * Checks the API's own health plus its critical dependency (the DB).
 * Throws ServiceUnavailableError if the DB is unreachable so the endpoint
 * reports a real failure instead of always returning "healthy".
 */
const checkHealth = async () => {
  const checks = { database: "up" };

  try {
    await sequelize.authenticate();
  } catch (error) {
    checks.database = "down";
    throw new ServiceUnavailableError("Database connection failed", {
      status: "error",
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  }

  return {
    status: "ok",
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
};

module.exports = { checkHealth };
