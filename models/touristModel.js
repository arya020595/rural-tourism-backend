const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // Your Sequelize instance

const TouristUser = sequelize.define(
  "tourist_user",
  {
    tourist_user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contact_no: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    nationality: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    suspended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "tourist_users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = TouristUser;
