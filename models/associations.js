// models/associations.js
const RtUser = require('./userModel');
const OperatorActivity = require('./operatorActivitiesModel');

RtUser.hasMany(OperatorActivity, { foreignKey: 'rt_user_id', as: 'activities' });
OperatorActivity.belongsTo(RtUser, { foreignKey: 'rt_user_id', as: 'rt_user' });
