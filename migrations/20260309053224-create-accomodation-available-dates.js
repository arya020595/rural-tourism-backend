'use strict';

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.sequelize.transaction(async (transaction) => {

      await queryInterface.createTable('accomodation_availabilities', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },

        date: {
          allowNull: false,
          type: Sequelize.DATE
        },

        price: {
          allowNull: false,
          type: Sequelize.DECIMAL(10, 2)
        },

        quota: {
          allowNull: false,
          type: Sequelize.INTEGER,
          defaultValue: 0,
          validate: {
            min: 0
          }
        },

        accomodation_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'accommodation_list',
            key: 'accommodation_id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },

        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },

        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal(
            'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
          )
        },

        deleted_at: {
          allowNull: true,
          type: Sequelize.DATE
        }
      }, { transaction });


      // quota >= 0 constraint
      await queryInterface.addConstraint('accomodation_availabilities', {
        fields: ['quota'],
        type: 'check',
        name: 'chk_accomodation_availabilities_quota_non_negative',
        where: {
          quota: {
            [Sequelize.Op.gte]: 0
          }
        }
      }, { transaction });


      // FK index
      await queryInterface.addIndex(
        'accomodation_availabilities',
        ['accomodation_id'],
        { transaction }
      );


      // prevent duplicated availability per date
      await queryInterface.addConstraint('accomodation_availabilities', {
        fields: ['accomodation_id', 'date'],
        type: 'unique',
        name: 'uniq_accomodation_date'
      }, { transaction });


      /*
      ==========================
      DATA MIGRATION
      ==========================
      */

      const accommodations = await queryInterface.sequelize.query(
        `SELECT accommodation_id, available_dates
         FROM accommodation_list`,
        {
          type: Sequelize.QueryTypes.SELECT,
          transaction
        }
      );


      const rows = accommodations.flatMap((acc) => {

        if (!acc.available_dates) return [];

        let dates = acc.available_dates;

        if (typeof dates === 'string') {
          dates = JSON.parse(dates);
        }

        return dates.map((d) => ({
          date: d.date,
          price: d.price,
          quota: 3,
          accomodation_id: acc.accommodation_id,
          created_at: new Date(),
          updated_at: new Date()
        }));

      });


      if (rows.length > 0) {

        await queryInterface.bulkInsert(
          'accomodation_availabilities',
          rows,
          { transaction }
        );

      }

    });

  },


  async down(queryInterface, Sequelize) {

    await queryInterface.sequelize.transaction(async (transaction) => {

      const availabilities = await queryInterface.sequelize.query(
        `SELECT accomodation_id, date, price
         FROM accomodation_availabilities`,
        {
          type: Sequelize.QueryTypes.SELECT,
          transaction
        }
      );


      const map = {};

      availabilities.forEach((row) => {

        if (!map[row.accomodation_id]) {
          map[row.accomodation_id] = [];
        }

        map[row.accomodation_id].push({
          date: row.date,
          price: Number(row.price)
        });

      });


      await Promise.all(
        Object.entries(map).map(([accomodationId, dates]) => {

          return queryInterface.sequelize.query(
            `
            UPDATE accommodation_list
            SET available_dates = :dates
            WHERE accommodation_id = :id
            `,
            {
              replacements: {
                id: accomodationId,
                dates: JSON.stringify(dates)
              },
              transaction
            }
          );

        })
      );


      await queryInterface.dropTable(
        'accomodation_availabilities',
        { transaction }
      );

    });

  }
};