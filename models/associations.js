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
const Booking = require("./bookingModel");
const BookingPackageCompany = require("./bookingPackageCompanyModel");

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

// UnifiedUser <-> Booking associations
UnifiedUser.hasMany(Booking, {
  foreignKey: "userId",
  as: "bookings",
});

Booking.belongsTo(UnifiedUser, {
  foreignKey: "userId",
  as: "user",
});

// Company <-> Booking associations
Company.hasMany(Booking, {
  foreignKey: "companyId",
  as: "bookings",
});

Booking.belongsTo(Company, {
  foreignKey: "companyId",
  as: "company",
});

// Product <-> Booking associations
Product.hasMany(Booking, {
  foreignKey: "productId",
  as: "bookings",
});

Booking.belongsTo(Product, {
  foreignKey: "productId",
  as: "product",
});

// Booking(package) <-> BookingPackageCompany associations
Booking.hasMany(BookingPackageCompany, {
  foreignKey: "bookingPackageId",
  as: "package_companies",
});

BookingPackageCompany.belongsTo(Booking, {
  foreignKey: "bookingPackageId",
  as: "booking_package",
});

// Company(referral) <-> BookingPackageCompany associations
Company.hasMany(BookingPackageCompany, {
  foreignKey: "referrerId",
  as: "referrals_given",
});

BookingPackageCompany.belongsTo(Company, {
  foreignKey: "referrerId",
  as: "referrer_company",
});

Company.hasMany(BookingPackageCompany, {
  foreignKey: "refereeId",
  as: "referrals_received",
});

BookingPackageCompany.belongsTo(Company, {
  foreignKey: "refereeId",
  as: "referee_company",
});
