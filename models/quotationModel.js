const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// Sebut Harga / Quotation (see migration 20261029100000). The number shown
// is "QT_" + id — not stored. "Expired" is computed from validUntil.
const Quotation = sequelize.define(
  "quotation",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "company_id",
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by",
    },
    preparedByName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "prepared_by_name",
    },
    customerName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "customer_name",
    },
    phoneNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "phone_number",
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    citizenship: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "domestic",
    },
    noOfPaxDomestik: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "no_of_pax_domestik",
    },
    noOfPaxAntarbangsa: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "no_of_pax_antarbangsa",
    },
    quotationDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "quotation_date",
    },
    validUntil: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "valid_until",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("sent", "accepted", "cancelled"),
      allowNull: false,
      defaultValue: "sent",
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      field: "total_amount",
    },
    bookingId: {
      type: DataTypes.BIGINT,
      allowNull: true,
      unique: "uq_quotations_booking_id",
      field: "booking_id",
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "sent_at",
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "accepted_at",
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "cancelled_at",
    },
  },
  {
    tableName: "quotations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = Quotation;
