const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AccomodationAvailability = sequelize.define(
  "accomodation_availabilities",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      get() {
        const rawValue = this.getDataValue("price");
        return rawValue === null ? null : parseFloat(rawValue);
      }
    },

    quota: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },

    accomodation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "accomodation_availabilities",
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

module.exports = AccomodationAvailability;