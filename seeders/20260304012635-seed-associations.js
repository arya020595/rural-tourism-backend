'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert('associations', [
      {
        name: 'Association Alpha',
        image: 'https://placehold.co/50x50?text=A',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Association Beta',
        image: 'https://placehold.co/50x50?text=B',
        created_at: now,
        updated_at: now,
      },
      {
        name: 'Association Gamma',
        image: 'https://placehold.co/50x50?text=C',
        created_at: now,
        updated_at: now,
      }
    ]);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('associations', {
      name: [
        'Association Alpha',
        'Association Beta',
        'Association Gamma'
      ]
    });
  }
};
