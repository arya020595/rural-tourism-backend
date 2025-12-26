const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Your Sequelize instance

const accom = sequelize.define('accomodation', {
    homest_id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    homest_name: {
        type: DataTypes.STRING,
        
    },
    //location: {
    //    type: DataTypes.STRING,
    //    allowNull: false
    //},
    //user_id: {
    //    type: DataTypes.STRING,
    //    allowNull: false
    //},
}, {
    tableName: 'accomodation',  // Explicitly define the table name here
    
    
});

module.exports = accom;