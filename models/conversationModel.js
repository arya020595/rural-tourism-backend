const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // same as your setup

const Conversation = sequelize.define('conversation', {
  conversation_id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  operator_id: {
    type: DataTypes.STRING,
    allowNull: false, // from rt_user table
  },
  tourist_user_id: {
    type: DataTypes.STRING,
    allowNull: false, // from tourist_user table
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'conversation',
  timestamps: false,
});

module.exports = Conversation;
