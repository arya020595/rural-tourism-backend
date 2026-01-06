const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
//const RtUser = require('./userModel'); // import the user model

const OperatorActivity = sequelize.define(
  "operator_activities",
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    activity_id: { type: DataTypes.BIGINT, allowNull: false },
    rt_user_id: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING, allowNull: false },
    district: { type: DataTypes.STRING, allowNull: true },
    image: { type: DataTypes.TEXT("long"), allowNull: true },
    services_provided: { type: DataTypes.STRING, allowNull: false },
    available_dates: { type: DataTypes.JSON, allowNull: false },
    price_per_pax: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  },
  {
    tableName: "operator_activities",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

// OperatorActivity.belongsTo(RtUser, {
//   foreignKey: 'rt_user_id',
//   as: 'rt_user'
// });

module.exports = OperatorActivity;
