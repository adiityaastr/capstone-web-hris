import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config({ path: 'backend/.env' })

const host = process.env.DB_HOST || 'localhost'
const port = Number(process.env.DB_PORT || 3306)
const user = process.env.DB_USER || 'root'
const password = process.env.DB_PASSWORD || ''
const database = process.env.DB_NAME || 'hris_db'

async function run() {
  const conn = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true })

  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\``)

  const fs = await import('node:fs/promises')
  const path = await import('node:path')

  const schemaSql = await fs.readFile(path.resolve(process.cwd(), 'backend/schema.sql'), 'utf8')
  const payrollSchemaSql = await fs.readFile(path.resolve(process.cwd(), 'backend/payroll-schema.sql'), 'utf8')

  await conn.query(schemaSql)
  await conn.query(payrollSchemaSql)

  // Clear existing data (reverse order of foreign keys)
  await conn.query('SET FOREIGN_KEY_CHECKS = 0')
  const tables = [
    'payroll_audit_logs', 'payroll_approvals', 'payroll_run_item_components',
    'payroll_run_items', 'payroll_runs', 'payroll_variable_inputs',
    'employee_salary_component_values', 'employee_salary_profiles',
    'payroll_components', 'payslip', 'payroll',
    'attendance', 'leave_request', 'users',
    'employees', 'positions', 'departments', 'roles',
  ]
  for (const t of tables) {
    try { await conn.query(`DELETE FROM \`${t}\``) } catch { /* table may not exist */ }
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1')

  // Seed roles
  const roles = ['Super Admin', 'HRD', 'Finance', 'Manager', 'Employee']
  for (const name of roles) {
    await conn.execute('INSERT INTO roles(name) VALUES (?)', [name])
  }

  // Seed departments
  const departments = ['Engineering', 'HRD', 'Finance', 'Marketing', 'Operations', 'Product', 'Legal']
  for (const name of departments) {
    await conn.execute('INSERT INTO departments(name) VALUES (?)', [name])
  }

  // Seed positions
  const positions = ['Software Engineer', 'Senior Software Engineer', 'Engineering Manager', 'HR Specialist', 'HR Manager', 'Payroll Analyst', 'Finance Manager', 'Marketing Lead', 'Digital Marketing Specialist', 'Operations Manager', 'Data Analyst', 'Product Manager', 'Legal Counsel', 'UI/UX Designer', 'DevOps Engineer']
  for (const name of positions) {
    await conn.execute('INSERT INTO positions(name) VALUES (?)', [name])
  }

  // Helper to get IDs
  const getDeptId = async (name) => { const [rows] = await conn.execute('SELECT id FROM departments WHERE name=?', [name]); return rows[0]?.id }
  const getPosId = async (name) => { const [rows] = await conn.execute('SELECT id FROM positions WHERE name=?', [name]); return rows[0]?.id }

  // Seed employees
  const employees = [
    ['Aditia Pratama',   await getDeptId('Engineering'), await getPosId('Senior Software Engineer'),     '2028-06-30'],
    ['Nadia Putri',      await getDeptId('HRD'),         await getPosId('HR Specialist'),                '2027-12-31'],
    ['Rizky Maulana',    await getDeptId('Finance'),     await getPosId('Payroll Analyst'),              '2027-11-30'],
    ['Salsa Wijaya',     await getDeptId('Marketing'),   await getPosId('Marketing Lead'),                '2026-12-31'],
    ['Budi Santoso',     await getDeptId('Operations'),   await getPosId('Operations Manager'),            '2028-03-15'],
    ['Intan Lestari',     await getDeptId('Engineering'), await getPosId('Software Engineer'),            '2027-09-30'],
    ['Dini Prameswari',  await getDeptId('HRD'),         await getPosId('HR Manager'),                    '2028-01-31'],
    ['Fajar Hidayat',    await getDeptId('Engineering'), await getPosId('UI/UX Designer'),               '2027-08-20'],
    ['Maya Sari',         await getDeptId('Finance'),     await getPosId('Finance Manager'),               '2028-04-30'],
    ['Arif Rahman',       await getDeptId('Product'),      await getPosId('Product Manager'),               '2027-10-31'],
    ['Putri Ayu',         await getDeptId('Marketing'),    await getPosId('Digital Marketing Specialist'),  '2027-07-15'],
    ['Hendra Wijaya',    await getDeptId('Operations'),    await getPosId('Software Engineer'),             '2028-02-28'],
    ['Ratna Dewi',        await getDeptId('Legal'),         await getPosId('Legal Counsel'),                 '2027-06-30'],
    ['Dimas Prasetyo',   await getDeptId('Engineering'), await getPosId('Senior Software Engineer'),     '2028-05-31'],
    ['Lina Marlina',      await getDeptId('Finance'),      await getPosId('Payroll Analyst'),                '2027-12-31'],
  ]
  for (const [name, deptId, posId, contractEnd] of employees) {
    await conn.execute('INSERT INTO employees(name, department_id, position_id, contract_end) VALUES (?,?,?,?)', [name, deptId, posId, contractEnd])
  }

  // Get employee IDs by name
  const getEmpId = async (name) => { const [rows] = await conn.execute('SELECT id FROM employees WHERE name=?', [name]); return rows[0]?.id }

  // Seed payroll components
  const components = [
    ['GAPOK', 'Gaji Pokok', 'earning', 1],
    ['TUNJ', 'Tunjangan Tetap', 'earning', 1],
    ['TJ_TRANSPORT', 'Tunjangan Transport', 'earning', 0],
    ['TJ_MAKAN', 'Tunjangan Makan', 'earning', 0],
    ['POT', 'Potongan Absensi', 'deduction', 1],
    ['BPJS_TK', 'BPJS Ketenagakerjaan', 'deduction', 1],
    ['BPJS_KES', 'BPJS Kesehatan', 'deduction', 1],
    ['PPH21', 'PPh 21', 'deduction', 1],
  ]
  for (const [code, name, type, taxable] of components) {
    await conn.execute('INSERT INTO payroll_components(code, name, type, taxable) VALUES (?,?,?,?)', [code, name, type, taxable])
  }

  const getRoleId = async (name) => { const [rows] = await conn.execute('SELECT id FROM roles WHERE name=?', [name]); return rows[0]?.id }
  const getCompId = async (code) => { const [rows] = await conn.execute('SELECT id FROM payroll_components WHERE code=?', [code]); return rows[0]?.id }

  // Seed users
  const hash = '$2b$10$2Y8uPaG8pBSGyd7fwqcLbOY67TEKq/qjvlUr9XwJG0DP4I92G1.rW'
  for (const [nik, roleName] of [['ADM001','Super Admin'],['HRD001','HRD'],['FIN001','Finance'],['MGR001','Manager'],['EMP001','Employee']]) {
    await conn.execute('INSERT INTO users(nik, password, role_id) VALUES (?,?,?)', [nik, hash, await getRoleId(roleName)])
  }

  // Seed salary profiles
  const salaryProfiles = [
    ['Aditia Pratama',   12000000, 'bank_transfer', 'BCA',     'Aditia Pratama',    '0123456789'],
    ['Nadia Putri',      9500000,  'bank_transfer', 'Mandiri', 'Nadia Putri',       '1122334455'],
    ['Rizky Maulana',   10000000,  'bank_transfer', 'BNI',     'Rizky Maulana',     '2233445566'],
    ['Salsa Wijaya',    8500000,   'bank_transfer', 'BCA',     'Salsa Wijaya',      '3344556677'],
    ['Budi Santoso',   11000000,   'bank_transfer', 'BRI',     'Budi Santoso',      '4455667788'],
    ['Intan Lestari',    8000000,   'bank_transfer', 'Mandiri', 'Intan Lestari',     '5566778899'],
    ['Dini Prameswari',13000000,   'bank_transfer', 'BCA',     'Dini Prameswari',   '6677889900'],
    ['Fajar Hidayat',   7500000,   'bank_transfer', 'BNI',     'Fajar Hidayat',     '7788990011'],
    ['Maya Sari',       11500000,   'bank_transfer', 'Mandiri', 'Maya Sari',         '8899001122'],
    ['Arif Rahman',    10500000,   'bank_transfer', 'BCA',     'Arif Rahman',       '9900112233'],
    ['Putri Ayu',        7000000,   'bank_transfer', 'BRI',     'Putri Ayu',         '0011223344'],
    ['Hendra Wijaya',    8200000,   'cash',          null,      null,                null],
    ['Ratna Dewi',      14000000,   'bank_transfer', 'BCA',     'Ratna Dewi',        '2233445567'],
    ['Dimas Prasetyo',  9800000,    'bank_transfer', 'Mandiri', 'Dimas Prasetyo',    '3344556678'],
    ['Lina Marlina',     8700000,   'bank_transfer', 'BNI',     'Lina Marlina',      '4455667789'],
  ]
  const profileIds = {}
  for (const [name, salary, method, bank, acctName, acctNo] of salaryProfiles) {
    const empId = await getEmpId(name)
    const [result] = await conn.execute(
      'INSERT INTO employee_salary_profiles(employee_id, effective_date, base_salary, payment_method, bank_name, bank_account_name, bank_account_number, is_active) VALUES (?,?,?, ?,?,?,?,?)',
      [empId, '2025-01-01', salary, method, bank, acctName, acctNo, 1]
    )
    profileIds[name] = result.insertId
  }

  // Seed salary component values
  const compValues = {
    'TUNJ':        [2000000,1500000,1800000,1200000,1900000,1000000,2200000,900000,1700000,1600000,800000,1100000,2500000,1400000,1300000],
    'TJ_TRANSPORT': [500000,400000,450000,350000,500000,350000,600000,350000,500000,450000,300000,350000,600000,400000,350000],
    'TJ_MAKAN':     [750000,750000,750000,750000,750000,750000,750000,750000,750000,750000,750000,750000,750000,750000,750000],
    'POT':          [200000,100000,150000,50000,0,250000,0,300000,0,100000,150000,200000,0,100000,50000],
    'BPJS_TK':      [240000,190000,200000,170000,220000,160000,260000,150000,230000,210000,140000,164000,280000,196000,174000],
    'BPJS_KES':     [150000,120000,130000,110000,140000,100000,160000,95000,145000,135000,90000,102500,175000,122500,108750],
    'PPH21':        [950000,580000,710000,420000,820000,350000,1120000,280000,880000,720000,200000,405000,1300000,630000,460000],
  }
  const empNames = salaryProfiles.map(s => s[0])
  for (const [code, amounts] of Object.entries(compValues)) {
    const compId = await getCompId(code)
    for (let i = 0; i < empNames.length; i++) {
      const profileId = profileIds[empNames[i]]
      if (profileId && amounts[i] > 0) {
        await conn.execute(
          'INSERT INTO employee_salary_component_values(salary_profile_id, component_id, amount) VALUES (?,?,?) ON DUPLICATE KEY UPDATE amount=VALUES(amount)',
          [profileId, compId, amounts[i]]
        )
      }
    }
  }

  // Seed attendance
  const attendanceData = [
    ['Aditia Pratama',  '2026-04-26 07:55:00', '2026-04-26 17:05:00', 'Aktif'],
    ['Nadia Putri',     '2026-04-26 08:10:00', '2026-04-26 17:20:00', 'Aktif'],
    ['Rizky Maulana',   '2026-04-26 08:22:00', '2026-04-26 17:15:00', 'Aktif'],
    ['Salsa Wijaya',    '2026-04-26 09:01:00', '2026-04-26 17:30:00', 'Terlambat'],
    ['Budi Santoso',    '2026-04-26 07:50:00', '2026-04-26 17:00:00', 'Aktif'],
    ['Intan Lestari',    '2026-04-26 08:05:00', null,                    'Aktif'],
    ['Dini Prameswari','2026-04-26 08:00:00', '2026-04-26 17:10:00', 'Aktif'],
    ['Fajar Hidayat',  '2026-04-26 08:35:00', '2026-04-26 17:45:00', 'Terlambat'],
    ['Maya Sari',       '2026-04-26 07:45:00', '2026-04-26 17:00:00', 'Aktif'],
    ['Arif Rahman',     '2026-04-26 08:00:00', '2026-04-26 17:05:00', 'Aktif'],
    ['Putri Ayu',       '2026-04-26 09:15:00', '2026-04-26 17:45:00', 'Terlambat'],
    ['Hendra Wijaya',  '2026-04-26 08:15:00', '2026-04-26 17:10:00', 'Aktif'],
    ['Ratna Dewi',      '2026-04-26 07:30:00', '2026-04-26 17:00:00', 'Aktif'],
    ['Dimas Prasetyo', '2026-04-26 08:20:00', '2026-04-26 17:25:00', 'Aktif'],
    ['Lina Marlina',    '2026-04-26 08:00:00', null,                    'Aktif'],
  ]
  for (const [name, clockIn, clockOut, status] of attendanceData) {
    const empId = await getEmpId(name)
    await conn.execute('INSERT INTO attendance(employee_id, clock_in, clock_out, status) VALUES (?,?,?,?)', [empId, clockIn, clockOut, status])
  }

  // Seed leave requests
  const leaveData = [
    ['Aditia Pratama',  'Cuti Tahunan', '2026-05-10', '2026-05-12', 'Liburan keluarga ke Bali', 'Pending'],
    ['Salsa Wijaya',    'Izin Sakit',    '2026-04-28', '2026-04-28', 'Demam tinggi', 'Pending'],
    ['Intan Lestari',   'Cuti Tahunan',  '2026-05-05', '2026-05-07', 'Acara keluarga', 'Approved'],
    ['Fajar Hidayat',  'Izin',          '2026-04-30', '2026-04-30', 'Urusan perbankan', 'Pending'],
    ['Putri Ayu',       'Cuti Tahunan',  '2026-05-15', '2026-05-16', 'Pernikahan saudara', 'Approved'],
    ['Dimas Prasetyo', 'Izin Sakit',    '2026-04-25', '2026-04-25', 'Sakit kepala', 'Rejected'],
    ['Rizky Maulana',  'Cuti Tahunan',  '2026-06-01', '2026-06-03', 'Honeymoon', 'Pending'],
    ['Maya Sari',       'Izin',          '2026-05-02', '2026-05-02', 'Pindah rumah', 'Approved'],
    ['Hendra Wijaya',  'Izin Sakit',    '2026-04-27', '2026-04-28', 'Flu berat', 'Pending'],
    ['Lina Marlina',    'Cuti Tahunan',  '2026-05-20', '2026-05-22', 'Liburan akhir bulan', 'Pending'],
  ]
  for (const [name, type, start, end, reason, status] of leaveData) {
    const empId = await getEmpId(name)
    await conn.execute('INSERT INTO leave_request(employee_id, leave_type, start_date, end_date, reason, status) VALUES (?,?,?,?,?,?)', [empId, type, start, end, reason, status])
  }

  // Seed payroll runs
  const hrdRoleId = await getRoleId('HRD')
  const finRoleId = await getRoleId('Finance')
  const hrdUserRes = hrdRoleId ? await conn.execute("SELECT id FROM users WHERE role_id=?", [hrdRoleId]) : [[], []]
  const finUserRes = finRoleId ? await conn.execute("SELECT id FROM users WHERE role_id=?", [finRoleId]) : [[], []]
  const hrdUserId = hrdUserRes[0][0]?.id || 1
  const finUserId = finUserRes[0][0]?.id || 1

  // Run 1: March finalized
  const [run1Result] = await conn.execute('INSERT INTO payroll_runs(period_month, status, employee_count, total_gross, total_deduction, total_net, created_by, approved_by, finalized_by, finalized_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    ['2026-03-01', 'finalized', 15, 167500000, 25890000, 141610000, hrdUserId, finUserId, finUserId, '2026-04-01 10:30:00'])
  const run1Id = run1Result.insertId

  // Run 2: April approved
  const [run2Result] = await conn.execute('INSERT INTO payroll_runs(period_month, status, employee_count, total_gross, total_deduction, total_net, created_by, approved_by) VALUES (?,?,?,?,?,?,?,?)',
    ['2026-04-01', 'approved', 15, 169250000, 26145000, 143105000, hrdUserId, finUserId])
  const run2Id = run2Result.insertId

  // Run 1 items (March)
  const run1Items = [
    ['Aditia Pratama',15250000,1540000,13710000,950000,390000], ['Nadia Putri',11750000,990000,10760000,580000,310000],
    ['Rizky Maulana',13000000,1080000,11920000,710000,330000], ['Salsa Wijaya',10800000,630000,10170000,420000,280000],
    ['Budi Santoso',14150000,360000,13790000,820000,360000], ['Intan Lestari',10100000,710000,9390000,350000,260000],
    ['Dini Prameswari',16850000,1380000,15470000,1120000,420000], ['Fajar Hidayat',9500000,725000,8775000,280000,245000],
    ['Maya Sari',14650000,375000,14275000,880000,375000], ['Arif Rahman',12800000,1035000,11765000,720000,345000],
    ['Putri Ayu',8850000,440000,8410000,200000,230000], ['Hendra Wijaya',10050000,866500,9183500,405000,266500],
    ['Ratna Dewi',17850000,1475000,16375000,1300000,455000], ['Dimas Prasetyo',12200000,818500,11381500,630000,318500],
    ['Lina Marlina',10750000,628750,10121250,460000,282750],
  ]
  const run1ItemIds = []
  for (const [name, gross, ded, net, tax, bpjs] of run1Items) {
    const empId = await getEmpId(name)
    const [res] = await conn.execute('INSERT INTO payroll_run_items(payroll_run_id, employee_id, gross_amount, deduction_amount, net_amount, tax_amount, bpjs_amount) VALUES (?,?,?,?,?,?,?)',
      [run1Id, empId, gross, ded, net, tax, bpjs])
    run1ItemIds.push(res.insertId)
  }

  // Run 2 items (April)
  const run2ItemIds = []
  for (const [name, gross, ded, net, tax, bpjs] of run1Items) {
    const empId = await getEmpId(name)
    const [res] = await conn.execute('INSERT INTO payroll_run_items(payroll_run_id, employee_id, gross_amount, deduction_amount, net_amount, tax_amount, bpjs_amount) VALUES (?,?,?,?,?,?,?)',
      [run2Id, empId, gross, ded, net, tax, bpjs])
    run2ItemIds.push(res.insertId)
  }

  // Seed component snapshots for first 2 items of run 1
  const gapokId = await getCompId('GAPOK')
  const tunjId = await getCompId('TUNJ')
  const transportId = await getCompId('TJ_TRANSPORT')
  const makanId = await getCompId('TJ_MAKAN')
  const potId = await getCompId('POT')
  for (let idx = 0; idx < 2 && idx < run1ItemIds.length; idx++) {
    const itemId = run1ItemIds[idx]
    const baseSal = idx === 0 ? 12000000 : 9500000
    const tunj = idx === 0 ? 2000000 : 1500000
    const transport = idx === 0 ? 500000 : 400000
    const makan = 750000
    const bpjsTk = idx === 0 ? 240000 : 190000
    const bpjsKes = idx === 0 ? 150000 : 120000
    const pph = idx === 0 ? 950000 : 580000
    for (const [cid, snap, type, amt] of [[gapokId,'Gaji Pokok','earning',baseSal],[tunjId,'Tunjangan Tetap','earning',tunj],[transportId,'Tunjangan Transport','earning',transport],[makanId,'Tunjangan Makan','earning',makan],[potId,'Potongan Absensi','deduction',0],[null,'BPJS Ketenagakerjaan','deduction',bpjsTk],[null,'BPJS Kesehatan','deduction',bpjsKes],[null,'PPh 21','deduction',pph]]) {
      await conn.execute('INSERT INTO payroll_run_item_components(payroll_run_item_id, component_id, component_name_snapshot, component_type, amount) VALUES (?,?,?,?,?)',
        [itemId, cid, snap, type, amt])
    }
  }

  // Payroll approvals
  await conn.execute('INSERT INTO payroll_approvals(payroll_run_id, approval_level, approver_user_id, status, comment, approved_at) VALUES (?,1,?,?,"Draft direview HRD","2026-04-01 09:00:00")', [run1Id, hrdUserId, 'approved'])
  await conn.execute('INSERT INTO payroll_approvals(payroll_run_id, approval_level, approver_user_id, status, comment, approved_at) VALUES (?,2,?,?,"Disetujui Finance","2026-04-01 09:30:00")', [run1Id, finUserId, 'approved'])
  await conn.execute('INSERT INTO payroll_approvals(payroll_run_id, approval_level, approver_user_id, status, comment, approved_at) VALUES (?,3,?,?,"Finalized","2026-04-01 10:30:00")', [run1Id, finUserId, 'approved'])
  await conn.execute('INSERT INTO payroll_approvals(payroll_run_id, approval_level, approver_user_id, status, comment, approved_at) VALUES (?,1,?,?,"Draft direview April","2026-04-25 14:00:00")', [run2Id, hrdUserId, 'approved'])
  await conn.execute('INSERT INTO payroll_approvals(payroll_run_id, approval_level, approver_user_id, status, comment, approved_at) VALUES (?,2,?,?,"Disetujui Finance April","2026-04-26 09:00:00")', [run2Id, finUserId, 'approved'])

  // Audit logs
  await conn.execute('INSERT INTO payroll_audit_logs(payroll_run_id, actor_user_id, action, ip_address) VALUES (?,?,"GENERATE_PAYROLL_RUN","127.0.0.1")', [run1Id, hrdUserId])
  await conn.execute('INSERT INTO payroll_audit_logs(payroll_run_id, actor_user_id, action, ip_address) VALUES (?,?,"REVIEW_PAYROLL_RUN","127.0.0.1")', [run1Id, hrdUserId])
  await conn.execute('INSERT INTO payroll_audit_logs(payroll_run_id, actor_user_id, action, ip_address) VALUES (?,?,"APPROVE_PAYROLL_RUN","127.0.0.1")', [run1Id, finUserId])
  await conn.execute('INSERT INTO payroll_audit_logs(payroll_run_id, actor_user_id, action, ip_address) VALUES (?,?,"FINALIZE_PAYROLL_RUN","127.0.0.1")', [run1Id, finUserId])
  await conn.execute('INSERT INTO payroll_audit_logs(payroll_run_id, actor_user_id, action, ip_address) VALUES (?,?,"GENERATE_PAYROLL_RUN","127.0.0.1")', [run2Id, hrdUserId])
  await conn.execute('INSERT INTO payroll_audit_logs(payroll_run_id, actor_user_id, action, ip_address) VALUES (?,?,"REVIEW_PAYROLL_RUN","127.0.0.1")', [run2Id, hrdUserId])
  await conn.execute('INSERT INTO payroll_audit_logs(payroll_run_id, actor_user_id, action, ip_address) VALUES (?,?,"APPROVE_PAYROLL_RUN","127.0.0.1")', [run2Id, finUserId])

  // Old payroll table (for dashboard compatibility)
  const payrollData = [
    ['Aditia Pratama',12000000,3250000,1540000],['Nadia Putri',9500000,2250000,990000],
    ['Rizky Maulana',10000000,3000000,1080000],['Salsa Wijaya',8500000,2300000,630000],
    ['Budi Santoso',11000000,3150000,360000],['Intan Lestari',8000000,2100000,710000],
    ['Dini Prameswari',13000000,3550000,1380000],['Fajar Hidayat',7500000,2000000,725000],
    ['Maya Sari',11500000,2950000,375000],['Arif Rahman',10500000,2800000,1035000],
    ['Putri Ayu',7000000,1850000,440000],['Hendra Wijaya',8200000,1850000,866500],
    ['Ratna Dewi',14000000,3850000,1475000],['Dimas Prasetyo',9800000,2250000,818500],
    ['Lina Marlina',8700000,2400000,628750],
  ]
  for (const [name, salary, allowance, deduction] of payrollData) {
    const empId = await getEmpId(name)
    const total = salary + allowance - deduction
    await conn.execute('INSERT INTO payroll(employee_id, salary, allowance, deduction, total, period_month) VALUES (?,?,?,?,?,?)',
      [empId, salary, allowance, deduction, total, '2026-04-01'])
  }

  await conn.end()
  console.log(`Database ${database} siap digunakan di ${host}:${port}`)
}

run().catch((error) => {
  console.error('Setup database gagal:', error)
  process.exit(1)
})