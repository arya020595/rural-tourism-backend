"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable("operator_activities");
        if (!table.operator_logo) {
            await queryInterface.addColumn("operator_activities", "operator_logo", {
                type: Sequelize.TEXT,
                allowNull: true,
            });
        }
    },
	
	async down(queryInterface) {
	    const table = await queryInterface.describeTable("operator_activities");
	    if (table.operator_logo) {
	        await queryInterface.removeColumn("operator_activities", "operator_logo");
	    }
	},
};
