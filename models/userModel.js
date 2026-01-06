const { DataTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const sequelize = require("../config/db");
// const OperatorActivity = require('./operatorActivitiesModel'); // import but don’t use yet

const User = sequelize.define(
  "rt_users", // Model name matches tableName for consistency
  {
    user_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    username: { type: DataTypes.STRING, allowNull: false },
    user_email: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Not Provided",
    },
    // Using securityQ1/securityQ2 as model attribute names for backward compatibility
    // with existing controller code, mapping to security_Q1/security_Q2 in database
    securityQ1: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "security_Q1", // Maps to database column security_Q1
    },
    securityQ2: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "security_Q2", // Maps to database column security_Q2
    },
    business_name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Not Provided",
    },
    company_logo: { type: DataTypes.TEXT("long"), allowNull: true },
  },
  {
    tableName: "rt_users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Associations should be set after exporting or in a separate file
//User.hasMany(OperatorActivity, { foreignKey: 'rt_user_id', as: 'activities' }); // ✅ Move this

module.exports = User;
