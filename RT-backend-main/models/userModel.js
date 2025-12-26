const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Your Sequelize instance

const User = sequelize.define('rt_user', {
    user_id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false
    },
    user_email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    full_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    securityQ1: {
        type: DataTypes.STRING,
        allowNull: true
    },
    securityQ2: {
        type: DataTypes.STRING,
        allowNull: true
    },
    business_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    district: {
        type: DataTypes.STRING,
        allowNull: true
    },
    
}, {
    tableName: 'rt_user',
    timestamps: false // Specify the correct table name
});


// You can also define custom methods here if needed

module.exports = User;
