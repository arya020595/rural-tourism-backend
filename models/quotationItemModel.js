const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// One line of a quotation. Same shape as booking_package_companies (company =
// referee, amount = per_price) so converting to a booking is a straight copy.
const QuotationItem = sequelize.define(
  "quotation_item",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    quotationId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "quotation_id",
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
    productType: {
      type: DataTypes.ENUM("activity", "accommodation"),
      allowNull: false,
      field: "product_type",
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "company_id",
    },
    companyName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "company_name",
    },
    productId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "product_id",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
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
    tableName: "quotation_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = QuotationItem;
