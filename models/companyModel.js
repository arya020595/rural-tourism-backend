const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Company = sequelize.define(
  "company",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    postcode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    total_fulltime_staff: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    total_partime_staff: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    contact_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    operator_logo_image: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    motac_license_file: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    trading_operation_license: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    homestay_certificate: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    // Default "Terms & Conditions" for new quotations; NULL = the app's standard
    // text (migration 20261030100000).
    quotation_terms: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // Registration approval (migration 20261030130000). New operator
    // companies start "pending"; existing ones were set "approved".
    registration_status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "approved",
    },
    registration_submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    registration_reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    registration_reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    registration_rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "companies",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = Company;
