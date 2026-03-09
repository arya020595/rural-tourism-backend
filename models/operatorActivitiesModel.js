const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Activity = require("./activityMasterDataModel");
const User = require("./userModel");

/**
 * OperatorActivity Model
 * Represents activities offered by tour operators
 *
 * @typedef {Object} OperatorActivity
 * @property {number} id - Auto-incrementing primary key
 * @property {number} activity_id - Reference to activity_master_table
 * @property {number} rt_user_id - Reference to rt_users (operator)
 * @property {string} description - Detailed description of the activity
 * @property {string|null} address - Physical address
 * @property {string} district - District/region where activity is located
 * @property {string|null} image - Base64 encoded image or URL
 * @property {string|null} operator_logo - Operator's logo
 * @property {Object} services_provided - JSON array of services offered
 * @property {Array|null} available_dates - JSON array of available dates
 * @property {number|null} price_per_pax - Price per person
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */
const OperatorActivity = sequelize.define(
  "operator_activities",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    activity_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        notNull: { msg: "Activity ID is required" },
        isInt: { msg: "Activity ID must be an integer" },
      },
    },
    rt_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: "User ID is required" },
        isInt: { msg: "User ID must be an integer" },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: "Description cannot be empty" },
      },
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: { msg: "District is required" },
      },
    },
    image: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    operator_logo: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    services_provided: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      get() {
        const rawValue = this.getDataValue("services_provided");
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue);
          } catch {
            return [];
          }
        }
        return rawValue || [];
      },
    },
    available_dates: {
      type: DataTypes.JSON,
      allowNull: true,
      get() {
        const rawValue = this.getDataValue("available_dates");
        if (rawValue === null || rawValue === undefined) {
          return null;
        }
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue);
          } catch {
            return [];
          }
        }
        return rawValue;
      },
    },
    price_per_pax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: { args: [0], msg: "Price must be non-negative" },
      },
    },
  },
  {
    tableName: "operator_activities",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["activity_id"],
      },
      {
        fields: ["rt_user_id"],
      },
      {
        fields: ["district"],
      },
    ],
  },
);

// Define associations
OperatorActivity.belongsTo(Activity, {
  foreignKey: "activity_id",
  as: "activity",
});

OperatorActivity.belongsTo(User, {
  foreignKey: "rt_user_id",
  as: "operator",
});

module.exports = OperatorActivity;
