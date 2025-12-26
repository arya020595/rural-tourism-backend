const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Your Sequelize instance

const activity = sequelize.define('activity', {
    activity_id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    activity_name: {
        type: DataTypes.STRING,
        
    },
    //location: {
    //    type: DataTypes.STRING,
    //    allowNull: false
    //},
    user_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    tableName: 'activity',  // Explicitly define the table name here
    
    
});

module.exports = activity;