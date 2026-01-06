const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notification = sequelize.define('notification', {
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.STRING,
        allowNull: true
    },
    type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    related_id: {
        type: DataTypes.BIGINT,
        allowNull: false
    },
    is_read: {
        type: DataTypes.TINYINT,
        allowNull: true,
        defaultValue: 0,
        get() {
            return this.getDataValue('is_read') === 1;
        },
        set(value) {
            this.setDataValue('is_read', value ? 1 : 0);
        }
    }
}, {
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Notification;
