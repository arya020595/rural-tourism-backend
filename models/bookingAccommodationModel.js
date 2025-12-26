const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../config/db'); // Your Sequelize instance

const AccommodationBooking = sequelize.define('accommodation_booking', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },

    tourist_user_id: {
        type: DataTypes.STRING,  // CHAR or VARCHAR in MySQL
        allowNull: false
    },

    accommodation_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    operator_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },

    accommodation_name: {
        type: DataTypes.STRING,
        allowNull: true
    },

    operator_name: {
        type: DataTypes.STRING,
        allowNull: true
    },

    location: {
        type: DataTypes.STRING,
        allowNull: true
    },

    start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },

    end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },

    number_of_nights: {
        type: DataTypes.INTEGER,
        allowNull: true
    },

    no_of_rooms: {
        type: DataTypes.INTEGER,
        allowNull: true
    },

    total_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },

    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending'
    },

    
    no_of_pax: {
        type: DataTypes.INTEGER,
        allowNull: false,
    }

}, {
    tableName: 'accommodation_booking',
    timestamps: true, // adds createdAt and updatedAt
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = AccommodationBooking;
