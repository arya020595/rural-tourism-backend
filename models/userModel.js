const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
// const OperatorActivity = require('./operatorActivitiesModel'); // import but don’t use yet

const User = sequelize.define(
  "rt_users", // Model name matches tableName for consistency
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: { type: DataTypes.STRING, allowNull: false },
    user_email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: "email_address",
    },
    password: { type: DataTypes.STRING, allowNull: false },
    confirmed_password: { type: DataTypes.STRING, allowNull: true },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Not Provided",
      field: "owner_full_name",
    },
    business_name: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Not Provided",
    },
    business_address: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    poscode: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    contact_no: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    no_of_full_time_staff: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    no_of_part_time_staff: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    company_logo: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      field: "operator_logo_image",
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
    associationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "association_id",
    },
  },
  {
    tableName: "rt_users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

// Associations should be set after exporting or in a separate file
//User.hasMany(OperatorActivity, { foreignKey: 'rt_user_id', as: 'activities' }); // ✅ Move this

module.exports = User;
