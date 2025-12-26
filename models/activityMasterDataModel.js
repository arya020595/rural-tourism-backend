const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ActivityMasterData = sequelize.define('activity_master_data', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  activity_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: DataTypes.TEXT,
  address: DataTypes.STRING,
  things_to_know: DataTypes.JSON, // stores your JSON data
  image: DataTypes.STRING,
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'activity_master_data',
  timestamps: false
});

module.exports = ActivityMasterData;
