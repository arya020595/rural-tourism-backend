// require('dotenv').config();
// const mysql = require('mysql');

// const db = mysql.createConnection({
//     // connectionLimit: 10,
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: '',
//     database: process.env.DB_DATABASE,
//     port: 3308
// });

// db.connect((err) => {
//     if (err) {
//         console.error('Error connecting to MySQL:', err);
//         return;
//     }
//     console.log('Connected to MySQL');
//     // connection.release(); // Release the connection back to the pool
// });

// module.exports = db;

require('dotenv').config(); // Load environment variables from .env file
const { Sequelize } = require('sequelize');

// Create a new instance of Sequelize using environment variables
const sequelize = new Sequelize( process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,  // Use environment variable for host
    port: process.env.DB_PORT,  // Specify the port from environment variable
    dialect: 'mysql',            // Specify the dialect as MySQL
    logging: console.log,              // Set to true if you want to see SQL queries in the console
});

sequelize.authenticate()
    .then(() => console.log('Database connected successfully'))
    .catch((error) => console.error('Unable to connect to the database:', error));

// Test the connection
const testConnection = async () => {
    try {
        await sequelize.authenticate();  // Authenticate to test the connection
        console.log('Connection to MySQL has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

// // Sync all models with the database (create tables if they don't exist)
const syncDatabase = async () => {
    try {
        await sequelize.sync({ force: false });  // Use { force: true } to drop tables and recreate them
        console.log('Database tables have been created or are up to date.');
    } catch (error) {
        console.error('Error syncing database:', error);
    }
};

// Call the test connection function
testConnection();
// sync tables
syncDatabase();

module.exports = sequelize;  // Export the sequelize instance

