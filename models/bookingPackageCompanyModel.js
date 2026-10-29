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
    associationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "association_id",
    },
    // Item type and dates (see migration 20261028120000). Nullable: older
    // items have none and the calendar falls back to the package's date.
    productType: {
      type: DataTypes.ENUM("activity", "accommodation"),
      allowNull: true,
      field: "product_type",
    },
    // Stored "as typed" (Malaysia wall-clock in the UTC fields), like
    // bookings.activity_date.
    activityDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "activity_date",
    },
    checkInDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "check_in_date",
    },
    checkOutDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "check_out_date",
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
