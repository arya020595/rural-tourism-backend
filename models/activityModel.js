const { DataTypes } = require("sequelize");
const sequelize = require("../config/db"); // Your Sequelize instance

const activity = sequelize.define(
  "activity_new",
  {
    activity_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    activity_name: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.TEXT,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    show_in_suggestion: {
      type: DataTypes.TINYINT,
      allowNull: true,
      field: "show_in_suggestion",
      get() {
        const rawValue = this.getDataValue("show_in_suggestion");
        return rawValue === 1;
      },
      set(value) {
        this.setDataValue("show_in_suggestion", value ? 1 : 0);
      },
    },

    things_to_know: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "activity",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = activity;
