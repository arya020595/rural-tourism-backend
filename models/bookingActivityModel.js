const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ActivityBooking = sequelize.define("activity_booking", {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    tourist_user_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    activity_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    operator_activity_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    no_of_pax: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    contact_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    contact_phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nationality: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: "activity_booking",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
});

module.exports = ActivityBooking;
