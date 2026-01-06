const { DataTypes } = require("sequelize");
const { v4: uuidv4 } = require("uuid");
const sequelize = require("../config/db"); // Your Sequelize instance

const TouristUser = sequelize.define(
  "tourist_user",
  {
    tourist_user_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4(), // Auto-generate UUID if not provided
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
  },
  {
    tableName: "tourist_users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = TouristUser;
