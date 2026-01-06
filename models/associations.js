// models/associations.js
const RtUser = require("./userModel");
const OperatorActivity = require("./operatorActivitiesModel");
const ActivityMasterData = require("./activityMasterDataModel");

// User <-> OperatorActivity associations
RtUser.hasMany(OperatorActivity, {
  foreignKey: "rt_user_id",
  as: "activities",
});
OperatorActivity.belongsTo(RtUser, { foreignKey: "rt_user_id", as: "rt_user" });

// OperatorActivity <-> ActivityMasterData associations
ActivityMasterData.hasMany(OperatorActivity, {
  foreignKey: "activity_id",
  as: "operators",
});
OperatorActivity.belongsTo(ActivityMasterData, {
  foreignKey: "activity_id",
  as: "activity_master",
});
