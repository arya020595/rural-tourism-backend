const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
//const RtUser = require('./userModel'); // import the user model


const OperatorActivity = sequelize.define('operator_activities', {
  id: { type: DataTypes.STRING, primaryKey: true },
  activity_id: { type: DataTypes.INTEGER, allowNull: false },
  rt_user_id: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  address: { type: DataTypes.STRING, allowNull: true },
  district: { type: DataTypes.STRING, allowNull: false },
  image: {
  type: DataTypes.TEXT('long'),
  allowNull: true
},
  operator_logo: { type: DataTypes.TEXT, allowNull: true },
  services_provided: { type: DataTypes.JSON, allowNull: false },
  price_per_pax: { type: DataTypes.DECIMAL(10,2), allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'operator_activities',
  timestamps: false
});

// OperatorActivity.belongsTo(RtUser, {
//   foreignKey: 'rt_user_id',
//   as: 'rt_user'
// });

module.exports = OperatorActivity;
