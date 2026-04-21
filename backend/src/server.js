import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from './db.js'
import { authRequired, roleRequired } from './middleware.js'

dotenv.config({ path: 'backend/.env' })

const app = express()
app.use(cors())
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json())

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.post('/auth/login', async (req, res) => {
  const { nik, password } = req.body
  const users = await query(
    `SELECT u.id, u.nik, u.password, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.nik = ?`,
    [nik],
  )
  const user = users[0]
  if (!user) return res.status(401).json({ message: 'NIK tidak ditemukan' })

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return res.status(401).json({ message: 'Password salah' })

  const token = jwt.sign({ sub: user.id, nik: user.nik, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  })
  return res.json({ token, role: user.role })
})

app.post('/auth/logout', authRequired, (_, res) => res.json({ message: 'Logout berhasil' }))

app.get('/employees', authRequired, async (_, res) => {
  const rows = await query(
    `SELECT e.id, e.name, d.name department, p.name position, e.contract_end
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN positions p ON p.id = e.position_id
     ORDER BY e.id DESC`,
  )
  res.json(rows)
})

app.post('/employees', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  const { name, department_id, position_id, contract_end } = req.body
  const inserted = await query(
    `INSERT INTO employees(name, department_id, position_id, contract_end)
     VALUES (?, ?, ?, ?)`,
    [name, department_id, position_id, contract_end],
  )
  const created = await query('SELECT * FROM employees WHERE id = ?', [inserted.insertId])
  res.status(201).json(created[0])
})

app.put('/employees/:id', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  const { id } = req.params
  const { name, department_id, position_id, contract_end } = req.body
  await query(
    `UPDATE employees SET name=?, department_id=?, position_id=?, contract_end=?
     WHERE id=?`,
    [name, department_id, position_id, contract_end, id],
  )
  const updated = await query('SELECT * FROM employees WHERE id = ?', [id])
  res.json(updated[0] || null)
})

app.delete('/employees/:id', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  await query('DELETE FROM employees WHERE id=?', [req.params.id])
  res.status(204).end()
})

app.post('/attendance/clockin', authRequired, async (req, res) => {
  const { employee_id, gps_location, selfie } = req.body
  const inserted = await query(
    `INSERT INTO attendance(employee_id, clock_in, gps_location, selfie, status)
     VALUES (?, NOW(), ?, ?, 'Aktif')`,
    [employee_id, gps_location, selfie],
  )
  const created = await query('SELECT * FROM attendance WHERE id = ?', [inserted.insertId])
  res.status(201).json(created[0])
})

app.post('/attendance/clockout', authRequired, async (req, res) => {
  const { attendance_id } = req.body
  await query(
    'UPDATE attendance SET clock_out = NOW() WHERE id=?',
    [attendance_id],
  )
  const updated = await query('SELECT * FROM attendance WHERE id = ?', [attendance_id])
  res.json(updated[0] || null)
})

app.post('/leave', authRequired, async (req, res) => {
  const { employee_id, leave_type, start_date, end_date, reason } = req.body
  const inserted = await query(
    `INSERT INTO leave_request(employee_id, leave_type, start_date, end_date, reason, status)
     VALUES(?, ?, ?, ?, ?, 'Pending')`,
    [employee_id, leave_type, start_date, end_date, reason],
  )
  const created = await query('SELECT * FROM leave_request WHERE id = ?', [inserted.insertId])
  res.status(201).json(created[0])
})

app.put('/leave/approve', authRequired, roleRequired('Manager', 'HRD', 'Super Admin'), async (req, res) => {
  const { leave_id, status } = req.body
  await query('UPDATE leave_request SET status=? WHERE id=?', [status, leave_id])
  const updated = await query('SELECT * FROM leave_request WHERE id = ?', [leave_id])
  res.json(updated[0] || null)
})

async function recalculatePayrollRun(runId) {
  const items = await query('SELECT * FROM payroll_run_items WHERE payroll_run_id = ?', [runId])
  const totals = items.reduce(
    (acc, item) => {
      acc.gross += Number(item.gross_amount || 0)
      acc.deduction += Number(item.deduction_amount || 0)
      acc.net += Number(item.net_amount || 0)
      return acc
    },
    { gross: 0, deduction: 0, net: 0 },
  )

  await query(
    `UPDATE payroll_runs
     SET employee_count=?, total_gross=?, total_deduction=?, total_net=?, updated_at=NOW()
     WHERE id=?`,
    [items.length, totals.gross, totals.deduction, totals.net, runId],
  )
}

app.post('/payroll/runs/generate', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (req, res) => {
  const periodMonth = req.body.periodMonth || new Date().toISOString().slice(0, 7) + '-01'
  const existingRuns = await query(
    "SELECT id, status FROM payroll_runs WHERE period_month = ? AND status IN ('draft','reviewed','approved') ORDER BY id DESC LIMIT 1",
    [periodMonth],
  )
  if (existingRuns.length > 0) {
    return res.status(409).json({ message: 'Masih ada run aktif untuk periode ini', run: existingRuns[0] })
  }

  const runInsert = await query(
    `INSERT INTO payroll_runs(period_month, status, created_by, updated_at)
     VALUES(?, 'draft', ?, NOW())`,
    [periodMonth, req.user.sub],
  )

  const runId = runInsert.insertId
  const employeeRows = await query('SELECT id FROM employees ORDER BY id')

  for (const employee of employeeRows) {
    const salary = 8000000
    const allowance = 1000000
    const deduction = 250000
    const grossAmount = salary + allowance
    const netAmount = grossAmount - deduction

    const itemInsert = await query(
      `INSERT INTO payroll_run_items(payroll_run_id, employee_id, gross_amount, deduction_amount, net_amount, tax_amount, bpjs_amount, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [runId, employee.id, grossAmount, deduction, netAmount],
    )

    await query(
      `INSERT INTO payroll_run_item_components(payroll_run_item_id, component_name_snapshot, component_type, amount, calculation_meta, created_at)
       VALUES
       (?, 'Gaji Pokok', 'earning', ?, JSON_OBJECT('source','default-rule'), NOW()),
       (?, 'Tunjangan', 'earning', ?, JSON_OBJECT('source','default-rule'), NOW()),
       (?, 'Potongan', 'deduction', ?, JSON_OBJECT('source','default-rule'), NOW())`,
      [itemInsert.insertId, salary, itemInsert.insertId, allowance, itemInsert.insertId, deduction],
    )
  }

  await recalculatePayrollRun(runId)
  const runs = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  return res.status(201).json(runs[0])
})

app.get('/payroll/runs', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (req, res) => {
  const period = req.query.period
  const rows = period
    ? await query('SELECT * FROM payroll_runs WHERE period_month = ? ORDER BY id DESC', [period])
    : await query('SELECT * FROM payroll_runs ORDER BY id DESC LIMIT 24')
  return res.json(rows)
})

app.get('/payroll/runs/:runId', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (req, res) => {
  const runId = req.params.runId
  const runRows = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  if (runRows.length === 0) return res.status(404).json({ message: 'Run tidak ditemukan' })

  const itemRows = await query(
    `SELECT pri.*, e.name AS employee_name, d.name AS department
     FROM payroll_run_items pri
     JOIN employees e ON e.id = pri.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE pri.payroll_run_id = ?
     ORDER BY e.name`,
    [runId],
  )

  const components = await query(
    `SELECT prc.*
     FROM payroll_run_item_components prc
     JOIN payroll_run_items pri ON pri.id = prc.payroll_run_item_id
     WHERE pri.payroll_run_id = ?`,
    [runId],
  )

  const groupedComponents = new Map()
  for (const component of components) {
    if (!groupedComponents.has(component.payroll_run_item_id)) {
      groupedComponents.set(component.payroll_run_item_id, [])
    }
    groupedComponents.get(component.payroll_run_item_id).push(component)
  }

  const itemsWithComponents = itemRows.map((item) => ({
    ...item,
    components: groupedComponents.get(item.id) || [],
  }))

  return res.json({ run: runRows[0], items: itemsWithComponents })
})

app.post('/payroll/runs/:runId/finalize', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (req, res) => {
  const runId = req.params.runId
  const runRows = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  const run = runRows[0]
  if (!run) return res.status(404).json({ message: 'Run tidak ditemukan' })
  if (!['draft', 'reviewed', 'approved'].includes(run.status)) {
    return res.status(400).json({ message: `Run status ${run.status} tidak bisa difinalisasi` })
  }

  await query(
    `UPDATE payroll_runs
     SET status='finalized', finalized_by=?, finalized_at=NOW(), updated_at=NOW()
     WHERE id=?`,
    [req.user.sub, runId],
  )
  const updated = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  return res.json(updated[0])
})

app.post('/payroll/run', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (req, res) => {
  const periodMonth = new Date().toISOString().slice(0, 7) + '-01'
  const runInsert = await query(
    `INSERT INTO payroll_runs(period_month, status, created_by, updated_at)
     VALUES(?, 'finalized', ?, NOW())`,
    [periodMonth, req.user.sub],
  )
  const runId = runInsert.insertId
  const rows = await query('SELECT id FROM employees ORDER BY id')
  let count = 0

  for (const employee of rows) {
    const salary = 8000000
    const allowance = 1000000
    const deduction = 250000
    const total = salary + allowance - deduction
    await query(
      `INSERT INTO payroll(employee_id, salary, allowance, deduction, total, period_month)
       VALUES(?, ?, ?, ?, ?, ?)`,
      [employee.id, salary, allowance, deduction, total, periodMonth],
    )
    await query(
      `INSERT INTO payroll_run_items(payroll_run_id, employee_id, gross_amount, deduction_amount, net_amount, tax_amount, bpjs_amount, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [runId, employee.id, salary + allowance, deduction, total],
    )
    count += 1
  }

  await recalculatePayrollRun(runId)
  await query("UPDATE payroll_runs SET status='finalized', finalized_by=?, finalized_at=NOW() WHERE id=?", [req.user.sub, runId])
  res.json({ message: 'Payroll selesai', count, runId })
})

app.get('/payslip/:id', authRequired, async (req, res) => {
  const rows = await query(
    `SELECT p.*, py.salary, py.allowance, py.deduction, py.total
     FROM payslip p
     JOIN payroll py ON py.id = p.payroll_id
     WHERE p.id = ?`,
    [req.params.id],
  )
  res.json(rows[0] || null)
})

app.get('/reports/dashboard', authRequired, async (_, res) => {
  const [employees, pendingLeave, attendanceToday, payrollTotal] = await Promise.all([
    query('SELECT COUNT(*) AS total FROM employees'),
    query("SELECT COUNT(*) AS total FROM leave_request WHERE status='Pending'"),
    query(
      `SELECT COALESCE(
        ROUND(
          (
            (SELECT COUNT(*) FROM attendance WHERE DATE(clock_in) = CURDATE()) /
            NULLIF((SELECT COUNT(*) FROM employees), 0)
          ) * 100,
        1),
      0) AS percentage`,
    ),
    query("SELECT COALESCE(SUM(total),0) AS total FROM payroll WHERE period_month = DATE_FORMAT(CURDATE(), '%Y-%m-01')"),
  ])

  res.json({
    totalEmployees: Number(employees[0].total),
    attendanceRate: Number(attendanceToday[0].percentage),
    pendingLeave: Number(pendingLeave[0].total),
    payrollTotal: Number(payrollTotal[0].total),
  })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: 'Internal server error' })
})

const port = process.env.PORT || 5000
app.listen(port, () => {
  console.log(`HRIS API running on http://localhost:${port}`)
})
