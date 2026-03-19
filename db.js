const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role VARCHAR(10) DEFAULT 'student' CHECK (role IN ('student', 'admin')),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS replies (
      id SERIAL PRIMARY KEY,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  const bcrypt = require('bcrypt');
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [adminUsername]);
  if (existing.rows.length === 0) {
    const hashed = await bcrypt.hash(adminPassword, 12);
    await pool.query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', [adminUsername, hashed, 'admin']);
    console.log('admin created');
  }
  console.log('DB init done');
};

initDB().catch(console.error);
module.exports = pool;
