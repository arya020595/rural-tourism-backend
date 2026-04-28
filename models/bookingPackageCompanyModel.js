const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const BookingPackageCompany = sequelize.define(
  "booking_package_company",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    bookingPackageId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "booking_package_id",
    },
    referrerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "referrer_id",
    },
    referralCompany: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "referral_company",
    },
    refereeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "referee_id",
    },
    refereeCompany: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "referee_company",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    perPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "per_price",
    },
  },
  {
    tableName: "booking_package_companies",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = BookingPackageCompany;
