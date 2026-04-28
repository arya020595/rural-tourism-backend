const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Booking = sequelize.define(
  "booking",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    bookingType: {
      type: DataTypes.ENUM("activity", "accommodation", "package"),
      allowNull: false,
      field: "booking_type",
    },
    touristFullName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "tourist_full_name",
    },
    citizenship: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    noOfPaxAntarbangsa: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: "no_of_pax_antarbangsa",
      validate: {
        min: 0,
      },
    },
    noOfPaxDomestik: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      field: "no_of_pax_domestik",
      validate: {
        min: 0,
      },
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "product_id",
    },
    productName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "product_name",
    },
    activityDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "activity_date",
    },
    totalPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: "total_price",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
    },
    userFullname: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "user_fullname",
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
    totalOfNight: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "total_of_night",
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "pending",
    },
    receiptCreatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "receipt_created_at",
    },
    operatorName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "operator_name",
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "company_id",
    },
    companyName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "company_name",
    },
  },
  {
    tableName: "bookings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = Booking;
