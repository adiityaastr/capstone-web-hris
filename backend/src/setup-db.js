import dotenv from 'dotenv'
import fs from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'

dotenv.config({ path: 'backend/.env' })

const host = process.env.DB_HOST || 'localhost'
const port = Number(process.env.DB_PORT || 3306)
const user = process.env.DB_USER || 'root'
const password = process.env.DB_PASSWORD || ''
const database = process.env.DB_NAME || 'hris_db'

async function run() {
  const rootConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
  })

  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``)
  await rootConn.end()

  const dbConn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    multipleStatements: true,
  })

  const schemaPath = path.resolve(process.cwd(), 'backend/schema.sql')
  const seedPath = path.resolve(process.cwd(), 'backend/seed.sql')
  const payrollSchemaPath = path.resolve(process.cwd(), 'backend/payroll-schema.sql')
  const schemaSql = await fs.readFile(schemaPath, 'utf8')
  const seedSql = await fs.readFile(seedPath, 'utf8')

  await dbConn.query(schemaSql)
  try {
    const payrollSchemaSql = await fs.readFile(payrollSchemaPath, 'utf8')
    await dbConn.query(payrollSchemaSql)
  } catch {
    // Optional payroll extension schema
  }
  await dbConn.query(seedSql)
  await dbConn.end()

  console.log(`Database ${database} siap digunakan di ${host}:${port}`)
}

run().catch((error) => {
  console.error('Setup database gagal:', error)
  process.exit(1)
})
