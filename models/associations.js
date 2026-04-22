// models/associations.js
const TouristUser = require("./touristModel");
const AssociationUser = require("./associationUserModel");
const UnifiedUser = require("./unifiedUserModel");
const OperatorActivity = require("./operatorActivitiesModel");
const ActivityMasterData = require("./activityMasterDataModel");
const Association = require("./associationModel");
const Company = require("./companyModel");
const Role = require("./roleModel");
const Permission = require("./permissionModel");
const RolePermission = require("./rolePermissionModel");
const Product = require("./productModel");

// User <-> OperatorActivity associations
UnifiedUser.hasMany(OperatorActivity, {
  foreignKey: "user_id",
  as: "activities",
});
OperatorActivity.belongsTo(UnifiedUser, {
  foreignKey: "user_id",
  as: "operator",
});
OperatorActivity.belongsTo(UnifiedUser, {
  foreignKey: "user_id",
  as: "rt_user",
});

// OperatorActivity <-> ActivityMasterData associations
ActivityMasterData.hasMany(OperatorActivity, {
  foreignKey: "activity_id",
  as: "operators",
});
OperatorActivity.belongsTo(ActivityMasterData, {
  foreignKey: "activity_id",
  as: "activity_master",
});

// Role <-> Permission associations
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "role_id",
  otherKey: "permission_id",
  as: "permissions",
});

Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permission_id",
  otherKey: "role_id",
  as: "roles",
});

RolePermission.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
});

RolePermission.belongsTo(Permission, {
  foreignKey: "permission_id",
  as: "permission",
});

// Role <-> users associations
Role.hasMany(TouristUser, {
  foreignKey: "role_id",
  as: "tourist_users",
});

TouristUser.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
});

Role.hasMany(AssociationUser, {
  foreignKey: "role_id",
  as: "association_users",
});

AssociationUser.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
});

Role.hasMany(UnifiedUser, {
  foreignKey: "role_id",
  as: "users",
});

UnifiedUser.belongsTo(Role, {
  foreignKey: "role_id",
  as: "role",
});

Association.hasMany(UnifiedUser, {
  foreignKey: "association_id",
  as: "unified_users",
});

UnifiedUser.belongsTo(Association, {
  foreignKey: "association_id",
  as: "association",
});

Company.hasMany(UnifiedUser, {
  foreignKey: "company_id",
  as: "users",
});

UnifiedUser.belongsTo(Company, {
  foreignKey: "company_id",
  as: "company",
});

// Company <-> Product associations
Company.hasMany(Product, {
  foreignKey: "company_id",
  as: "products",
});

Product.belongsTo(Company, {
  foreignKey: "company_id",
  as: "company",
});
