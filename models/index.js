const sequelize = require("../config/db");

const User = require("./userModel");
const Association = require("./associationModel");

// ======================
// Define Associations
// ======================

User.belongsTo(Association, {
  foreignKey: "associationId",
  as: "association",
});

Association.hasMany(User, {
  foreignKey: "associationId",
  as: "users",
});

// ======================
// Export Models
// ======================

const db = {};

db.sequelize = sequelize;

db.User = User;
db.Association = Association;

module.exports = db;