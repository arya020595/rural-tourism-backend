const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Permission = sequelize.define(
  "permission",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    resource: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    section: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    tableName: "permissions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

module.exports = Permission;
