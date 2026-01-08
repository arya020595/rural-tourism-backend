const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // Your Sequelize instance

const Accom = sequelize.define(
  "accommodation",
  {
    accommodation_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    rt_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "rt_user_id",
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
    },
    image: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    district: {
      type: DataTypes.STRING(100),
    },
    provided: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    show_availability: {
      type: DataTypes.TINYINT,
      allowNull: true,
      field: "show_availability",
      get() {
        const rawValue = this.getDataValue("show_availability");
        return rawValue === 1;
      },
      set(value) {
        this.setDataValue("show_availability", value ? 1 : 0);
      },
    },
    available_dates: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "available_dates",
      get() {
        const rawValue = this.getDataValue("available_dates");
        // Return null if explicitly set to null
        if (rawValue === null || rawValue === undefined) {
          return null;
        }
        // Parse string values
        if (typeof rawValue === "string") {
          try {
            return JSON.parse(rawValue);
          } catch {
            return [];
          }
        }
        // Return the value as-is (likely already an array)
        return rawValue;
      },
    },
    // Virtual aliases for backward compatibility (read-only)
    id: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue("accommodation_id");
      },
    },
    user_id: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.getDataValue("rt_user_id");
      },
      // Note: To set user_id, use rt_user_id directly. VIRTUAL fields are read-only aliases.
    },
  },
  {
    tableName: "accommodation_list",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Accom;
