const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Your Sequelize instance

const TouristUser = sequelize.define('tourist_user', {
  tourist_user_id: {
    type: DataTypes.UUID,          // ✅ auto-generated UUID
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  user_email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  full_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contact_no: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  nationality: {
    type: DataTypes.STRING,
    allowNull: false,
  }
}, {
  tableName: 'tourist_user',  // ✅ use the correct table name
  timestamps: false,
});

module.exports = TouristUser;
