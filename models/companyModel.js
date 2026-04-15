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
  },
  {
    tableName: "company",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = Company;
