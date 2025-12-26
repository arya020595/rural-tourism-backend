const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../config/db'); // Your Sequelize instance

const ActivityBooking = sequelize.define('activity_booking', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },

    tourist_user_id: {
        type: DataTypes.STRING,  // CHAR type in MySQL
        allowNull: false
    },

    activity_id: {
        type: DataTypes.INTEGER,
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
        allowNull: false,
        defaultValue: 'pending'
    }

}, {
    tableName: 'activity_booking',
    timestamps: true, // adds createdAt and updatedAt
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = ActivityBooking;
