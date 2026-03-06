const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const OperatorActivities = require("./operatorActivitiesModel");
const User = require("./userModel");

/**
 * ActivityBooking Model
 * Represents bookings for activities made by tourists
 *
 * @typedef {Object} ActivityBooking
 * @property {number} id - Auto-incrementing primary key
 * @property {number} tourist_user_id - Reference to tourist_users
 * @property {number} activity_id - Reference to activity_master_table
 * @property {number} operator_activity_id - Reference to operator_activities
 * @property {number} total_price - Total booking price
 * @property {number|null} no_of_pax - Number of people
 * @property {Date|null} date - Booking date
 * @property {string|null} time - Booking time
 * @property {string|null} contact_name - Contact person name
 * @property {string|null} contact_phone - Contact phone number
 * @property {string|null} nationality - Tourist nationality
 * @property {string|null} status - Booking status (pending, confirmed, cancelled, etc.)
 * @property {string} booking_type - Type of booking (guest or manual)
 * @property {Date} created_at - Creation timestamp
 * @property {Date} updated_at - Last update timestamp
 */
const ActivityBooking = sequelize.define(
  "activity_booking",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    tourist_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: "Tourist user ID is required" },
        isInt: { msg: "Tourist user ID must be an integer" },
      },
    },
    activity_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        notNull: { msg: "Activity ID is required" },
        isInt: { msg: "Activity ID must be an integer" },
      },
    },
    operator_activity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: "Operator activity ID is required" },
        isInt: { msg: "Operator activity ID must be an integer" },
      },
    },
    total_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        notNull: { msg: "Total price is required" },
        min: { args: [0], msg: "Total price must be non-negative" },
      },
    },
    no_of_pax: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: { args: [1], msg: "Number of people must be at least 1" },
      },
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: { msg: "Invalid date format" },
      },
    },
    time: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Booking time in HH:MM format or custom format",
    },
    contact_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    contact_phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
      validate: {
        is: {
          args: /^[0-9+\-() ]*$/i,
          msg: "Invalid phone number format",
        },
      },
    },
    nationality: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "pending",
      validate: {
        isIn: {
          args: [
            [
              "pending",
              "booked",
              "confirmed",
              "paid",
              "cancelled",
              "completed",
              "rejected",
            ],
          ],
          msg: "Invalid status value",
        },
      },
    },
    booking_type: {
      type: DataTypes.ENUM("guest", "manual"),
      allowNull: false,
      defaultValue: "guest",
      comment: "guest: user-initiated, manual: operator-created",
    },
  },
  {
    tableName: "activity_booking",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: ["tourist_user_id"],
      },
      {
        fields: ["activity_id"],
      },
      {
        fields: ["operator_activity_id"],
      },
      {
        fields: ["status"],
      },
      {
        fields: ["date"],
      },
    ],
  },
);

// Define associations
ActivityBooking.belongsTo(OperatorActivities, {
  foreignKey: "operator_activity_id",
  as: "operatorActivity",
});

ActivityBooking.belongsTo(User, {
  foreignKey: "tourist_user_id",
  as: "tourist",
});

module.exports = ActivityBooking;
