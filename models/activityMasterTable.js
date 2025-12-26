const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Your Sequelize instance

const activity_master_table = sequelize.define('activity_new', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    activity_name: {
        type: DataTypes.STRING,
    },
    description:{
        type: DataTypes.TEXT,
    },
    address: {
      type: DataTypes.STRING,
      allowNull: true
    },
    price: {
        type: DataTypes.DECIMAL(10,2),
    },
    image: {
        type: DataTypes.TEXT, // Store base64 strings or image URLs
        allowNull: true,
    },
    district: {
        type: DataTypes.TEXT,
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true
    },
    
    showInSuggestions: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    field: 'show_in_suggestions', // 👈 maps camelCase to snake_case DB column
    get() {
        const rawValue = this.getDataValue('showInSuggestions');
        return rawValue === 1;
    },
    set(value) {
        this.setDataValue('showInSuggestions', value ? 1 : 0);
    }
    },

    things_to_know: {
    type: DataTypes.TEXT,  // or DataTypes.JSON if supported
    allowNull: true
    },
    user_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
}, {
    tableName: 'activity_master_table',
    timestamps: false  // Explicitly define the table name here
    
});

module.exports = activity_master_table;