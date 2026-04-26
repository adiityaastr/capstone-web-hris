# Frontend Module Architecture

Panduan struktur frontend modular untuk HRIS React application.

## Struktur Folder Frontend

```
src/
├── modules/                         # Feature modules
│   ├── auth/
│   │   ├── pages/
│   │   │   └── LoginPage.jsx       # Login form & logic
│   │   ├── hooks/
│   │   │   └── useAuth.js          # Auth state & functions
│   │   ├── context/
│   │   │   └── AuthContext.jsx     # Auth context provider
│   │   └── README.md
│   │
│   ├── dashboard/
│   │   ├── pages/
│   │   │   └── DashboardPage.jsx
│   │   ├── components/
│   │   │   ├── MetricsCard.jsx
│   │   │   ├── StatusOverview.jsx
│   │   │   └── PendingActions.jsx
│   │   ├── hooks/
│   │   │   └── useDashboard.js
│   │   └── README.md
│   │
│   ├── employees/
│   │   ├── pages/
│   │   │   └── EmployeesPage.jsx
│   │   ├── components/
│   │   │   ├── EmployeeList.jsx
│   │   │   ├── EmployeeForm.jsx
│   │   │   └── EmployeeModal.jsx
│   │   ├── hooks/
│   │   │   └── useEmployees.js
│   │   └── README.md
│   │
│   ├── attendance/
│   ├── leave/
│   ├── payroll/
│   │   ├── pages/
│   │   │   ├── PayrollPage.jsx
│   │   │   └── SalaryStructurePage.jsx
│   │   ├── components/
│   │   │   ├── PayrollRuns.jsx
│   │   │   ├── PayrollDetail.jsx
│   │   │   ├── SalaryForm.jsx
│   │   │   ├── ApprovalWorkflow.jsx
│   │   │   └── AuditLog.jsx
│   │   ├── hooks/
│   │   │   ├── usePayroll.js
│   │   │   └── useSalaryStructure.js
│   │   ├── utils/
│   │   │   └── payrollCalculations.js
│   │   └── README.md
│   │
│   ├── reports/
│   │   ├── pages/
│   │   │   └── ReportsPage.jsx
│   │   ├── components/
│   │   │   ├── DashboardCharts.jsx
│   │   │   ├── SalaryDistributionChart.jsx
│   │   │   ├── LeaveStatsChart.jsx
│   │   │   └── PayrollCostChart.jsx
│   │   ├── hooks/
│   │   │   └── useReports.js
│   │   ├── utils/
│   │   │   └── exportPDF.js
│   │   └── README.md
│   │
│   └── roleManagement/
│       ├── pages/
│       │   └── RoleManagementPage.jsx
│       ├── components/
│       │   └── RoleTable.jsx
│       └── README.md
│
├── shared/                          # Reusable across modules
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Topbar.jsx
│   │   │   ├── MainLayout.jsx
│   │   │   └── index.jsx
│   │   ├── Modal/
│   │   │   ├── Modal.jsx
│   │   │   ├── ConfirmDialog.jsx
│   │   │   └── index.jsx
│   │   ├── Table/
│   │   │   ├── DataTable.jsx
│   │   │   └── index.jsx
│   │   ├── Button/
│   │   │   ├── PrimaryButton.jsx
│   │   │   ├── SecondaryButton.jsx
│   │   │   ├── IconButton.jsx
│   │   │   └── index.jsx
│   │   ├── Badge/
│   │   │   ├── StatusBadge.jsx
│   │   │   └── index.jsx
│   │   ├── Loader/
│   │   │   ├── Spinner.jsx
│   │   │   └── index.jsx
│   │   └── index.js
│   │
│   ├── hooks/
│   │   ├── useApi.js       # Data fetching abstraction
│   │   ├── useDebounce.js  # Debouncing input
│   │   ├── useLocalStorage.js
│   │   ├── useFetch.js     # Generic fetch hook
│   │   └── index.js
│   │
│   ├── utils/
│   │   ├── api.js          # API client (centralized axios/fetch)
│   │   ├── formatters.js   # Number, date formatting
│   │   ├── validators.js   # Form validation
│   │   ├── constants.js    # Frontend constants (menus, status colors)
│   │   ├── storage.js      # localStorage utilities
│   │   └── index.js
│   │
│   ├── styles/
│   │   ├── variables.css   # Colors, fonts, spacing
│   │   ├── base.css        # Global styles
│   │   ├── animations.css  # Keyframes
│   │   └── responsive.css  # Media queries
│   │
│   └── README.md
│
├── App.jsx                  # Main app component & routing
├── App.css                  # Global styles (move to shared/styles/)
├── main.jsx                 # Entry point
├── index.css                # Base styles
└── README.md                # Frontend docs
```

## Module Pattern

### 1. Hook Pattern (Data Fetching & State)

```javascript
// modules/payroll/hooks/usePayroll.js
import { useState, useEffect } from 'react'
import { api } from '../../../shared/utils/api'

export function usePayroll() {
  const [payrollRuns, setPayrollRuns] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchRuns = async () => {
    try {
      setLoading(true)
      const data = await api.get('/payroll/runs')
      setPayrollRuns(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRuns()
  }, [])

  return { payrollRuns, loading, error, refetch: fetchRuns }
}
```

### 2. Component Pattern

```javascript
// modules/payroll/components/PayrollRuns.jsx
import { usePayroll } from '../hooks/usePayroll'
import { DataTable } from '../../../shared/components'

export function PayrollRuns() {
  const { payrollRuns, loading } = usePayroll()

  return (
    <div>
      <h3>Payroll Runs</h3>
      {loading ? <Spinner /> : <DataTable data={payrollRuns} />}
    </div>
  )
}
```

### 3. Page Pattern

```javascript
// modules/payroll/pages/PayrollPage.jsx
import { useState } from 'react'
import { PayrollRuns } from '../components/PayrollRuns'
import { PayrollDetail } from '../components/PayrollDetail'

export function PayrollPage() {
  const [selectedRunId, setSelectedRunId] = useState(null)

  return (
    <div>
      <PayrollRuns onSelect={setSelectedRunId} />
      {selectedRunId && <PayrollDetail runId={selectedRunId} />}
    </div>
  )
}
```

## Shared Utils

### API Client

```javascript
// shared/utils/api.js
export const api = {
  async get(path) {
    const token = localStorage.getItem('hris_token')
    const res = await fetch(`/api${path}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async post(path, data) {
    // Similar implementation
  }
}

// Usage in components:
const data = await api.get('/employees')
```

### Constants

```javascript
// shared/utils/constants.js
export const MENUS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'employees', label: 'Karyawan' },
  // ...
]

export const PAYROLL_STATUS_COLOR = {
  draft: '#FFA07A',
  reviewed: '#FFD700',
  approved: '#90EE90',
  finalized: '#87CEEB',
}

export const LEAVE_TYPES = [
  'Cuti Tahunan',
  'Izin Sakit',
  'Izin',
]
```

## Component Example: Refactoring

### Before (App.jsx, 1700+ lines)

```javascript
function App() {
  const [activePage, setActivePage] = useState('dashboard')
  // ... 50+ state variables
  // ... 1600 lines of mixed logic & JSX
}
```

### After: Modular Structure

**modules/payroll/pages/PayrollPage.jsx**
```javascript
export function PayrollPage() {
  const [payrollTab, setPayrollTab] = useState('run')
  const { payrollRuns, selectedRunId, setSelectedRunId } = usePayroll()

  return (
    <section>
      <PayrollRunsList runs={payrollRuns} onSelect={setSelectedRunId} />
      {selectedRunId && <PayrollDetail runId={selectedRunId} />}
    </section>
  )
}
```

**modules/payroll/hooks/usePayroll.js**
```javascript
export function usePayroll() {
  const [payrollRuns, setPayrollRuns] = useState([])
  const [selectedRunId, setSelectedRunId] = useState(null)

  useEffect(() => {
    api.get('/payroll/runs').then(setPayrollRuns)
  }, [])

  return { payrollRuns, selectedRunId, setSelectedRunId }
}
```

**src/App.jsx (after refactoring)**
```javascript
import { LoginPage } from './modules/auth/pages/LoginPage'
import { DashboardPage } from './modules/dashboard/pages/DashboardPage'
import { PayrollPage } from './modules/payroll/pages/PayrollPage'
import { MainLayout } from './shared/components/Layout/MainLayout'

function App() {
  const { token } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')

  if (!token) return <LoginPage />

  return (
    <MainLayout activePage={activePage} onChange={setActivePage}>
      {activePage === 'dashboard' && <DashboardPage />}
      {activePage === 'payroll' && <PayrollPage />}
      {/* ... other pages ... */}
    </MainLayout>
  )
}
```

## Key Principles

### 1. Single Responsibility
- Each component does ONE thing
- Each hook manages ONE piece of state/logic
- Each file < 200 lines (aim for < 100)

### 2. DRY (Don't Repeat Yourself)
- Reuse components from `shared/`
- Extract common logic to hooks
- Use constants, not magic strings

### 3. Performance
- Use `useCallback` for event handlers
- Memoize expensive computations
- Lazy load routes for better bundle

### 4. Readability
- Clear, descriptive names
- Comments for complex logic
- Consistent folder structure

## Migration Strategy

### Phase 1: Extract Shared
- [ ] Move Layout components to `shared/components/Layout`
- [ ] Move utilities to `shared/utils` (formatters, api client, constants)
- [ ] Move styles to `shared/styles`

### Phase 2: Extract Hooks
- [ ] Create `useAuth` hook for auth logic
- [ ] Create `useDashboard` hook for dashboard data
- [ ] Create `usePayroll`, `useEmployees`, etc.

### Phase 3: Extract Pages
- [ ] Create `modules/dashboard/pages/DashboardPage.jsx`
- [ ] Create `modules/employees/pages/EmployeesPage.jsx`
- [ ] Create `modules/payroll/pages/PayrollPage.jsx`
- [ ] Create `modules/reports/pages/ReportsPage.jsx`

### Phase 4: Extract Components
- [ ] Break down each page into smaller components
- [ ] Move repeated JSX patterns to reusable components

### Phase 5: Clean Up
- [ ] Delete old App.jsx
- [ ] Update imports throughout
- [ ] Remove duplicate code
- [ ] Verify all tests pass

## Checklist

- [ ] Folder structure created
- [ ] Shared components extracted
- [ ] Shared hooks created
- [ ] Shared utils created
- [ ] Auth module modularized
- [ ] Dashboard module modularized
- [ ] Employees module modularized
- [ ] Payroll module modularized
- [ ] Reports module modularized
- [ ] App.jsx simplified
- [ ] Lint passes (0 errors)
- [ ] Build succeeds
- [ ] All pages work correctly
