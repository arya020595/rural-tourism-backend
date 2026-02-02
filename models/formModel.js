const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const TouristUser = require("./touristModel");

const FormResponse = sequelize.define(
  "form_responses",
  {
    receipt_id: { type: DataTypes.STRING, primaryKey: true },
    operator_user_id: { type: DataTypes.STRING, allowNull: false },
    citizenship: { type: DataTypes.STRING, allowNull: false },
    pax: { type: DataTypes.INTEGER, allowNull: false },
    activity_name: { type: DataTypes.STRING, allowNull: true },
    tourist_user_id: { type: DataTypes.STRING(36), allowNull: false },
    homest_name: { type: DataTypes.STRING, allowNull: true },
    location: { type: DataTypes.STRING, allowNull: true },
    activity_id: { type: DataTypes.STRING, allowNull: true },
    homest_id: { type: DataTypes.INTEGER, allowNull: true },
    total_rm: { type: DataTypes.STRING, allowNull: true },
    total_night: { type: DataTypes.STRING, allowNull: true },
    package: { type: DataTypes.TEXT("long"), allowNull: true },
    issuer: { type: DataTypes.STRING, allowNull: true },
    date: { type: DataTypes.DATE, allowNull: true },
    activity_booking_id: { type: DataTypes.BIGINT, allowNull: true },
    accommodation_booking_id: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    tableName: "form_responses",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

// 🔹 Define association BEFORE exporting
FormResponse.belongsTo(TouristUser, {
  foreignKey: "tourist_user_id",
  as: "tourist",
});

module.exports = FormResponse;
