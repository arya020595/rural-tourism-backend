const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../config/db'); // Your Sequelize instance

const accom = sequelize.define('accomodation', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },

    address: {
      type: DataTypes.STRING,
      allowNull: true
    },

    price: {
        type: DataTypes.DECIMAL(10,2),
    },

    image: {
    type: DataTypes.TEXT('long'), // <-- 'long' tells Sequelize to use LONGTEXT
    allowNull: true,
    },


    district: {
        type: DataTypes.TEXT,
    },

    showAvailability: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    field: 'show_availability', // 👈 maps camelCase to snake_case DB column
    get() {
        const rawValue = this.getDataValue('showAvailability');
        return rawValue === 1;
    },
    set(value) {
        this.setDataValue('showAvailability', value ? 1 : 0);
    }
    },

    provided_accomodation: {
    type: DataTypes.TEXT,  // or DataTypes.JSON if supported
    allowNull: true
    },


    

    user_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    tableName: 'accomodation_new',  // Explicitly define the table name here
    
    
});

module.exports = accom;