"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("operator_activities", "operator_logo", {
            type: Sequelize.TEXT,
            allowNull: true,
        });
    },
	
	async down(queryInterface) {
	    await queryInterface.removeColumn("operator_activities", "operator_logo");
	},
};
