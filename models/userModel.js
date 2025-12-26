const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/db');
// const OperatorActivity = require('./operatorActivitiesModel'); // import but don’t use yet

const User = sequelize.define('rt_user', {
  user_id: { type: DataTypes.STRING, primaryKey: true, defaultValue: () => uuidv4() },
  username: { type: DataTypes.STRING, allowNull: false },
  user_email: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  full_name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Not Provided' },
  securityQ1: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Not Set' },
  securityQ2: { type: DataTypes.STRING, allowNull: true, defaultValue: 'Not Set' },
  business_name: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Not Provided' },
  company_logo: { type: DataTypes.TEXT('long'), allowNull: true }

}, {
  tableName: 'rt_user',
  timestamps: false
});

// Associations should be set after exporting or in a separate file
//User.hasMany(OperatorActivity, { foreignKey: 'rt_user_id', as: 'activities' }); // ✅ Move this

module.exports = User;
