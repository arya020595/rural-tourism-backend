const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../config/db'); // your Sequelize instance

const Notification = sequelize.define(
  'notification',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    operator_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'References rt_user.user_id',
    },

    tourist_user_id: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'References tourist_user.tourist_user_id',
    },

    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'References the accommodation booking ID',
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    read_status: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      field: 'read_status',
      get() {
        return this.getDataValue('read_status') === 1;
      },
      set(value) {
        this.setDataValue('read_status', value ? 1 : 0);
      },
    },
  },
  {
    tableName: 'notifications',
    timestamps: true, // createdAt and updatedAt
  }
);

module.exports = Notification;
