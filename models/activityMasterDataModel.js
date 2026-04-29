const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const sequelizePaginate = require("sequelize-paginate");

const ActivityMasterData = sequelize.define(
  "activity_master_data",
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    activity_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    things_to_know: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    image: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    show_in_suggestions: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "activity_master_data",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
);

// Add pagination plugin
sequelizePaginate.paginate(ActivityMasterData);

module.exports = ActivityMasterData;
