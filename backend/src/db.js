import mysql from 'mysql2/promise'

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hris_db',
  waitForConnections: true,
  connectionLimit: 10,
})

export async function query(text, params = []) {
  const [rows] = await pool.execute(text, params)
  return rows
}
