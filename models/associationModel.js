const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Association = sequelize.define(
  "associations",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: DataTypes.STRING,
    image: DataTypes.STRING,
  },
  {
    tableName: "associations",
    timestamps: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",

    defaultScope: {
      attributes: {
        exclude: ["created_at", "updated_at", "deleted_at"],
      },
    },
  }
);

module.exports = Association;