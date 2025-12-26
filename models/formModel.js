const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Your Sequelize instance

const form_rp = sequelize.define('form_responses', {
    receipt_id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    citizenship: {
        type: DataTypes.STRING,
        allowNull: false
    },
    pax: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    activity_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    homest_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true
    },
    activity_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    homest_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    total_rm: {
        type: DataTypes.STRING,
        allowNull: true
    },
    total_night: {
        type: DataTypes.STRING,
        allowNull: true
    },
    package: {
        type: DataTypes.JSON,
        allowNull: true
    },
    issuer: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'Active'
    },
    date: {
        type: DataTypes.DATE,
        allowNull: true
    }
})

module.exports = form_rp;