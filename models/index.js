const sequelize = require("../config/db");

const TouristUser = require("./touristModel");
const AssociationUser = require("./associationUserModel");
const User = require("./unifiedUserModel");
const Association = require("./associationModel");
const Company = require("./companyModel");
const Role = require("./roleModel");
const Permission = require("./permissionModel");
const RolePermission = require("./rolePermissionModel");
const Booking = require("./bookingModel");
const BookingPackageCompany = require("./bookingPackageCompanyModel");
const Product = require("./productModel");
const Quotation = require("./quotationModel");
const QuotationItem = require("./quotationItemModel");

// ======================
// Export Models
// ======================

const db = {};

db.sequelize = sequelize;

db.User = User;
db.TouristUser = TouristUser;
db.AssociationUser = AssociationUser;
db.UnifiedUser = User;
db.Association = Association;
db.Company = Company;
db.Role = Role;
db.Permission = Permission;
db.RolePermission = RolePermission;
db.Booking = Booking;
db.BookingPackageCompany = BookingPackageCompany;
db.Product = Product;
db.Quotation = Quotation;
db.QuotationItem = QuotationItem;

module.exports = db;
