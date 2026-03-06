const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Accom = require("./accomModel");

const AccommodationBooking = sequelize.define(
  "accommodation_booking",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    tourist_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    accommodation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    check_in: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    check_out: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    total_no_of_nights: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    total_price: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },
    no_of_pax: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    contact_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contact_email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contact_phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    booking_type: {
      type: DataTypes.ENUM("guest", "manual"),
      allowNull: false,
      defaultValue: "guest",
    },
  },
  {
    tableName: "accommodation_booking",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = AccommodationBooking;

AccommodationBooking.belongsTo(Accom, {
  foreignKey: "accommodation_id",
  targetKey: "accommodation_id",
  as: "accommodation",
});
