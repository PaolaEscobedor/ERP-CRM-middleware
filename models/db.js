const sql = require('mssql');
require('dotenv').config();

const dbSettings = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false, 
        trustServerCertificate : true
    }


};


// Connect to BD

const getConnection = async () => {
    try {
        const pool= await sql.connect(dbSettings);
        console.log('Successfully connected to Intelisis BD');
        return pool;
    } catch (error) {
        console.error('Couldnt connect to db: ', error.message);

    }
}

module.exports= {sql, getConnection}