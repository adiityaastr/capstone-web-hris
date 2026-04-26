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

app.get('/attendance/today', authRequired, async (_, res) => {
  const rows = await query(
    `SELECT a.id, a.employee_id, e.name AS employee_name, d.name AS department,
            a.clock_in, a.clock_out, a.status
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE DATE(a.clock_in) = CURDATE()
     ORDER BY a.clock_in ASC`,
  )
  res.json(rows)
})

app.get('/leave', authRequired, roleRequired('HRD', 'Manager', 'Super Admin', 'Finance'), async (_, res) => {
  const rows = await query(
    `SELECT lr.id, lr.employee_id, e.name AS employee_name, d.name AS department,
            lr.leave_type, lr.start_date, lr.end_date, lr.reason, lr.status
     FROM leave_request lr
     JOIN employees e ON e.id = lr.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     ORDER BY lr.id DESC`,
  )
  res.json(rows)
})

async function auditLog(payrollRunId, actorUserId, action, beforeData, afterData, ipAddress) {
  await query(
    `INSERT INTO payroll_audit_logs(payroll_run_id, actor_user_id, action, before_data, after_data, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payrollRunId,
      actorUserId,
      action,
      beforeData ? JSON.stringify(beforeData) : null,
      afterData ? JSON.stringify(afterData) : null,
      ipAddress || null,
    ],
  )
}

async function getSalaryProfileWithComponents(employeeId) {
  const profileRows = await query(
    `SELECT * FROM employee_salary_profiles WHERE employee_id = ? AND is_active = 1 ORDER BY effective_date DESC LIMIT 1`,
    [employeeId],
  )
  if (profileRows.length === 0) return null
  const profile = profileRows[0]

  const componentValues = await query(
    `SELECT escv.*, pc.code, pc.name, pc.type, pc.taxable
     FROM employee_salary_component_values escv
     JOIN payroll_components pc ON pc.id = escv.component_id
     WHERE escv.salary_profile_id = ?`,
    [profile.id],
  )

  return { profile, componentValues }
}

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

// =============================
// Salary Components CRUD
// =============================

app.get('/salary-components', authRequired, async (_, res) => {
  const rows = await query(
    `SELECT id, code, name, type, taxable, is_active, created_at, updated_at
     FROM payroll_components
     ORDER BY type, code`,
  )
  res.json(rows)
})

app.post('/salary-components', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  const { code, name, type, taxable } = req.body
  if (!code || !name || !type) {
    return res.status(400).json({ message: 'code, name, dan type wajib diisi' })
  }
  if (!['earning', 'deduction'].includes(type)) {
    return res.status(400).json({ message: 'type harus earning atau deduction' })
  }
  try {
    const inserted = await query(
      `INSERT INTO payroll_components(code, name, type, taxable, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [code, name, type, taxable !== undefined ? taxable : 1],
    )
    const created = await query('SELECT * FROM payroll_components WHERE id = ?', [inserted.insertId])
    await auditLog(null, req.user.sub, 'CREATE_COMPONENT', null, created[0], req.ip)
    res.status(201).json(created[0])
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `Komponen dengan code "${code}" sudah ada` })
    }
    throw err
  }
})

app.put('/salary-components/:id', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  const { id } = req.params
  const { name, type, taxable, is_active } = req.body
  const existing = await query('SELECT * FROM payroll_components WHERE id = ?', [id])
  if (existing.length === 0) return res.status(404).json({ message: 'Komponen tidak ditemukan' })

  const before = existing[0]
  await query(
    `UPDATE payroll_components SET name=?, type=?, taxable=?, is_active=?, updated_at=NOW()
     WHERE id=?`,
    [name ?? before.name, type ?? before.type, taxable ?? before.taxable, is_active ?? before.is_active, id],
  )
  const updated = await query('SELECT * FROM payroll_components WHERE id = ?', [id])
  await auditLog(null, req.user.sub, 'UPDATE_COMPONENT', before, updated[0], req.ip)
  res.json(updated[0])
})

app.delete('/salary-components/:id', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  const { id } = req.params
  const existing = await query('SELECT * FROM payroll_components WHERE id = ?', [id])
  if (existing.length === 0) return res.status(404).json({ message: 'Komponen tidak ditemukan' })
  await query('UPDATE payroll_components SET is_active = 0, updated_at = NOW() WHERE id = ?', [id])
  await auditLog(null, req.user.sub, 'DEACTIVATE_COMPONENT', existing[0], null, req.ip)
  res.json({ message: 'Komponen berhasil dinonaktifkan' })
})

// =============================
// Salary Profiles CRUD
// =============================

app.get('/salary-profiles', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (_, res) => {
  const rows = await query(
    `SELECT esp.id AS profile_id, esp.employee_id, e.name AS employee_name,
            d.name AS department, esp.base_salary, esp.effective_date,
            esp.payment_method, esp.bank_name, esp.bank_account_name, esp.bank_account_number,
            esp.is_active
     FROM employee_salary_profiles esp
     JOIN employees e ON e.id = esp.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE esp.is_active = 1
     ORDER BY e.name`,
  )

  const profileIds = rows.map((r) => r.profile_id)
  let componentValues = []
  if (profileIds.length > 0) {
    componentValues = await query(
      `SELECT escv.salary_profile_id, escv.component_id, escv.amount,
              pc.code AS component_code, pc.name AS component_name, pc.type AS component_type
       FROM employee_salary_component_values escv
       JOIN payroll_components pc ON pc.id = escv.component_id
       WHERE escv.salary_profile_id IN (${profileIds.map(() => '?').join(',')})`,
      profileIds,
    )
  }

  const componentMap = new Map()
  for (const cv of componentValues) {
    if (!componentMap.has(cv.salary_profile_id)) {
      componentMap.set(cv.salary_profile_id, [])
    }
    componentMap.get(cv.salary_profile_id).push(cv)
  }

  const result = rows.map((row) => {
    const components = componentMap.get(row.profile_id) || []
    const earnings = components.filter((c) => c.component_type === 'earning').reduce((s, c) => s + Number(c.amount), 0)
    const deductions = components.filter((c) => c.component_type === 'deduction').reduce((s, c) => s + Number(c.amount), 0)
    return {
      ...row,
      allowance: earnings,
      deduction: deductions,
      components,
    }
  })

  res.json(result)
})

app.get('/salary-profiles/:employeeId', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (req, res) => {
  const { employeeId } = req.params
  const data = await getSalaryProfileWithComponents(employeeId)
  if (!data) return res.status(404).json({ message: 'Profil gaji belum diset untuk karyawan ini' })
  const { profile, componentValues } = data
  const earnings = componentValues.filter((c) => c.type === 'earning').reduce((s, c) => s + Number(c.amount), 0)
  const deductions = componentValues.filter((c) => c.type === 'deduction').reduce((s, c) => s + Number(c.amount), 0)
  res.json({
    profileId: profile.id,
    employeeId: profile.employee_id,
    baseSalary: Number(profile.base_salary),
    allowance: earnings,
    deduction: deductions,
    paymentMethod: profile.payment_method,
    bankName: profile.bank_name,
    bankAccountName: profile.bank_account_name,
    bankAccountNumber: profile.bank_account_number,
    components: componentValues.map((c) => ({
      componentId: c.component_id,
      code: c.code,
      name: c.name,
      type: c.type,
      amount: Number(c.amount),
    })),
  })
})

app.post('/salary-profiles', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  const { employeeId, baseSalary, allowance, deduction, paymentMethod, bankName, bankAccountName, bankAccountNumber } = req.body

  if (!employeeId) return res.status(400).json({ message: 'employeeId wajib diisi' })
  if (baseSalary === undefined || Number.isNaN(Number(baseSalary))) {
    return res.status(400).json({ message: 'baseSalary wajib berupa angka yang valid' })
  }
  if (Number(baseSalary) < 0) return res.status(400).json({ message: 'Base salary tidak boleh minus' })

  const employee = await query('SELECT id FROM employees WHERE id = ?', [employeeId])
  if (employee.length === 0) return res.status(404).json({ message: 'Karyawan tidak ditemukan' })

  const existingProfile = await query(
    `SELECT * FROM employee_salary_profiles WHERE employee_id = ? AND is_active = 1`,
    [employeeId],
  )

  let profileId
  if (existingProfile.length > 0) {
    const before = existingProfile[0]
    await query(
      `UPDATE employee_salary_profiles
       SET base_salary=?, payment_method=?, bank_name=?, bank_account_name=?, bank_account_number=?, effective_date=CURDATE(), updated_at=NOW()
       WHERE id=?`,
      [baseSalary, paymentMethod || 'bank_transfer', bankName || null, bankAccountName || null, bankAccountNumber || null, before.id],
    )
    profileId = before.id
  } else {
    const inserted = await query(
      `INSERT INTO employee_salary_profiles(employee_id, effective_date, base_salary, payment_method, bank_name, bank_account_name, bank_account_number, is_active)
       VALUES (?, CURDATE(), ?, ?, ?, ?, ?, 1)`,
      [employeeId, baseSalary, paymentMethod || 'bank_transfer', bankName || null, bankAccountName || null, bankAccountNumber || null],
    )
    profileId = inserted.insertId
  }

  const componentRows = await query(`SELECT id, code FROM payroll_components WHERE is_active = 1`)
  const componentMap = new Map(componentRows.map((c) => [c.code, c.id]))

  const allowanceValue = Number(allowance || 0)
  const deductionValue = Number(deduction || 0)

  if (allowanceValue < 0 || deductionValue < 0) {
    return res.status(400).json({ message: 'Tunjangan dan potongan tidak boleh minus' })
  }

  const tunjCode = componentMap.get('TUNJ')
  const potCode = componentMap.get('POT')

  if (tunjCode) {
    await query(
      `INSERT INTO employee_salary_component_values(salary_profile_id, component_id, amount)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [profileId, tunjCode, allowanceValue],
    )
  }

  if (potCode) {
    await query(
      `INSERT INTO employee_salary_component_values(salary_profile_id, component_id, amount)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [profileId, potCode, deductionValue],
    )
  }

  await auditLog(null, req.user.sub, existingProfile.length > 0 ? 'UPDATE_SALARY_PROFILE' : 'CREATE_SALARY_PROFILE', existingProfile[0] || null, { employeeId, baseSalary, allowance: allowanceValue, deduction: deductionValue }, req.ip)

  const data = await getSalaryProfileWithComponents(employeeId)
  const earnings = data.componentValues.filter((c) => c.type === 'earning').reduce((s, c) => s + Number(c.amount), 0)
  const ded = data.componentValues.filter((c) => c.type === 'deduction').reduce((s, c) => s + Number(c.amount), 0)

  res.json({
    profileId: data.profile.id,
    employeeId: data.profile.employee_id,
    baseSalary: Number(data.profile.base_salary),
    allowance: earnings,
    deduction: ded,
    paymentMethod: data.profile.payment_method,
    message: 'Salary structure berhasil disimpan',
  })
})

app.put('/salary-profiles/:employeeId', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  const { employeeId } = req.params
  const { baseSalary, allowance, deduction, paymentMethod, bankName, bankAccountName, bankAccountNumber } = req.body

  const existingProfile = await query(
    `SELECT * FROM employee_salary_profiles WHERE employee_id = ? AND is_active = 1`,
    [employeeId],
  )
  if (existingProfile.length === 0) {
    return res.status(404).json({ message: 'Profil gaji untuk karyawan ini belum ada. Gunakan POST untuk membuat baru.' })
  }

  const before = existingProfile[0]

  if (baseSalary !== undefined && Number(baseSalary) < 0) {
    return res.status(400).json({ message: 'Base salary tidak boleh minus' })
  }
  if (allowance !== undefined && Number(allowance) < 0) {
    return res.status(400).json({ message: 'Tunjangan tidak boleh minus' })
  }
  if (deduction !== undefined && Number(deduction) < 0) {
    return res.status(400).json({ message: 'Potongan tidak boleh minus' })
  }

  await query(
    `UPDATE employee_salary_profiles
     SET base_salary=?, payment_method=?, bank_name=?, bank_account_name=?, bank_account_number=?, updated_at=NOW()
     WHERE id=?`,
    [baseSalary ?? before.base_salary, paymentMethod ?? before.payment_method, bankName ?? before.bank_name, bankAccountName ?? before.bank_account_name, bankAccountNumber ?? before.bank_account_number, before.id],
  )

  const profileId = before.id
  const componentRows = await query(`SELECT id, code FROM payroll_components WHERE is_active = 1`)
  const componentMap = new Map(componentRows.map((c) => [c.code, c.id]))

  if (allowance !== undefined && componentMap.get('TUNJ')) {
    await query(
      `INSERT INTO employee_salary_component_values(salary_profile_id, component_id, amount)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [profileId, componentMap.get('TUNJ'), Number(allowance)],
    )
  }

  if (deduction !== undefined && componentMap.get('POT')) {
    await query(
      `INSERT INTO employee_salary_component_values(salary_profile_id, component_id, amount)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE amount = VALUES(amount)`,
      [profileId, componentMap.get('POT'), Number(deduction)],
    )
  }

  await auditLog(null, req.user.sub, 'UPDATE_SALARY_PROFILE', before, { employeeId, baseSalary, allowance, deduction }, req.ip)

  const data = await getSalaryProfileWithComponents(employeeId)
  const earnings = data.componentValues.filter((c) => c.type === 'earning').reduce((s, c) => s + Number(c.amount), 0)
  const ded = data.componentValues.filter((c) => c.type === 'deduction').reduce((s, c) => s + Number(c.amount), 0)

  res.json({
    profileId: data.profile.id,
    employeeId: Number(employeeId),
    baseSalary: Number(data.profile.base_salary),
    allowance: earnings,
    deduction: ded,
    message: 'Salary structure berhasil diupdate',
  })
})

app.delete('/salary-profiles/:employeeId', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  const { employeeId } = req.params
  const existing = await query(
    `SELECT * FROM employee_salary_profiles WHERE employee_id = ? AND is_active = 1`,
    [employeeId],
  )
  if (existing.length === 0) return res.status(404).json({ message: 'Profil gaji tidak ditemukan' })
  await query('UPDATE employee_salary_profiles SET is_active = 0, updated_at = NOW() WHERE id = ?', [existing[0].id])
  await auditLog(null, req.user.sub, 'DEACTIVATE_SALARY_PROFILE', existing[0], null, req.ip)
  res.json({ message: 'Profil gaji berhasil dinonaktifkan' })
})

// =============================
// Payroll Run Generation (uses salary profiles from DB)
// =============================

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
    let baseSalary = 0
    let totalEarnings = 0
    let totalDeductions = 0
    const componentBreakdown = []

    const salaryData = await getSalaryProfileWithComponents(employee.id)
    if (salaryData) {
      baseSalary = Number(salaryData.profile.base_salary)
      for (const cv of salaryData.componentValues) {
        const amount = Number(cv.amount)
        if (cv.type === 'earning') {
          totalEarnings += amount
        } else {
          totalDeductions += amount
        }
        componentBreakdown.push({
          componentId: cv.component_id,
          name: cv.name,
          type: cv.type,
          amount,
        })
      }
    } else {
      baseSalary = 0
    }

    const grossAmount = baseSalary + totalEarnings
    const netAmount = grossAmount - totalDeductions

    const itemInsert = await query(
      `INSERT INTO payroll_run_items(payroll_run_id, employee_id, gross_amount, deduction_amount, net_amount, tax_amount, bpjs_amount, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [runId, employee.id, grossAmount, totalDeductions, netAmount],
    )

    await query(
      `INSERT INTO payroll_run_item_components(payroll_run_item_id, component_id, component_name_snapshot, component_type, amount, calculation_meta, created_at)
       VALUES (?, ?, 'Gaji Pokok', 'earning', ?, JSON_OBJECT('source','salary_profile'), NOW())`,
      [itemInsert.insertId, null, baseSalary],
    )

    for (const cb of componentBreakdown) {
      await query(
        `INSERT INTO payroll_run_item_components(payroll_run_item_id, component_id, component_name_snapshot, component_type, amount, calculation_meta, created_at)
         VALUES (?, ?, ?, ?, ?, JSON_OBJECT('source','salary_profile'), NOW())`,
        [itemInsert.insertId, cb.componentId, cb.name, cb.type, cb.amount],
      )
    }
  }

  await recalculatePayrollRun(runId)
  await auditLog(runId, req.user.sub, 'GENERATE_PAYROLL_RUN', null, { periodMonth }, req.ip)

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

// =============================
// Payroll Validation
// =============================

async function validatePayrollRun(runId) {
  const errors = []

  const runRows = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  if (runRows.length === 0) {
    return { valid: false, errors: ['Run tidak ditemukan'] }
  }

  if (runRows[0].status === 'finalized' || runRows[0].status === 'published') {
    return { valid: false, errors: ['Run sudah difinalisasi'] }
  }

  const items = await query(
    `SELECT pri.*, e.name AS employee_name, e.id AS employee_id
     FROM payroll_run_items pri
     JOIN employees e ON e.id = pri.employee_id
     WHERE pri.payroll_run_id = ?`,
    [runId],
  )

  if (items.length === 0) {
    errors.push('Tidak ada item payroll dalam run ini')
  }

  for (const item of items) {
    if (Number(item.net_amount) < 0) {
      errors.push(`Net minus untuk ${item.employee_name}: ${item.net_amount}`)
    }

    const profile = await query(
      `SELECT * FROM employee_salary_profiles WHERE employee_id = ? AND is_active = 1`,
      [item.employee_id],
    )
    if (profile.length === 0) {
      errors.push(`Profil gaji belum diset untuk ${item.employee_name}`)
    } else if (profile[0].payment_method === 'bank_transfer' && (!profile[0].bank_account_number || !profile[0].bank_name)) {
      errors.push(`Data bank kosong untuk ${item.employee_name} (metode: bank_transfer)`)
    }

    if (Number(item.gross_amount) === 0) {
      errors.push(`Gross = 0 untuk ${item.employee_name}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// =============================
// Payroll Approval Workflow
// =============================

app.post('/payroll/runs/:runId/review', authRequired, roleRequired('HRD', 'Super Admin'), async (req, res) => {
  const { runId } = req.params
  const runRows = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  if (runRows.length === 0) return res.status(404).json({ message: 'Run tidak ditemukan' })

  const run = runRows[0]
  if (run.status !== 'draft') {
    return res.status(400).json({ message: `Run dengan status "${run.status}" tidak bisa di-review. Harus status "draft".` })
  }

  const validation = await validatePayrollRun(Number(runId))
  if (!validation.valid) {
    return res.status(400).json({ message: 'Validasi gagal', errors: validation.errors })
  }

  const before = { ...run }
  await query("UPDATE payroll_runs SET status='reviewed', updated_at=NOW() WHERE id=?", [runId])

  await query(
    `INSERT INTO payroll_approvals(payroll_run_id, approval_level, approver_user_id, status, comment, approved_at)
     VALUES (?, 1, ?, 'approved', 'Submitted for review', NOW())`,
    [runId, req.user.sub],
  )

  await auditLog(Number(runId), req.user.sub, 'REVIEW_PAYROLL_RUN', before, { status: 'reviewed' }, req.ip)

  const updated = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  res.json(updated[0])
})

app.post('/payroll/runs/:runId/approve', authRequired, roleRequired('Finance', 'Super Admin'), async (req, res) => {
  const { runId } = req.params
  const { comment } = req.body
  const runRows = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  if (runRows.length === 0) return res.status(404).json({ message: 'Run tidak ditemukan' })

  const run = runRows[0]
  if (run.status !== 'reviewed') {
    return res.status(400).json({ message: `Run dengan status "${run.status}" tidak bisa di-approve. Harus status "reviewed".` })
  }

  const before = { ...run }
  await query("UPDATE payroll_runs SET status='approved', updated_at=NOW() WHERE id=?", [runId])

  await query(
    `INSERT INTO payroll_approvals(payroll_run_id, approval_level, approver_user_id, status, comment, approved_at)
     VALUES (?, 2, ?, 'approved', ?, NOW())`,
    [runId, req.user.sub, comment || 'Approved'],
  )

  await auditLog(Number(runId), req.user.sub, 'APPROVE_PAYROLL_RUN', before, { status: 'approved' }, req.ip)

  const updated = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  res.json(updated[0])
})

app.post('/payroll/runs/:runId/reject', authRequired, roleRequired('Finance', 'HRD', 'Super Admin'), async (req, res) => {
  const { runId } = req.params
  const { comment } = req.body
  const runRows = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  if (runRows.length === 0) return res.status(404).json({ message: 'Run tidak ditemukan' })

  const run = runRows[0]
  if (!['draft', 'reviewed'].includes(run.status)) {
    return res.status(400).json({ message: `Run dengan status "${run.status}" tidak bisa direject.` })
  }

  const before = { ...run }
  await query("UPDATE payroll_runs SET status='draft', updated_at=NOW() WHERE id=?", [runId])

  await query(
    `INSERT INTO payroll_approvals(payroll_run_id, approval_level, approver_user_id, status, comment)
     VALUES (?, 0, ?, 'rejected', ?)`,
    [runId, req.user.sub, comment || 'Rejected'],
  )

  await auditLog(Number(runId), req.user.sub, 'REJECT_PAYROLL_RUN', before, { status: 'draft' }, req.ip)

  const updated = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  res.json(updated[0])
})

app.post('/payroll/runs/:runId/finalize', authRequired, roleRequired('Finance', 'Super Admin'), async (req, res) => {
  const { runId } = req.params
  const runRows = await query('SELECT * FROM payroll_runs WHERE id = ?', [runId])
  const run = runRows[0]
  if (!run) return res.status(404).json({ message: 'Run tidak ditemukan' })

  if (!['approved'].includes(run.status)) {
    return res.status(400).json({
      message: `Run harus berstatus "approved" sebelum difinalisasi. Status saat ini: "${run.status}".` +
        (run.status === 'draft' ? ' Submit ke review terlebih dahulu.' : '') +
        (run.status === 'reviewed' ? ' Perlu approval Finance.' : ''),
    })
  }

  const validation = await validatePayrollRun(Number(runId))
  if (!validation.valid) {
    return res.status(400).json({ message: 'Validasi gagal, tidak bisa finalize', errors: validation.errors })
  }

  const before = { ...run }
  await query(
    `UPDATE payroll_runs
     SET status='finalized', finalized_by=?, finalized_at=NOW(), updated_at=NOW()
     WHERE id=?`,
    [req.user.sub, runId],
  )

  await query(
    `INSERT INTO payroll_approvals(payroll_run_id, approval_level, approver_user_id, status, comment, approved_at)
     VALUES (?, 3, ?, 'approved', 'Finalized', NOW())`,
    [runId, req.user.sub],
  )

  await auditLog(Number(runId), req.user.sub, 'FINALIZE_PAYROLL_RUN', before, { status: 'finalized' }, req.ip)

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
    let baseSalary = 0
    let totalEarnings = 0
    let totalDeductions = 0

    const salaryData = await getSalaryProfileWithComponents(employee.id)
    if (salaryData) {
      baseSalary = Number(salaryData.profile.base_salary)
      for (const cv of salaryData.componentValues) {
        if (cv.type === 'earning') totalEarnings += Number(cv.amount)
        else totalDeductions += Number(cv.amount)
      }
    }

    const total = baseSalary + totalEarnings - totalDeductions
    await query(
      `INSERT INTO payroll(employee_id, salary, allowance, deduction, total, period_month)
       VALUES(?, ?, ?, ?, ?, ?)`,
      [employee.id, baseSalary, totalEarnings, totalDeductions, total, periodMonth],
    )
    await query(
      `INSERT INTO payroll_run_items(payroll_run_id, employee_id, gross_amount, deduction_amount, net_amount, tax_amount, bpjs_amount, created_at, updated_at)
       VALUES(?, ?, ?, ?, ?, 0, 0, NOW(), NOW())`,
      [runId, employee.id, baseSalary + totalEarnings, totalDeductions, total],
    )
    count += 1
  }

  await recalculatePayrollRun(runId)
  await query("UPDATE payroll_runs SET finalized_by=?, finalized_at=NOW() WHERE id=?", [req.user.sub, runId])
  await auditLog(runId, req.user.sub, 'QUICK_PAYROLL_RUN', null, { periodMonth, count }, req.ip)
  res.json({ message: 'Payroll selesai', count, runId })
})

app.get('/payroll/runs/:runId/validate', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (req, res) => {
  const runId = Number(req.params.runId)
  const validation = await validatePayrollRun(runId)
  res.json(validation)
})

// =============================
// Audit Logs
// =============================

app.get('/payroll/audit-logs', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (req, res) => {
  const runId = req.query.runId
  const logs = runId
    ? await query('SELECT * FROM payroll_audit_logs WHERE payroll_run_id = ? ORDER BY created_at DESC', [runId])
    : await query('SELECT * FROM payroll_audit_logs ORDER BY created_at DESC LIMIT 100')
  res.json(logs)
})

app.get('/payroll/approvals/:runId', authRequired, roleRequired('HRD', 'Finance', 'Super Admin'), async (req, res) => {
  const { runId } = req.params
  const approvals = await query(
    'SELECT * FROM payroll_approvals WHERE payroll_run_id = ? ORDER BY approval_level',
    [runId],
  )
  res.json(approvals)
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
  const [employees, pendingLeave, attendanceToday, payrollTotal, payrollCostBreakdown, attendanceTrend] = await Promise.all([
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
    query(
      `SELECT 
        d.name AS department,
        COUNT(e.id) AS employee_count,
        COALESCE(SUM(esp.total_gross), 0) AS total_gross
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN employee_salary_profiles esp ON esp.employee_id = e.id AND esp.is_active = 1
      WHERE e.is_active = 1
      GROUP BY d.id, d.name
      ORDER BY total_gross DESC`
    ),
    query(
      `SELECT 
        DATE(DATE_SUB(CURDATE(), INTERVAL DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL day_offset DAY), '%w') DAY)) AS week_start,
        ROUND((SELECT COUNT(*) FROM attendance WHERE DATE(clock_in) = DATE_SUB(CURDATE(), INTERVAL day_offset DAY)) / NULLIF((SELECT COUNT(*) FROM employees WHERE is_active = 1), 0) * 100, 1) AS attendance_rate
      FROM (SELECT 0 AS day_offset UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) d
      ORDER BY week_start`
    ),
  ])

  res.json({
    totalEmployees: Number(employees[0].total),
    attendanceRate: Number(attendanceToday[0].percentage),
    pendingLeave: Number(pendingLeave[0].total),
    payrollTotal: Number(payrollTotal[0].total),
    payrollCostBreakdown: payrollCostBreakdown || [],
    attendanceTrend: attendanceTrend || [],
  })
})

app.get('/reports/salary-distribution', authRequired, async (_, res) => {
  const [byDepartment, byPosition, byRole] = await Promise.all([
    query(
      `SELECT 
        d.name AS label,
        COUNT(e.id) AS count,
        COALESCE(ROUND(SUM(esp.total_gross), 0), 0) AS total_salary,
        COALESCE(ROUND(AVG(esp.total_gross), 0), 0) AS avg_salary
      FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      LEFT JOIN employee_salary_profiles esp ON esp.employee_id = e.id AND esp.is_active = 1
      WHERE e.is_active = 1
      GROUP BY d.id, d.name
      ORDER BY total_salary DESC`
    ),
    query(
      `SELECT 
        p.name AS label,
        COUNT(e.id) AS count,
        COALESCE(ROUND(SUM(esp.total_gross), 0), 0) AS total_salary,
        COALESCE(ROUND(AVG(esp.total_gross), 0), 0) AS avg_salary
      FROM employees e
      LEFT JOIN positions p ON p.id = e.position_id
      LEFT JOIN employee_salary_profiles esp ON esp.employee_id = e.id AND esp.is_active = 1
      WHERE e.is_active = 1
      GROUP BY p.id, p.name
      ORDER BY total_salary DESC`
    ),
    query(
      `SELECT 
        r.name AS label,
        COUNT(u.id) AS count,
        COALESCE(ROUND(SUM(esp.total_gross), 0), 0) AS total_salary,
        COALESCE(ROUND(AVG(esp.total_gross), 0), 0) AS avg_salary
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN employee_salary_profiles esp ON esp.employee_id = u.id AND esp.is_active = 1
      WHERE u.is_active = 1
      GROUP BY r.id, r.name
      ORDER BY total_salary DESC`
    ),
  ])

  res.json({
    byDepartment: byDepartment || [],
    byPosition: byPosition || [],
    byRole: byRole || [],
  })
})

app.get('/reports/leave-stats', authRequired, async (_, res) => {
  const [byType, byStatus, monthlySummary] = await Promise.all([
    query(
      `SELECT 
        leave_type AS label,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending
      FROM leave_request
      GROUP BY leave_type
      ORDER BY total DESC`
    ),
    query(
      `SELECT 
        status,
        COUNT(*) AS total,
        leave_type
      FROM leave_request
      GROUP BY status, leave_type
      ORDER BY status, leave_type`
    ),
    query(
      `SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) AS approved
      FROM leave_request
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month`
    ),
  ])

  res.json({
    byType: byType || [],
    byStatus: byStatus || [],
    monthlySummary: monthlySummary || [],
  })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ message: 'Referensi data tidak ditemukan di database' })
  }
  if (err.code === 'ER_BAD_NULL_ERROR') {
    return res.status(400).json({ message: 'Data wajib tidak boleh kosong' })
  }
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Token tidak valid atau telah kadaluarsa. Silakan login kembali.' })
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR') {
    return res.status(503).json({ message: 'Database tidak tersedia. Hubungi administrator.' })
  }
  res.status(500).json({ message: 'Terjadi kesalahan server. Coba lagi nanti.' })
})

const port = process.env.PORT || 5000
app.listen(port, () => {
  console.log(`HRIS API running on http://localhost:${port}`)
})