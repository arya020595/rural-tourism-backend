const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Activity = require("./activityMasterDataModel");
const User = require("./userModel");
const ActivityBooking = require("./bookingActivityModel");

const OperatorActivity = sequelize.define(
  "operator_activities",
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    activity_id: { type: DataTypes.BIGINT, allowNull: false },
    rt_user_id: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true }, // Changed to TEXT for longer descriptions
    address: { type: DataTypes.STRING, allowNull: false },
    district: { type: DataTypes.STRING, allowNull: true },
    image: { type: DataTypes.TEXT("long"), allowNull: true },
    services_provided: { type: DataTypes.TEXT, allowNull: true }, // Changed to TEXT for JSON data
    available_dates: { type: DataTypes.JSON, allowNull: true },
    price_per_pax: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  },
  {
    tableName: "operator_activities",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

// OperatorActivity.belongsTo(RtUser, {
//   foreignKey: 'rt_user_id',
//   as: 'rt_user'
// });

module.exports = OperatorActivity;

OperatorActivity.belongsTo(Activity, {
  foreignKey: "activity_id",
  as: "activity",
});

OperatorActivity.belongsTo(User, {
  foreignKey: "rt_user_id",
  as: "operator",
});

OperatorActivity.hasMany(ActivityBooking, {
  foreignKey: "operator_activity_id",
  as: "bookings",
});
