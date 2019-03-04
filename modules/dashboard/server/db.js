const fs = require('fs');
const { Pool } = require('pg');

const host = process.env.POSTGRES_URL || 'localhost:5432'
const user = process.env.POSTGRES_USER || 'indra'
const database = process.env.POSTGRES_DB || 'indra'
const password = fs.readFileSync(process.env.POSTGRES_PASSWORD_FILE, 'utf8')

const pool = new Pool({
  connectionString: `postgres://${user}:${password}@${host}/${database}`
})

const query = async (sql) =>{
    try {
        return await pool.query(sql);
    } catch(e) {
        console.log(`Error: ${JSON.stringify(e.stack)}`)
        return null;
    }
};

module.exports = query
