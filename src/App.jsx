import { useEffect, useMemo, useState } from 'react'
import { PieChart, Pie, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import './App.css'

const menus = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'karyawan', label: 'Karyawan' },
  { key: 'absensi', label: 'Absensi' },
  { key: 'cuti', label: 'Cuti & Izin' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'laporan', label: 'Laporan' },
  { key: 'role', label: 'Role Management' },
]

const API = '/api'

async function api(path, opts = {}) {
  const token = localStorage.getItem('hris_token')
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API}${path}`, { ...opts, headers, signal: opts.signal })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.message || data.errors?.join('; ') || `Error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.errors = data.errors
    throw err
  }
  return data
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('hris_token') || '')
  const [role, setRole] = useState(localStorage.getItem('hris_role') || '')
  const [activePage, setActivePage] = useState('dashboard')
  const [nik, setNik] = useState('ADM001')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [employees, setEmployees] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [runningPayroll, setRunningPayroll] = useState(false)
  const [finalizingPayroll, setFinalizingPayroll] = useState(false)
  const [payrollMessage, setPayrollMessage] = useState('')
  const [payrollTab, setPayrollTab] = useState('run')
  const [payrollRuns, setPayrollRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [payrollDetail, setPayrollDetail] = useState(null)
  const [selectedPayrollItemId, setSelectedPayrollItemId] = useState(null)
  const [payrollDetailSearch, setPayrollDetailSearch] = useState('')
  const [salaryStructures, setSalaryStructures] = useState([])
  const [loadingSalary, setLoadingSalary] = useState(false)
  const [salaryForm, setSalaryForm] = useState({
    employeeId: '',
    baseSalary: 8000000,
    allowance: 1000000,
    deduction: 250000,
  })
  const [editingEmployeeId, setEditingEmployeeId] = useState(null)
  const [editSalaryModal, setEditSalaryModal] = useState({
    open: false,
    employeeId: '',
    employeeName: '',
    baseSalary: 0,
    allowance: 0,
    deduction: 0,
  })
  const [report, setReport] = useState({
    totalEmployees: 0,
    attendanceRate: 0,
    pendingLeave: 0,
    payrollTotal: 0,
    payrollCostBreakdown: [],
    attendanceTrend: [],
  })
  const [salaryDistribution, setSalaryDistribution] = useState({
    byDepartment: [],
    byPosition: [],
    byRole: [],
  })
  const [leaveStats, setLeaveStats] = useState({
    byType: [],
    byStatus: [],
    monthlySummary: [],
  })
  const [loadingReports, setLoadingReports] = useState(false)
  const [attendanceData, setAttendanceData] = useState([])
  const [leaveData, setLeaveData] = useState([])

  const canRunPayroll = ['HRD', 'Finance', 'Super Admin'].includes(role)
  const canApproveFinance = ['Finance', 'Super Admin'].includes(role)
  const canReview = ['HRD', 'Super Admin'].includes(role)
  const canEditSalary = ['HRD', 'Super Admin'].includes(role)

  const attendanceRows = useMemo(
    () => {
      if (attendanceData.length > 0) {
        return attendanceData.map((a) => ({
          name: a.employee_name,
          dept: a.department || '-',
          clockIn: a.clock_in ? new Date(a.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
          clockOut: a.clock_out ? new Date(a.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
          status: a.status || 'Aktif',
        }))
      }
      return [
        { name: 'Aditia Pratama', dept: 'Engineering', clockIn: '07:55', clockOut: '17:05', status: 'Aktif' },
        { name: 'Nadia Putri', dept: 'HRD', clockIn: '08:10', clockOut: '17:20', status: 'Aktif' },
        { name: 'Rizky Maulana', dept: 'Finance', clockIn: '08:22', clockOut: '17:15', status: 'Aktif' },
        { name: 'Salsa Wijaya', dept: 'Marketing', clockIn: '09:01', clockOut: '17:30', status: 'Terlambat' },
        { name: 'Budi Santoso', dept: 'Operations', clockIn: '07:50', clockOut: '17:00', status: 'Aktif' },
        { name: 'Intan Lestari', dept: 'Engineering', clockIn: '08:05', clockOut: '-', status: 'Aktif' },
        { name: 'Dini Prameswari', dept: 'HRD', clockIn: '08:00', clockOut: '17:10', status: 'Aktif' },
        { name: 'Maya Sari', dept: 'Finance', clockIn: '07:45', clockOut: '17:00', status: 'Aktif' },
      ]
    },
    [attendanceData],
  )

  const pendingLeaves = useMemo(() => leaveData.filter((l) => l.status === 'Pending'), [leaveData])
  const recentLeaves = useMemo(() => leaveData.slice(0, 5), [leaveData])

  const metrics = useMemo(
    () => [
      { label: 'Total Karyawan', value: String(report.totalEmployees), note: 'Data realtime', trend: '+12%' },
      { label: 'Kehadiran Hari Ini', value: `${report.attendanceRate}%`, note: 'Target 95%', trend: 'Stabil' },
      { label: 'Cuti Menunggu', value: String(report.pendingLeave), note: 'Perlu approval', trend: 'Perlu aksi' },
      { label: 'Total Payroll', value: formatRupiah(report.payrollTotal), note: 'Periode bulan ini', trend: 'Terkendali' },
    ],
    [report],
  )

  async function loadSalaryStructures() {
    setLoadingSalary(true)
    try {
      const data = await api('/salary-profiles')
      setSalaryStructures(
        data.map((row) => ({
          profileId: row.profile_id,
          employeeId: row.employee_id,
          employeeName: row.employee_name,
          department: row.department || '-',
          baseSalary: Number(row.base_salary),
          allowance: Number(row.allowance),
          deduction: Number(row.deduction),
          paymentMethod: row.payment_method,
          bankName: row.bank_name,
          bankAccountName: row.bank_account_name,
          bankAccountNumber: row.bank_account_number,
        })),
      )
    } catch {
      setSalaryStructures([])
    }
    setLoadingSalary(false)
  }

  async function loadDashboardData() {
    try {
      const reportData = await api('/reports/dashboard')
      setReport(reportData)
    } catch { /* ignore */ }

    setLoadingEmployees(true)
    try {
      const employeeData = await api('/employees')
      setEmployees(employeeData)
      if (!salaryForm.employeeId && employeeData.length > 0) {
        setSalaryForm((c) => ({ ...c, employeeId: String(employeeData[0].id) }))
      }
    } catch { /* ignore */ }
    setLoadingEmployees(false)
  }

useEffect(() => {
    if (!token) return
    const ctrl = new AbortController()
    const init = async () => {
      try {
        const reportData = await api('/reports/dashboard', { signal: ctrl.signal })
        setReport(reportData)
      } catch { /* ignore */ }
      setLoadingEmployees(true)
      try {
        const employeeData = await api('/employees', { signal: ctrl.signal })
        setEmployees(employeeData)
        if (salaryForm.employeeId === '' && employeeData.length > 0) {
          setSalaryForm((c) => ({ ...c, employeeId: String(employeeData[0].id) }))
        }
      } catch { /* ignore */ }
      setLoadingEmployees(false)
      try {
        const salaryData = await api('/salary-profiles', { signal: ctrl.signal })
        setSalaryStructures(
          salaryData.map((row) => ({
            profileId: row.profile_id,
            employeeId: row.employee_id,
            employeeName: row.employee_name,
            department: row.department || '-',
            baseSalary: Number(row.base_salary),
            allowance: Number(row.allowance),
            deduction: Number(row.deduction),
            paymentMethod: row.payment_method,
            bankName: row.bank_name,
            bankAccountName: row.bank_account_name,
            bankAccountNumber: row.bank_account_number,
          })),
        )
      } catch { setSalaryStructures([]) }
      setLoadingSalary(false)
      try {
        const attData = await api('/attendance/today', { signal: ctrl.signal })
        setAttendanceData(attData)
      } catch { setAttendanceData([]) }
      try {
        const leaveResp = await api('/leave', { signal: ctrl.signal })
        setLeaveData(leaveResp)
      } catch { setLeaveData([]) }
    }
    init()
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token || activePage !== 'payroll') return
    loadPayrollRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activePage])

  useEffect(() => {
    if (!token || activePage !== 'laporan') return
    const fetchReports = async () => {
      try {
        setLoadingReports(true)
        const [dashboardData, salaryDistData, leaveStatsData] = await Promise.all([
          api('/reports/dashboard'),
          api('/reports/salary-distribution'),
          api('/reports/leave-stats'),
        ])
        setReport(dashboardData)
        setSalaryDistribution(salaryDistData)
        setLeaveStats(leaveStatsData)
      } catch (err) {
        console.error('Failed to fetch reports:', err)
      } finally {
        setLoadingReports(false)
      }
    }
    fetchReports()
  }, [token, activePage])

  useEffect(() => {
    if (!editSalaryModal.open) return
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setEditingEmployeeId(null)
        setEditSalaryModal({ open: false, employeeId: '', employeeName: '', baseSalary: 0, allowance: 0, deduction: 0 })
        setPayrollMessage('Mode edit dibatalkan')
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [editSalaryModal.open])

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ nik, password }),
      })
      setToken(data.token)
      setRole(data.role)
      localStorage.setItem('hris_token', data.token)
      localStorage.setItem('hris_role', data.role)
    } catch (err) {
      setError(err.message || 'Login gagal. Cek NIK/password dan pastikan backend aktif.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('hris_token')
    localStorage.removeItem('hris_role')
    setToken('')
    setRole('')
    setActivePage('dashboard')
  }

  const resetSalaryForm = () => {
    const defaultEmployeeId = employees.length > 0 ? String(employees[0].id) : ''
    setSalaryForm({ employeeId: defaultEmployeeId, baseSalary: 8000000, allowance: 1000000, deduction: 250000 })
  }

  async function loadPayrollRuns() {
    try {
      const data = await api('/payroll/runs')
      setPayrollRuns(data)
      if (data.length > 0 && !selectedRunId) {
        setSelectedRunId(data[0].id)
        await loadPayrollDetail(data[0].id)
      }
    } catch { /* ignore */ }
  }

  async function loadPayrollDetail(runId) {
    try {
      const data = await api(`/payroll/runs/${runId}`)
      setPayrollDetail(data)
      setSelectedPayrollItemId(data.items?.[0]?.id || null)
    } catch { /* ignore */ }
  }

  const handleSaveSalaryStructure = async () => {
    const employee = employees.find((e) => String(e.id) === String(salaryForm.employeeId))
    if (!employee) return
    if (
      Number.isNaN(Number(salaryForm.baseSalary)) ||
      Number.isNaN(Number(salaryForm.allowance)) ||
      Number.isNaN(Number(salaryForm.deduction))
    ) {
      setPayrollMessage('Nominal gaji wajib berupa angka yang valid')
      return
    }
    if (Number(salaryForm.baseSalary) < 0 || Number(salaryForm.allowance) < 0 || Number(salaryForm.deduction) < 0) {
      setPayrollMessage('Nominal gaji, tunjangan, dan potongan tidak boleh minus')
      return
    }
    try {
      await api('/salary-profiles', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: Number(salaryForm.employeeId),
          baseSalary: Number(salaryForm.baseSalary),
          allowance: Number(salaryForm.allowance),
          deduction: Number(salaryForm.deduction),
        }),
      })
      setPayrollMessage(`Salary structure untuk ${employee.name} berhasil disimpan`)
      resetSalaryForm()
      await loadSalaryStructures()
    } catch (err) {
      setPayrollMessage(err.message || 'Gagal menyimpan salary structure')
    }
  }

  const handleEditSalaryStructure = (item) => {
    setEditingEmployeeId(item.employeeId)
    setEditSalaryModal({
      open: true,
      employeeId: String(item.employeeId),
      employeeName: item.employeeName,
      baseSalary: Number(item.baseSalary),
      allowance: Number(item.allowance),
      deduction: Number(item.deduction),
    })
    setPayrollMessage(`Mode edit aktif untuk ${item.employeeName}`)
  }

  const handleSaveEditedSalary = async () => {
    if (Number(editSalaryModal.baseSalary) < 0 || Number(editSalaryModal.allowance) < 0 || Number(editSalaryModal.deduction) < 0) {
      setPayrollMessage('Nominal gaji, tunjangan, dan potongan tidak boleh minus')
      return
    }
    try {
      await api(`/salary-profiles/${editSalaryModal.employeeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          baseSalary: Number(editSalaryModal.baseSalary),
          allowance: Number(editSalaryModal.allowance),
          deduction: Number(editSalaryModal.deduction),
        }),
      })
      setEditSalaryModal((prev) => ({ ...prev, open: false }))
      setPayrollMessage(`Salary structure untuk ${editSalaryModal.employeeName} berhasil diupdate`)
      setEditingEmployeeId(null)
      await loadSalaryStructures()
    } catch (err) {
      setPayrollMessage(err.message || 'Gagal mengupdate salary structure')
    }
  }

  const handleRunPayroll = async () => {
    setRunningPayroll(true)
    setPayrollMessage('')
    try {
      const data = await api('/payroll/runs/generate', {
        method: 'POST',
        body: JSON.stringify({ periodMonth: new Date().toISOString().slice(0, 7) + '-01' }),
      })
      setPayrollMessage(`Draft payroll berhasil dibuat (Run #${data.id})`)
      await loadPayrollRuns()
      await loadPayrollDetail(data.id)
      await loadDashboardData()
    } catch (err) {
      setPayrollMessage(err.message || 'Gagal menjalankan payroll')
    }
    setRunningPayroll(false)
  }

  const handleReviewRun = async () => {
    if (!selectedRunId) return
    try {
      const data = await api(`/payroll/runs/${selectedRunId}/review`, { method: 'POST' })
      setPayrollMessage(`Run #${data.id} berhasil di-review (menunggu approval Finance)`)
      await loadPayrollRuns()
      await loadPayrollDetail(selectedRunId)
    } catch (err) {
      setPayrollMessage(err.message || 'Gagal me-review payroll run')
    }
  }

  const handleApproveRun = async () => {
    if (!selectedRunId) return
    try {
      const data = await api(`/payroll/runs/${selectedRunId}/approve`, { method: 'POST' })
      setPayrollMessage(`Run #${data.id} berhasil di-approve oleh Finance`)
      await loadPayrollRuns()
      await loadPayrollDetail(selectedRunId)
    } catch (err) {
      setPayrollMessage(err.message || 'Gagal me-approve payroll run')
    }
  }

  const handleRejectRun = async () => {
    if (!selectedRunId) return
    try {
      const data = await api(`/payroll/runs/${selectedRunId}/reject`, { method: 'POST', body: JSON.stringify({ comment: 'Rejected' }) })
      setPayrollMessage(`Run #${data.id} telah di-reject`)
      await loadPayrollRuns()
      await loadPayrollDetail(selectedRunId)
    } catch (err) {
      setPayrollMessage(err.message || 'Gagal me-reject payroll run')
    }
  }

  const handleFinalizeRun = async () => {
    if (!selectedRunId) return
    setFinalizingPayroll(true)
    setPayrollMessage('')
    try {
      const data = await api(`/payroll/runs/${selectedRunId}/finalize`, { method: 'POST' })
      setPayrollMessage(`Run #${data.id} berhasil difinalisasi`)
      await loadPayrollRuns()
      await loadPayrollDetail(selectedRunId)
      await loadDashboardData()
    } catch (err) {
      if (err.errors) {
        setPayrollMessage(`Validasi gagal: ${err.errors.join('; ')}`)
      } else {
        setPayrollMessage(err.message || 'Gagal finalize payroll run')
      }
    }
    setFinalizingPayroll(false)
  }

  const handleValidateRun = async () => {
    if (!selectedRunId) return
    try {
      const data = await api(`/payroll/runs/${selectedRunId}/validate`)
      if (data.valid) {
        setPayrollMessage('Validasi berhasil: tidak ada anomali')
      } else {
        setPayrollMessage(`Validasi gagal: ${data.errors.join('; ')}`)
      }
    } catch (err) {
      setPayrollMessage(err.message || 'Gagal memvalidasi payroll run')
    }
  }

  const handleDeleteSalaryStructure = async (employeeId) => {
    try {
      await api(`/salary-profiles/${employeeId}`, { method: 'DELETE' })
      setPayrollMessage('Salary structure berhasil dinonaktifkan')
      await loadSalaryStructures()
    } catch (err) {
      setPayrollMessage(err.message || 'Gagal menghapus salary structure')
    }
  }

  if (!token) {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={handleLogin}>
          <h2>Login HRIS Dashboard</h2>
          <p>Gunakan akun seed default untuk mulai eksplorasi backend.</p>
          <label htmlFor="nik">NIK</label>
          <input id="nik" value={nik} onChange={(e) => setNik(e.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <small className="error">{error}</small> : null}
          <button type="submit">Masuk</button>
        </form>
      </div>
    )
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="brand">
          <h1>Cloud HRIS</h1>
          <p>Workspace Console</p>
        </div>
        <nav className="menu">
          {menus.map((menu) => (
            <button
              key={menu.key}
              className={`menu-item ${activePage === menu.key ? 'active' : ''}`}
              onClick={() => setActivePage(menu.key)}
            >
              {menu.label}
            </button>
          ))}
        </nav>
        <div className="user-card">
          <strong>Rani Amelia</strong>
          <p>{role || 'HR Administrator'}</p>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="section-label">{menus.find((menu) => menu.key === activePage)?.label}</p>
            <h2>Human Resource Information System (HRIS) Terpadu Berbasis Cloud</h2>
          </div>
          <input placeholder="Cari karyawan, payroll, atau approval..." />
        </header>

        {activePage === 'dashboard' ? (
          <>
            <section className="metrics-grid">
              {metrics.map((item) => (
                <article key={item.label} className="metric-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                  <small>{item.trend}</small>
                </article>
              ))}
            </section>

            <section className="main-grid">
              <article className="panel table-panel">
                <div className="panel-head">
                  <h3>Monitoring Kehadiran Real-time</h3>
                  <button>Lihat Semua</button>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Departemen</th>
                      <th>Clock In</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td>{row.dept}</td>
                        <td>{row.clockIn}</td>
                        <td>
                          <span className={`status ${row.status.toLowerCase()}`}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>

              <article className="panel">
                <h3>Pengajuan Cuti & Izin</h3>
                {pendingLeaves.length === 0 && recentLeaves.length === 0 ? (
                  <p style={{ color: '#6471a4', fontSize: 14 }}>Belum ada pengajuan cuti.</p>
                ) : (
                  <ul className="timeline">
                    {pendingLeaves.slice(0, 4).map((l) => (
                      <li key={l.id}>
                        <strong>{l.leave_type} - {l.employee_name}</strong>
                        <p>{l.reason || 'Tanpa keterangan'} &middot; <span className="status pending">{l.status}</span></p>
                      </li>
                    ))}
                    {pendingLeaves.length === 0 && recentLeaves.slice(0, 3).map((l) => (
                      <li key={l.id}>
                        <strong>{l.leave_type} - {l.employee_name}</strong>
                        <p>{l.start_date?.slice(0, 10)} s/d {l.end_date?.slice(0, 10)} &middot; <span className={`status ${l.status.toLowerCase()}`}>{l.status}</span></p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>

              <article className="panel highlight">
                <h3>Payroll Basic (Bulan Ini)</h3>
                <p>Total Penggajian</p>
                <strong>{formatRupiah(report.payrollTotal)}</strong>
                <div className="payroll-kpis">
                  <div>
                    <span>Karyawan Aktif</span>
                    <b>{report.totalEmployees}</b>
                  </div>
                  <div>
                    <span>Cuti Pending</span>
                    <b>{report.pendingLeave}</b>
                  </div>
                  <div>
                    <span>Payslip Terbit</span>
                    <b>{report.totalEmployees}</b>
                  </div>
                </div>
              </article>
            </section>
          </>
        ) : (
          <FeaturePages
            activePage={activePage}
            employees={employees}
            loadingEmployees={loadingEmployees}
            report={report}
            role={role}
            canRunPayroll={canRunPayroll}
            canApproveFinance={canApproveFinance}
            canReview={canReview}
            canEditSalary={canEditSalary}
            onRunPayroll={handleRunPayroll}
            onFinalizeRun={handleFinalizeRun}
            onReviewRun={handleReviewRun}
            onApproveRun={handleApproveRun}
            onRejectRun={handleRejectRun}
            onValidateRun={handleValidateRun}
            payrollTab={payrollTab}
            onChangePayrollTab={setPayrollTab}
            onSelectRun={async (runId) => {
              setSelectedRunId(runId)
              await loadPayrollDetail(runId)
            }}
            payrollMessage={payrollMessage}
            runningPayroll={runningPayroll}
            finalizingPayroll={finalizingPayroll}
            payrollRuns={payrollRuns}
            selectedRunId={selectedRunId}
            payrollDetail={payrollDetail}
            selectedPayrollItemId={selectedPayrollItemId}
            onSelectPayrollItem={setSelectedPayrollItemId}
            payrollDetailSearch={payrollDetailSearch}
            onPayrollDetailSearchChange={setPayrollDetailSearch}
            salaryStructures={salaryStructures}
            loadingSalary={loadingSalary}
            salaryForm={salaryForm}
            editingEmployeeId={editingEmployeeId}
            editSalaryModal={editSalaryModal}
            onSalaryFormChange={setSalaryForm}
            onSaveSalaryStructure={handleSaveSalaryStructure}
            onEditSalaryStructure={handleEditSalaryStructure}
            onCancelEditSalary={() => {
              setEditingEmployeeId(null)
              setEditSalaryModal({ open: false, employeeId: '', employeeName: '', baseSalary: 0, allowance: 0, deduction: 0 })
              setPayrollMessage('Mode edit dibatalkan')
            }}
            onEditSalaryModalChange={setEditSalaryModal}
            onSaveEditedSalary={handleSaveEditedSalary}
             onDeleteSalaryStructure={handleDeleteSalaryStructure}
             attendanceRows={attendanceRows}
             leaveData={leaveData}
             salaryDistribution={salaryDistribution}
             leaveStats={leaveStats}
             loadingReports={loadingReports}
           />
        )}
      </main>
    </div>
  )
}

function FeaturePages({
  activePage,
  employees,
  loadingEmployees,
  report,
  role,
  canRunPayroll,
  canApproveFinance,
  canReview,
  canEditSalary,
  onRunPayroll,
  onFinalizeRun,
  onReviewRun,
  onApproveRun,
  onRejectRun,
  onValidateRun,
  payrollTab,
  onChangePayrollTab,
  onSelectRun,
  payrollMessage,
  runningPayroll,
  finalizingPayroll,
  payrollRuns,
  selectedRunId,
  payrollDetail,
  selectedPayrollItemId,
  onSelectPayrollItem,
  payrollDetailSearch,
  onPayrollDetailSearchChange,
  salaryStructures,
  loadingSalary,
  salaryForm,
  editingEmployeeId,
  editSalaryModal,
  onSalaryFormChange,
  onSaveSalaryStructure,
  onEditSalaryStructure,
  onCancelEditSalary,
  onEditSalaryModalChange,
  onSaveEditedSalary,
  onDeleteSalaryStructure,
  attendanceRows,
  leaveData,
  salaryDistribution,
  leaveStats,
  loadingReports,
}) {
  if (activePage === 'karyawan') {
    return (
      <section className="feature-layout">
        <article className="panel">
          <h3>Directory Karyawan</h3>
          {loadingEmployees ? <p>Memuat data karyawan...</p> : null}
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Departemen</th>
                <th>Jabatan</th>
                <th>Akhir Kontrak</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.department || '-'}</td>
                  <td>{employee.position || '-'}</td>
                  <td>{employee.contract_end ? employee.contract_end.slice(0, 10) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    )
  }

  if (activePage === 'absensi') {
    const lateCount = attendanceRows.filter((r) => r.status === 'Terlambat').length
    const aktifCount = attendanceRows.filter((r) => r.status === 'Aktif').length
    return (
      <section className="feature-layout">
        <article className="panel">
          <h3>Absensi Digital (GPS + Selfie)</h3>
          <div className="quick-grid">
            <div className="quick-card">
              <span>Kehadiran Hari Ini</span>
              <strong>{report.attendanceRate}%</strong>
            </div>
            <div className="quick-card">
              <span>Hadir Tepat Waktu</span>
              <strong>{aktifCount} orang</strong>
            </div>
            <div className="quick-card">
              <span>Terlambat</span>
              <strong>{lateCount} orang</strong>
            </div>
          </div>
        </article>
        <article className="panel">
          <h3>Log Kehadiran Hari Ini</h3>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Departemen</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendanceRows.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.name}</td>
                  <td>{row.dept}</td>
                  <td>{row.clockIn}</td>
                  <td>{row.clockOut || '-'}</td>
                  <td>
                    <span className={`status ${row.status.toLowerCase()}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    )
  }

  if (activePage === 'cuti') {
    const approvedCount = leaveData.filter((l) => l.status === 'Approved').length
    const rejectedCount = leaveData.filter((l) => l.status === 'Rejected').length
    return (
      <section className="feature-layout">
        <article className="panel">
          <h3>Leave Management</h3>
          <div className="quick-grid">
            <div className="quick-card">
              <span>Pending Approval</span>
              <strong>{report.pendingLeave}</strong>
            </div>
            <div className="quick-card">
              <span>Disetujui</span>
              <strong>{approvedCount}</strong>
            </div>
            <div className="quick-card">
              <span>Ditolak</span>
              <strong>{rejectedCount}</strong>
            </div>
          </div>
        </article>
        <article className="panel">
          <h3>Daftar Pengajuan Cuti & Izin</h3>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Departemen</th>
                <th>Jenis</th>
                <th>Mulai</th>
                <th>Selesai</th>
                <th>Alasan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaveData.map((l) => (
                <tr key={l.id}>
                  <td>{l.employee_name}</td>
                  <td>{l.department || '-'}</td>
                  <td>{l.leave_type}</td>
                  <td>{l.start_date?.slice(0, 10)}</td>
                  <td>{l.end_date?.slice(0, 10)}</td>
                  <td>{l.reason || '-'}</td>
                  <td>
                    <span className={`status ${l.status.toLowerCase()}`}>{l.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    )
  }

  if (activePage === 'payroll') {
    const currentRun = payrollRuns.find((r) => r.id === selectedRunId)
    const runStatus = currentRun?.status || ''
    const filteredPayrollItems = payrollDetail
      ? payrollDetail.items.filter((item) => item.employee_name.toLowerCase().includes(payrollDetailSearch.toLowerCase()))
      : []

    const exportPayrollCsv = () => {
      if (!payrollDetail || filteredPayrollItems.length === 0) return
      const headers = ['Nama', 'Departemen', 'Gross', 'Potongan', 'Net']
      const rows = filteredPayrollItems.map((item) => [
        item.employee_name,
        item.department || '-',
        item.gross_amount,
        item.deduction_amount,
        item.net_amount,
      ])
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
        .join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `payroll-run-${payrollDetail.run.id}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    return (
      <section className="feature-layout payroll-layout">
        <article className="panel payroll-tabs">
          <button
            className={`tab-btn ${payrollTab === 'run' ? 'active' : ''}`}
            onClick={() => onChangePayrollTab('run')}
          >
            Payroll Run
          </button>
          <button
            className={`tab-btn ${payrollTab === 'structure' ? 'active' : ''}`}
            onClick={() => onChangePayrollTab('structure')}
          >
            Salary Structure
          </button>
        </article>

        {payrollTab === 'run' ? (
          <>
            <article className="panel">
              <div className="panel-head">
                <h3>Payroll Management</h3>
                {canRunPayroll && (
                  <div className="payroll-actions">
                    <button className="primary-btn" disabled={runningPayroll} onClick={onRunPayroll}>
                      {runningPayroll ? 'Membuat draft...' : 'Generate Draft Run'}
                    </button>
                    {runStatus === 'draft' && canReview && (
                      <button className="primary-btn secondary-btn" onClick={onReviewRun}>
                        Submit Review
                      </button>
                    )}
                    {runStatus === 'reviewed' && canApproveFinance && (
                      <>
                        <button className="primary-btn" onClick={onApproveRun}>
                          Approve
                        </button>
                        <button className="small-btn cancel-btn" onClick={onRejectRun}>
                          Reject
                        </button>
                      </>
                    )}
                    {runStatus === 'approved' && canApproveFinance && (
                      <button
                        className="primary-btn"
                        disabled={finalizingPayroll}
                        onClick={onFinalizeRun}
                      >
                        {finalizingPayroll ? 'Finalizing...' : 'Finalize Run'}
                      </button>
                    )}
                    {selectedRunId && (
                      <button className="small-btn" onClick={onValidateRun}>
                        Validate
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p>Total payroll bulan ini: {formatRupiah(report.payrollTotal)}</p>
              {payrollMessage ? <p className="message">{payrollMessage}</p> : null}
              {runStatus ? (
                <div className="quick-grid detail-summary" style={{ marginTop: 10 }}>
                  <div className="quick-card">
                    <span>Status Workflow</span>
                    <strong className={`status-badge status-${runStatus}`}>{runStatus}</strong>
                  </div>
                  {runStatus === 'draft' && <div className="quick-card"><span>Next Step</span><strong>HRD Submit Review</strong></div>}
                  {runStatus === 'reviewed' && <div className="quick-card"><span>Next Step</span><strong>Finance Approve</strong></div>}
                  {runStatus === 'approved' && <div className="quick-card"><span>Next Step</span><strong>Finance Finalize</strong></div>}
                  {runStatus === 'finalized' && <div className="quick-card"><span>Status</span><strong>Selesai</strong></div>}
                </div>
              ) : null}
            </article>

            <article className="panel">
              <h3>Daftar Payroll Run</h3>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Periode</th>
                    <th>Status</th>
                    <th>Karyawan</th>
                    <th>Total Net</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRuns.map((run) => (
                    <tr key={run.id}>
                      <td>#{run.id}</td>
                      <td>{String(run.period_month).slice(0, 10)}</td>
                      <td>
                        <span className={`status-badge status-${run.status}`}>{run.status}</span>
                      </td>
                      <td>{run.employee_count}</td>
                      <td>{formatRupiah(run.total_net)}</td>
                      <td>
                        <button className="small-btn" onClick={() => onSelectRun(run.id)}>
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article className="panel">
              <h3>Detail Run {selectedRunId ? `#${selectedRunId}` : ''}</h3>
              {!payrollDetail ? (
                <p>Pilih run untuk melihat detail.</p>
              ) : (
                <>
                  <div className="quick-grid detail-summary">
                    <div className="quick-card">
                      <span>Periode</span>
                      <strong>{String(payrollDetail.run.period_month).slice(0, 10)}</strong>
                    </div>
                    <div className="quick-card">
                      <span>Status</span>
                      <strong className={`status-badge status-${payrollDetail.run.status}`}>
                        {payrollDetail.run.status}
                      </strong>
                    </div>
                    <div className="quick-card">
                      <span>Total Net</span>
                      <strong>{formatRupiah(payrollDetail.run.total_net)}</strong>
                    </div>
                  </div>

                  <div className="detail-toolbar">
                    <input
                      className="detail-search"
                      placeholder="Cari nama karyawan..."
                      value={payrollDetailSearch}
                      onChange={(event) => onPayrollDetailSearchChange(event.target.value)}
                    />
                    <button className="small-btn" onClick={exportPayrollCsv}>
                      Export CSV
                    </button>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th>Karyawan</th>
                        <th>Departemen</th>
                        <th>Gross</th>
                        <th>Potongan</th>
                        <th>Net</th>
                        <th>Komponen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayrollItems.map((item) => (
                        <tr
                          key={item.id}
                          className={selectedPayrollItemId === item.id ? 'editing-row' : ''}
                        >
                          <td>{item.employee_name}</td>
                          <td>{item.department || '-'}</td>
                          <td>{formatRupiah(item.gross_amount)}</td>
                          <td>{formatRupiah(item.deduction_amount)}</td>
                          <td className={Number(item.net_amount) < 0 ? 'error' : ''}>
                            {formatRupiah(item.net_amount)}
                          </td>
                          <td>
                            <button className="small-btn" onClick={() => onSelectPayrollItem(item.id)}>
                              Lihat Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <PayrollItemBreakdown
                    item={filteredPayrollItems.find((item) => item.id === selectedPayrollItemId)}
                  />
                </>
              )}
            </article>
          </>
        ) : (
          <>
            <article className="panel">
              <h3>Atur Salary Structure Karyawan</h3>
              <p className="section-note">
                {loadingSalary ? 'Memuat data salary structure...' : 'Data disimpan ke database dan persist saat refresh'}
              </p>
              {canEditSalary && (
                <>
                  <div className="salary-form-head">
                    <span>Nama Karyawan</span>
                    <span>Gaji Pokok</span>
                    <span>Tunjangan</span>
                    <span>Potongan</span>
                    <span>Aksi</span>
                  </div>
                  <div className="salary-form">
                    <select
                      value={salaryForm.employeeId}
                      onChange={(event) => onSalaryFormChange((prev) => ({ ...prev, employeeId: event.target.value }))}
                    >
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={salaryForm.baseSalary}
                      onChange={(event) =>
                        onSalaryFormChange((prev) => ({ ...prev, baseSalary: Number(event.target.value || 0) }))
                      }
                      placeholder="Gaji pokok"
                    />
                    <input
                      type="number"
                      min={0}
                      value={salaryForm.allowance}
                      onChange={(event) =>
                        onSalaryFormChange((prev) => ({ ...prev, allowance: Number(event.target.value || 0) }))
                      }
                      placeholder="Tunjangan"
                    />
                    <input
                      type="number"
                      min={0}
                      value={salaryForm.deduction}
                      onChange={(event) =>
                        onSalaryFormChange((prev) => ({ ...prev, deduction: Number(event.target.value || 0) }))
                      }
                      placeholder="Potongan"
                    />
                    <button className="primary-btn" onClick={onSaveSalaryStructure}>
                      Simpan Struktur
                    </button>
                  </div>
                </>
              )}
            </article>

            <article className="panel">
              <h3>Daftar Salary Structure</h3>
              <p className="section-note">Tabel Salary Structure Karyawan</p>
              <table>
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Departemen</th>
                    <th>Gaji Pokok</th>
                    <th>Tunjangan</th>
                    <th>Potongan</th>
                    <th>Take Home Pay</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {salaryStructures.map((item) => (
                    <tr
                      key={item.employeeId}
                      className={editingEmployeeId === item.employeeId ? 'editing-row' : ''}
                    >
                      <td>{item.employeeName}</td>
                      <td>{item.department}</td>
                      <td>{formatRupiah(item.baseSalary)}</td>
                      <td>{formatRupiah(item.allowance)}</td>
                      <td>{formatRupiah(item.deduction)}</td>
                      <td>{formatRupiah(item.baseSalary + item.allowance - item.deduction)}</td>
                      <td className="action-cell">
                        {canEditSalary && (
                          <button className="small-btn" onClick={() => onEditSalaryStructure(item)}>
                            Edit
                          </button>
                        )}
                        {canEditSalary && (
                          <button
                            className="small-btn cancel-btn"
                            onClick={() => onDeleteSalaryStructure(item.employeeId)}
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payrollMessage ? <p className="message">{payrollMessage}</p> : null}
            </article>
            {editSalaryModal.open ? (
              <div className="modal-overlay" onClick={onCancelEditSalary}>
                <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                  <h3>Edit Salary Structure</h3>
                  <p className="section-note">{editSalaryModal.employeeName}</p>
                  <div className="modal-form">
                    <label htmlFor="edit-base">Gaji Pokok</label>
                    <input
                      id="edit-base"
                      type="number"
                      min={0}
                      value={editSalaryModal.baseSalary}
                      onChange={(event) =>
                        onEditSalaryModalChange((prev) => ({
                          ...prev,
                          baseSalary: Number(event.target.value || 0),
                        }))
                      }
                    />
                    <label htmlFor="edit-allowance">Tunjangan</label>
                    <input
                      id="edit-allowance"
                      type="number"
                      min={0}
                      value={editSalaryModal.allowance}
                      onChange={(event) =>
                        onEditSalaryModalChange((prev) => ({
                          ...prev,
                          allowance: Number(event.target.value || 0),
                        }))
                      }
                    />
                    <label htmlFor="edit-deduction">Potongan</label>
                    <input
                      id="edit-deduction"
                      type="number"
                      min={0}
                      value={editSalaryModal.deduction}
                      onChange={(event) =>
                        onEditSalaryModalChange((prev) => ({
                          ...prev,
                          deduction: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </div>
                  <div className="modal-actions">
                    <button className="small-btn cancel-btn" onClick={onCancelEditSalary}>
                      Batal
                    </button>
                    <button className="primary-btn" onClick={onSaveEditedSalary}>
                      Simpan Perubahan
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    )
  }

  if (activePage === 'laporan') {
    const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#6C5CE7', '#00B894', '#FDCB6E']
    
    return (
      <section className="feature-layout">
        <article className="panel">
          <h3>Laporan & Analitik HR</h3>
          
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '8px' }}>
            <button 
              className="primary-btn" 
              onClick={() => exportReportsToPDF(report, salaryDistribution, leaveStats)}
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              📥 Export PDF
            </button>
          </div>
          
          {/* Summary Cards */}
          <div className="quick-grid" style={{ marginBottom: '2rem' }}>
            <div className="quick-card">
              <span>Total Karyawan</span>
              <strong>{report.totalEmployees}</strong>
            </div>
            <div className="quick-card">
              <span>Kehadiran Hari Ini</span>
              <strong>{report.attendanceRate}%</strong>
            </div>
            <div className="quick-card">
              <span>Cuti Menunggu</span>
              <strong>{report.pendingLeave}</strong>
            </div>
            <div className="quick-card">
              <span>Total Payroll (Bulan)</span>
              <strong>{formatRupiah(report.payrollTotal)}</strong>
            </div>
          </div>

          {loadingReports ? (
            <p style={{ textAlign: 'center', padding: '2rem' }}>Loading reports...</p>
          ) : (
            <>
              {/* Charts Section */}
              <div className="charts-grid">
                {/* Salary Distribution by Department - Pie Chart */}
                <div className="chart-container">
                  <h4>Distribusi Gaji per Departemen</h4>
                  {salaryDistribution.byDepartment?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={salaryDistribution.byDepartment}
                          dataKey="total_salary"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {salaryDistribution.byDepartment.map((_, idx) => (
                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatRupiah(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p>No data available</p>
                  )}
                </div>

                {/* Leave by Type - Bar Chart */}
                <div className="chart-container">
                  <h4>Jumlah Cuti per Tipe</h4>
                  {leaveStats.byType?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={leaveStats.byType}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" fill="#8884D8" />
                        <Bar dataKey="approved" fill="#82CA9D" />
                        <Bar dataKey="rejected" fill="#FFA07A" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p>No data available</p>
                  )}
                </div>

                {/* Attendance Trend - Line Chart */}
                <div className="chart-container">
                  <h4>Tren Kehadiran (7 Hari)</h4>
                  {report.attendanceTrend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={report.attendanceTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week_start" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="attendance_rate" stroke="#8884d8" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p>No data available</p>
                  )}
                </div>

                {/* Payroll Cost Breakdown - Bar Chart */}
                <div className="chart-container">
                  <h4>Biaya Payroll per Departemen</h4>
                  {report.payrollCostBreakdown?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={report.payrollCostBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="department" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatRupiah(value)} />
                        <Legend />
                        <Bar dataKey="total_gross" fill="#8884D8" name="Total Gaji Bruto" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p>No data available</p>
                  )}
                </div>

                {/* Salary by Position - Pie Chart */}
                <div className="chart-container">
                  <h4>Distribusi Gaji per Posisi</h4>
                  {salaryDistribution.byPosition?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={salaryDistribution.byPosition}
                          dataKey="total_salary"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {salaryDistribution.byPosition.map((_, idx) => (
                            <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatRupiah(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p>No data available</p>
                  )}
                </div>

                {/* Leave Status Summary - Bar Chart */}
                <div className="chart-container">
                  <h4>Status Cuti Bulanan (3 Bulan Terakhir)</h4>
                  {leaveStats.monthlySummary?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={leaveStats.monthlySummary}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="total" fill="#8884D8" name="Total" />
                        <Bar dataKey="approved" fill="#82CA9D" name="Disetujui" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p>No data available</p>
                  )}
                </div>
              </div>

              {/* Detailed Tables */}
              <div style={{ marginTop: '2rem' }}>
                <h4>Detail Distribusi Gaji</h4>
                <table style={{ width: '100%', marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th>Departemen</th>
                      <th>Jumlah Karyawan</th>
                      <th>Total Gaji</th>
                      <th>Rata-rata Gaji</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryDistribution.byDepartment?.map((dept) => (
                      <tr key={dept.label}>
                        <td>{dept.label}</td>
                        <td>{dept.count}</td>
                        <td>{formatRupiah(dept.total_salary)}</td>
                        <td>{formatRupiah(dept.avg_salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </article>
      </section>
    )
  }

  return (
    <section className="feature-layout">
      <article className="panel">
        <h3>Role Management</h3>
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Akses Modul</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Super Admin</td>
              <td>Semua Modul</td>
              <td>Aktif</td>
            </tr>
            <tr>
              <td>HRD</td>
              <td>Karyawan, Absensi, Cuti, Payroll, Laporan</td>
              <td>{role}</td>
            </tr>
            <tr>
              <td>Manager</td>
              <td>Approval Cuti dan Monitoring Tim</td>
              <td>Aktif</td>
            </tr>
            <tr>
              <td>Employee</td>
              <td>Self-service Profile dan Slip Gaji</td>
              <td>Aktif</td>
            </tr>
          </tbody>
        </table>
      </article>
    </section>
  )
}

function PayrollItemBreakdown({ item }) {
  if (!item) return null

  return (
    <div className="component-box">
      <h4>Komponen Gaji - {item.employee_name}</h4>
      {item.components?.length ? (
        <table>
          <thead>
            <tr>
              <th>Nama Komponen</th>
              <th>Tipe</th>
              <th>Nominal</th>
            </tr>
          </thead>
          <tbody>
            {item.components.map((component) => (
              <tr key={component.id}>
                <td>{component.component_name_snapshot}</td>
                <td>{component.component_type}</td>
                <td>{formatRupiah(component.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Belum ada komponen payroll untuk item ini.</p>
      )}
    </div>
  )
}

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(value || 0)
}

function exportReportsToPDF(report, salaryDistribution, leaveStats) {
  const doc = new jsPDF()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  let yPos = margin

  // Title
  doc.setFontSize(18)
  doc.setFont(undefined, 'bold')
  doc.text('Laporan HR & Analitik', margin, yPos)
  yPos += 10

  // Date
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, margin, yPos)
  yPos += 15

  // Summary Section
  doc.setFontSize(12)
  doc.setFont(undefined, 'bold')
  doc.text('Ringkasan', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  const summaryData = [
    ['Metrik', 'Nilai'],
    ['Total Karyawan', `${report.totalEmployees}`],
    ['Kehadiran Hari Ini', `${report.attendanceRate}%`],
    ['Cuti Menunggu Approval', `${report.pendingLeave}`],
    ['Total Payroll Bulan Ini', formatRupiah(report.payrollTotal)],
  ]
  autoTable(doc, {
    startY: yPos,
    head: [summaryData[0]],
    body: summaryData.slice(1),
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [31, 49, 113], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { textColor: [29, 35, 64] },
    alternateRowStyles: { fillColor: [240, 243, 249] },
  })
  yPos = doc.lastAutoTable.finalY + 12

  // Salary Distribution by Department
  if (salaryDistribution.byDepartment && salaryDistribution.byDepartment.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = margin
    }
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text('Distribusi Gaji per Departemen', margin, yPos)
    yPos += 8

    const departmentData = [
      ['Departemen', 'Jumlah Karyawan', 'Total Gaji', 'Rata-rata Gaji'],
      ...salaryDistribution.byDepartment.map((dept) => [
        dept.label,
        `${dept.count}`,
        formatRupiah(dept.total_salary),
        formatRupiah(dept.avg_salary),
      ]),
    ]
    autoTable(doc, {
      startY: yPos,
      head: [departmentData[0]],
      body: departmentData.slice(1),
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [31, 49, 113], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [29, 35, 64] },
      alternateRowStyles: { fillColor: [240, 243, 249] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
    })
    yPos = doc.lastAutoTable.finalY + 12
  }

  // Leave Statistics by Type
  if (leaveStats.byType && leaveStats.byType.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = margin
    }
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text('Statistik Cuti per Tipe', margin, yPos)
    yPos += 8

    const leaveTypeData = [
      ['Tipe Cuti', 'Total', 'Disetujui', 'Ditolak', 'Pending'],
      ...leaveStats.byType.map((leave) => [
        leave.label,
        `${leave.total}`,
        `${leave.approved}`,
        `${leave.rejected}`,
        `${leave.pending}`,
      ]),
    ]
    autoTable(doc, {
      startY: yPos,
      head: [leaveTypeData[0]],
      body: leaveTypeData.slice(1),
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [31, 49, 113], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [29, 35, 64] },
      alternateRowStyles: { fillColor: [240, 243, 249] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
      },
    })
    yPos = doc.lastAutoTable.finalY + 12
  }

  // Payroll Cost Breakdown
  if (report.payrollCostBreakdown && report.payrollCostBreakdown.length > 0) {
    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = margin
    }
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    doc.text('Biaya Payroll per Departemen', margin, yPos)
    yPos += 8

    const payrollData = [
      ['Departemen', 'Jumlah Karyawan', 'Total Gaji Bruto'],
      ...report.payrollCostBreakdown.map((pb) => [
        pb.department || '-',
        `${pb.employee_count || 0}`,
        formatRupiah(pb.total_gross || 0),
      ]),
    ]
    autoTable(doc, {
      startY: yPos,
      head: [payrollData[0]],
      body: payrollData.slice(1),
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [31, 49, 113], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [29, 35, 64] },
      alternateRowStyles: { fillColor: [240, 243, 249] },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
      },
    })
  }

  const filename = `Laporan_HR_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

export default App