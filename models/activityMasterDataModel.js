const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const sequelizePaginate = require("sequelize-paginate");

const ActivityMasterData = sequelize.define(
  "activity_master_data",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    activity_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    address: DataTypes.STRING,
    things_to_know: DataTypes.JSON, // stores your JSON data
    image: DataTypes.STRING,
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "activity_master_table",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// Add pagination plugin
sequelizePaginate.paginate(ActivityMasterData);

module.exports = ActivityMasterData;
