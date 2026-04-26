# HRIS Project Architecture

Panduan struktur folder dan modularisasi HRIS untuk maintainability dan scalability.

## Struktur Folder Target

```
my-react-app/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── employees.js
│   │   │   ├── attendance.js
│   │   │   ├── leave.js
│   │   │   ├── payroll.js
│   │   │   └── reports.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── employeeController.js
│   │   │   ├── attendanceController.js
│   │   │   ├── leaveController.js
│   │   │   ├── payrollController.js
│   │   │   └── reportController.js
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── employeeService.js
│   │   │   ├── attendanceService.js
│   │   │   ├── leaveService.js
│   │   │   ├── payrollService.js
│   │   │   └── reportService.js
│   │   ├── utils/
│   │   │   ├── auditLog.js
│   │   │   ├── validation.js
│   │   │   ├── errorHandler.js
│   │   │   └── constants.js
│   │   ├── db.js (database connection)
│   │   ├── middleware.js (auth, role checks)
│   │   ├── server.js (express setup & routes registration)
│   │   └── setup-db.js (database initialization)
│   ├── migrations/ (future: versioned schema changes)
│   ├── .env.example
│   └── README.md (Backend setup & API docs)
│
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── pages/
│   │   │   │   └── LoginPage.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.js
│   │   │   ├── context/
│   │   │   │   └── AuthContext.jsx
│   │   │   └── README.md
│   │   │
│   │   ├── dashboard/
│   │   │   ├── pages/
│   │   │   │   └── DashboardPage.jsx
│   │   │   ├── components/
│   │   │   │   ├── MetricsCard.jsx
│   │   │   │   ├── StatusOverview.jsx
│   │   │   │   └── PendingActions.jsx
│   │   │   └── README.md
│   │   │
│   │   ├── employees/
│   │   │   ├── pages/
│   │   │   │   └── EmployeesPage.jsx
│   │   │   ├── components/
│   │   │   │   ├── EmployeeList.jsx
│   │   │   │   ├── EmployeeForm.jsx
│   │   │   │   └── EmployeeModal.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useEmployees.js
│   │   │   └── README.md
│   │   │
│   │   ├── attendance/
│   │   │   ├── pages/
│   │   │   │   └── AttendancePage.jsx
│   │   │   ├── components/
│   │   │   │   ├── AttendanceTable.jsx
│   │   │   │   └── AttendanceStats.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useAttendance.js
│   │   │   └── README.md
│   │   │
│   │   ├── leave/
│   │   │   ├── pages/
│   │   │   │   └── LeavePage.jsx
│   │   │   ├── components/
│   │   │   │   ├── LeaveList.jsx
│   │   │   │   ├── LeaveRequestForm.jsx
│   │   │   │   └── LeaveStats.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useLeave.js
│   │   │   └── README.md
│   │   │
│   │   ├── payroll/
│   │   │   ├── pages/
│   │   │   │   ├── PayrollPage.jsx
│   │   │   │   └── SalaryStructurePage.jsx
│   │   │   ├── components/
│   │   │   │   ├── PayrollRuns.jsx
│   │   │   │   ├── PayrollDetail.jsx
│   │   │   │   ├── SalaryForm.jsx
│   │   │   │   ├── ApprovalWorkflow.jsx
│   │   │   │   └── AuditLog.jsx
│   │   │   ├── hooks/
│   │   │   │   ├── usePayroll.js
│   │   │   │   └── useSalaryStructure.js
│   │   │   ├── utils/
│   │   │   │   └── payrollCalculations.js
│   │   │   └── README.md
│   │   │
│   │   ├── reports/
│   │   │   ├── pages/
│   │   │   │   └── ReportsPage.jsx
│   │   │   ├── components/
│   │   │   │   ├── DashboardCharts.jsx
│   │   │   │   ├── SalaryDistributionChart.jsx
│   │   │   │   ├── LeaveStatsChart.jsx
│   │   │   │   └── PayrollCostChart.jsx
│   │   │   ├── hooks/
│   │   │   │   └── useReports.js
│   │   │   ├── utils/
│   │   │   │   └── exportPDF.js
│   │   │   └── README.md
│   │   │
│   │   └── roleManagement/
│   │       ├── pages/
│   │       │   └── RoleManagementPage.jsx
│   │       ├── components/
│   │       │   └── RoleTable.jsx
│   │       └── README.md
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Topbar.jsx
│   │   │   │   └── MainLayout.jsx
│   │   │   ├── Modal/
│   │   │   │   ├── Modal.jsx
│   │   │   │   └── ConfirmDialog.jsx
│   │   │   ├── Table/
│   │   │   │   └── DataTable.jsx
│   │   │   ├── Button/
│   │   │   │   ├── PrimaryButton.jsx
│   │   │   │   ├── SecondaryButton.jsx
│   │   │   │   └── IconButton.jsx
│   │   │   ├── Badge/
│   │   │   │   └── StatusBadge.jsx
│   │   │   └── Loader/
│   │   │       └── Spinner.jsx
│   │   ├── hooks/
│   │   │   ├── useApi.js
│   │   │   ├── usePagination.js
│   │   │   └── useLocalStorage.js
│   │   ├── utils/
│   │   │   ├── api.js (API client)
│   │   │   ├── formatters.js (number, date formatting)
│   │   │   ├── validators.js (input validation)
│   │   │   └── constants.js (global constants)
│   │   ├── styles/
│   │   │   ├── variables.css
│   │   │   ├── base.css
│   │   │   └── animations.css
│   │   └── README.md
│   │
│   ├── App.jsx (main entry, routing setup)
│   ├── App.css (migrated to shared/styles/)
│   ├── main.jsx
│   ├── index.css
│   └── README.md (Frontend architecture)
│
├── docs/
│   ├── API.md (Detailed API documentation)
│   ├── DATABASE.md (Schema & relationships)
│   ├── MODULES.md (Per-module documentation)
│   ├── WORKFLOW.md (Business processes)
│   └── DEPLOYMENT.md (Deployment guide)
│
├── ARCHITECTURE.md (this file)
├── AGENTS.md (AI coding guidelines)
├── package.json
├── vite.config.js
└── .env.example
```

## Module Breakdown

### Backend Modules

#### 1. **Auth Module** (`routes/auth.js`, `controllers/authController.js`, `services/authService.js`)
- Login/Logout
- JWT token management
- Password validation
- User role assignment

#### 2. **Employee Module** (`routes/employees.js`, etc.)
- CRUD operations
- Department/Position association
- Contract management
- Active/Inactive status

#### 3. **Attendance Module**
- Clock in/Clock out
- Daily attendance tracking
- Status calculation (Aktif, Terlambat, Meeting)
- Monthly attendance report

#### 4. **Leave Module**
- Leave request CRUD
- Leave type management
- Approval workflow
- Leave balance tracking

#### 5. **Payroll Module**
- Salary profile management
- Salary component CRUD
- Payroll run generation
- Approval workflow (Draft → Reviewed → Approved → Finalized)
- Validation checks
- Audit logging

#### 6. **Reports Module**
- Dashboard metrics
- Salary distribution analysis
- Leave statistics
- Attendance trends
- Payroll cost breakdown

### Frontend Modules

Setiap modul frontend memiliki struktur yang konsisten:
- **pages/**: Page-level components (full screen views)
- **components/**: Reusable components untuk modul
- **hooks/**: Custom React hooks (usePayroll, useEmployees, dll)
- **utils/**: Helper functions & calculations
- **context/** (opsional): State management dengan Context API

## Key Design Patterns

1. **Service Layer**: Semua database queries ada di `services/`
2. **Controller Layer**: Business logic & data transformation
3. **Route Layer**: HTTP endpoint definitions
4. **Custom Hooks**: Data fetching & state management di frontend
5. **Shared Utils**: Common functions (formatters, validators)
6. **Constants**: Magic strings defined once, reused everywhere

## Benefits

✅ **Maintainability**: Easy to find code, clear responsibilities
✅ **Scalability**: Add new modules without affecting existing ones
✅ **Testability**: Each layer can be tested independently
✅ **Reusability**: Shared components & utils across modules
✅ **Onboarding**: New developers understand structure quickly
✅ **Performance**: Tree-shaking & code splitting per module
✅ **Documentation**: Per-module README files

## Development Workflow

1. Check relevant module README
2. Follow the module structure convention
3. Add unit tests alongside code
4. Update API docs if adding endpoints
5. Ensure lint & build pass
6. Create PR with clear description

## Future Improvements

- [ ] Add API response middleware for consistent format
- [ ] Add input validation middleware (Zod/Joi)
- [ ] Add request/response logging
- [ ] Add rate limiting
- [ ] Add caching layer
- [ ] Add WebSocket for real-time updates
- [ ] Add E2E testing framework
- [ ] Add performance monitoring
