const sequelize = require("../config/db");

const User = require("./userModel");
const Association = require("./associationModel");
const AccomodationAvailability = require("./accomodationAvailability");
const Accom = require("./accomModel");

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

AccomodationAvailability.belongsTo(Accom, {
  foreignKey: "accomodation_id",
  targetKey: "accommodation_id",
  as: 'accomodation',
});

Accom.hasMany(AccomodationAvailability, {
  foreignKey: "accomodation_id",
  sourceKey: "accommodation_id",
  as: 'availabilities',
});

// ======================
// Export Models
// ======================

const db = {};

db.sequelize = sequelize;

db.User = User;
db.Association = Association;
db.AccomodationAvailability = AccomodationAvailability;
db.Accom = Accom;

module.exports = db;