import { useEffect, useMemo, useState } from 'react'
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
  })

  const attendanceRows = useMemo(
    () => [
      { name: 'Aditia Pratama', dept: 'Engineering', clockIn: '08:05', status: 'Aktif' },
      { name: 'Nadia Putri', dept: 'HRD', clockIn: '08:10', status: 'Meeting' },
      { name: 'Rizky Maulana', dept: 'Finance', clockIn: '08:22', status: 'Aktif' },
      { name: 'Salsa Wijaya', dept: 'Marketing', clockIn: '09:01', status: 'Terlambat' },
    ],
    [],
  )

  const metrics = useMemo(
    () => [
      { label: 'Total Karyawan', value: String(report.totalEmployees), note: 'Data realtime', trend: '+12%' },
      { label: 'Kehadiran Hari Ini', value: `${report.attendanceRate}%`, note: 'Target 95%', trend: 'Stabil' },
      { label: 'Cuti Menunggu', value: String(report.pendingLeave), note: 'Perlu approval', trend: 'Perlu aksi' },
      { label: 'Total Payroll', value: formatRupiah(report.payrollTotal), note: 'Periode bulan ini', trend: 'Terkendali' },
    ],
    [report],
  )

  async function loadDashboardData() {
    const reportResponse = await fetch('/api/reports/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (reportResponse.ok) {
      const reportData = await reportResponse.json()
      setReport(reportData)
    }

    setLoadingEmployees(true)
    const employeeResponse = await fetch('/api/employees', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (employeeResponse.ok) {
      const employeeData = await employeeResponse.json()
      setEmployees(employeeData)
      setSalaryStructures((prev) =>
        prev.length > 0
          ? prev
          : employeeData.map((employee) => ({
              employeeId: employee.id,
              employeeName: employee.name,
              department: employee.department || '-',
              baseSalary: 8000000,
              allowance: 1000000,
              deduction: 250000,
            })),
      )
      if (!salaryForm.employeeId && employeeData.length > 0) {
        setSalaryForm((current) => ({ ...current, employeeId: String(employeeData[0].id) }))
      }
    }
    setLoadingEmployees(false)
  }

  useEffect(() => {
    if (!token) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token || activePage !== 'payroll') return
    loadPayrollRuns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activePage])

  useEffect(() => {
    if (!editSalaryModal.open) return

    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setEditingEmployeeId(null)
        setEditSalaryModal({
          open: false,
          employeeId: '',
          employeeName: '',
          baseSalary: 0,
          allowance: 0,
          deduction: 0,
        })
        setPayrollMessage('Mode edit dibatalkan')
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [editSalaryModal.open])

  const handleLogin = async (event) => {
    event.preventDefault()
    setError('')
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nik, password }),
    })
    if (!response.ok) {
      setError('Login gagal. Cek NIK/password dan pastikan backend aktif.')
      return
    }
    const data = await response.json()
    setToken(data.token)
    setRole(data.role)
    localStorage.setItem('hris_token', data.token)
    localStorage.setItem('hris_role', data.role)
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
    setSalaryForm({
      employeeId: defaultEmployeeId,
      baseSalary: 8000000,
      allowance: 1000000,
      deduction: 250000,
    })
  }

  async function loadPayrollRuns() {
    const response = await fetch('/api/payroll/runs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return
    const data = await response.json()
    setPayrollRuns(data)
    if (data.length > 0 && !selectedRunId) {
      setSelectedRunId(data[0].id)
      await loadPayrollDetail(data[0].id)
    }
  }

  async function loadPayrollDetail(runId) {
    const response = await fetch(`/api/payroll/runs/${runId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return
    const data = await response.json()
    setPayrollDetail(data)
    setSelectedPayrollItemId(data.items?.[0]?.id || null)
  }

  const handleRunPayroll = async () => {
    setRunningPayroll(true)
    setPayrollMessage('')
    const response = await fetch('/api/payroll/runs/generate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ periodMonth: new Date().toISOString().slice(0, 7) + '-01' }),
    })
    const data = await response.json()
    if (response.ok) {
      setPayrollMessage(`Draft payroll berhasil dibuat (Run #${data.id})`)
      await loadPayrollRuns()
      await loadPayrollDetail(data.id)
      await loadDashboardData()
    } else {
      setPayrollMessage(data.message || 'Gagal menjalankan payroll')
    }
    setRunningPayroll(false)
  }

  const handleFinalizeRun = async () => {
    if (!selectedRunId) return
    setFinalizingPayroll(true)
    const response = await fetch(`/api/payroll/runs/${selectedRunId}/finalize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json()
    if (response.ok) {
      setPayrollMessage(`Run #${data.id} berhasil difinalisasi`)
      await loadPayrollRuns()
      await loadPayrollDetail(selectedRunId)
      await loadDashboardData()
    } else {
      setPayrollMessage(data.message || 'Gagal finalize payroll run')
    }
    setFinalizingPayroll(false)
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
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
                  <button>Lihat semua</button>
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
                <h3>Approval Workflow Digital</h3>
                <ul className="timeline">
                  <li>
                    <strong>Cuti Tahunan - Budi Santoso</strong>
                    <p>Menunggu approval Manager (2 hari)</p>
                  </li>
                  <li>
                    <strong>Lembur - Intan Lestari</strong>
                    <p>Disetujui Manager, menunggu Finance</p>
                  </li>
                  <li>
                    <strong>Izin Sakit - Dini Prameswari</strong>
                    <p>Dokumen lengkap, siap finalisasi HRD</p>
                  </li>
                </ul>
              </article>

              <article className="panel highlight">
                <h3>Payroll Basic (Bulan Ini)</h3>
                <p>Total Penggajian</p>
                <strong>{formatRupiah(report.payrollTotal)}</strong>
                <div className="payroll-kpis">
                  <div>
                    <span>Allowance</span>
                    <b>Rp 186 jt</b>
                  </div>
                  <div>
                    <span>Deduction</span>
                    <b>Rp 42 jt</b>
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
            onRunPayroll={handleRunPayroll}
            onFinalizeRun={handleFinalizeRun}
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
            salaryForm={salaryForm}
            editingEmployeeId={editingEmployeeId}
            editSalaryModal={editSalaryModal}
            onSalaryFormChange={setSalaryForm}
            onSaveSalaryStructure={() => {
              const employee = employees.find((item) => String(item.id) === String(salaryForm.employeeId))
              if (!employee) return
              if (
                Number.isNaN(Number(salaryForm.baseSalary)) ||
                Number.isNaN(Number(salaryForm.allowance)) ||
                Number.isNaN(Number(salaryForm.deduction))
              ) {
                setPayrollMessage('Nominal gaji wajib berupa angka yang valid')
                return
              }
              if (
                Number(salaryForm.baseSalary) < 0 ||
                Number(salaryForm.allowance) < 0 ||
                Number(salaryForm.deduction) < 0
              ) {
                setPayrollMessage('Nominal gaji, tunjangan, dan potongan tidak boleh minus')
                return
              }
              setSalaryStructures((prev) => {
                const exists = prev.some((item) => item.employeeId === employee.id)
                if (!exists) {
                  return [
                    ...prev,
                    {
                      employeeId: employee.id,
                      employeeName: employee.name,
                      department: employee.department || '-',
                      baseSalary: Number(salaryForm.baseSalary),
                      allowance: Number(salaryForm.allowance),
                      deduction: Number(salaryForm.deduction),
                    },
                  ]
                }
                return prev.map((item) =>
                  item.employeeId === employee.id
                    ? {
                        ...item,
                        baseSalary: Number(salaryForm.baseSalary),
                        allowance: Number(salaryForm.allowance),
                        deduction: Number(salaryForm.deduction),
                      }
                    : item,
                )
              })
              setPayrollMessage(`Salary structure untuk ${employee.name} berhasil disimpan`)
              resetSalaryForm()
            }}
            onEditSalaryStructure={(item) => {
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
            }}
            onCancelEditSalary={() => {
              setEditingEmployeeId(null)
              setEditSalaryModal({
                open: false,
                employeeId: '',
                employeeName: '',
                baseSalary: 0,
                allowance: 0,
                deduction: 0,
              })
              setPayrollMessage('Mode edit dibatalkan')
            }}
            onEditSalaryModalChange={setEditSalaryModal}
            onSaveEditedSalary={() => {
              if (
                Number(editSalaryModal.baseSalary) < 0 ||
                Number(editSalaryModal.allowance) < 0 ||
                Number(editSalaryModal.deduction) < 0
              ) {
                setPayrollMessage('Nominal gaji, tunjangan, dan potongan tidak boleh minus')
                return
              }
              setSalaryStructures((prev) =>
                prev.map((item) =>
                  item.employeeId === Number(editSalaryModal.employeeId)
                    ? {
                        ...item,
                        baseSalary: Number(editSalaryModal.baseSalary),
                        allowance: Number(editSalaryModal.allowance),
                        deduction: Number(editSalaryModal.deduction),
                      }
                    : item,
                ),
              )
              setEditSalaryModal((prev) => ({ ...prev, open: false }))
              setPayrollMessage(`Salary structure untuk ${editSalaryModal.employeeName} berhasil diupdate`)
              setEditingEmployeeId(null)
            }}
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
  onRunPayroll,
  onFinalizeRun,
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
  salaryForm,
  editingEmployeeId,
  editSalaryModal,
  onSalaryFormChange,
  onSaveSalaryStructure,
  onEditSalaryStructure,
  onCancelEditSalary,
  onEditSalaryModalChange,
  onSaveEditedSalary,
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
    return (
      <section className="feature-layout">
        <article className="panel">
          <h3>Absensi Digital (GPS + Selfie)</h3>
          <div className="quick-grid">
            <div className="quick-card">
              <span>Total Kehadiran Hari Ini</span>
              <strong>{report.attendanceRate}%</strong>
            </div>
            <div className="quick-card">
              <span>Status Sinkronisasi</span>
              <strong>Realtime Aktif</strong>
            </div>
            <div className="quick-card">
              <span>Validasi Lokasi</span>
              <strong>Radius Kantor</strong>
            </div>
          </div>
        </article>
      </section>
    )
  }

  if (activePage === 'cuti') {
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
              <span>Alur Persetujuan</span>
              <strong>Manager → HRD</strong>
            </div>
            <div className="quick-card">
              <span>SLA Approval</span>
              <strong>Max 2 Hari</strong>
            </div>
          </div>
        </article>
      </section>
    )
  }

  if (activePage === 'payroll') {
    const filteredPayrollItems = payrollDetail
      ? payrollDetail.items.filter((item) =>
          item.employee_name.toLowerCase().includes(payrollDetailSearch.toLowerCase()),
        )
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
                <div className="payroll-actions">
                  <button className="primary-btn" disabled={runningPayroll} onClick={onRunPayroll}>
                    {runningPayroll ? 'Membuat draft...' : 'Generate Draft Run'}
                  </button>
                  <button
                    className="primary-btn secondary-btn"
                    disabled={finalizingPayroll || !selectedRunId}
                    onClick={onFinalizeRun}
                  >
                    {finalizingPayroll ? 'Finalizing...' : 'Finalize Run'}
                  </button>
                </div>
              </div>
              <p>Total payroll bulan ini: {formatRupiah(report.payrollTotal)}</p>
              {payrollMessage ? <p className="message">{payrollMessage}</p> : null}
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
                      <td>{run.status}</td>
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
                          <td>{formatRupiah(item.net_amount)}</td>
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
              <p className="section-note">Form Salary Structure</p>
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
                      <td>
                        <button className="small-btn" onClick={() => onEditSalaryStructure(item)}>
                          Edit
                        </button>
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
    return (
      <section className="feature-layout">
        <article className="panel">
          <h3>Reporting HR</h3>
          <div className="quick-grid">
            <div className="quick-card">
              <span>Total Karyawan</span>
              <strong>{report.totalEmployees}</strong>
            </div>
            <div className="quick-card">
              <span>Kehadiran</span>
              <strong>{report.attendanceRate}%</strong>
            </div>
            <div className="quick-card">
              <span>Total Payroll</span>
              <strong>{formatRupiah(report.payrollTotal)}</strong>
            </div>
          </div>
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

export default App
