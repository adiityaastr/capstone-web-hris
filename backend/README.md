# Backend Module Architecture

Panduan struktur backend modular untuk HRIS.

## Struktur Folder Backend

```
backend/src/
├── utils/                    # Shared utilities (utils/index.js untuk convenient imports)
│   ├── constants.js         # Global constants & enums
│   ├── errorHandler.js      # Custom error classes & error middleware
│   ├── validators.js        # Input validation functions
│   ├── formatters.js        # Data formatting utilities
│   └── index.js             # Re-exports semua utils
│
├── services/                # Business logic layer (database operations, calculations)
│   ├── authService.js       # Login, token, user validation
│   ├── employeeService.js   # Employee CRUD & lookup
│   ├── attendanceService.js # Attendance tracking
│   ├── leaveService.js      # Leave request management
│   ├── payrollService.js    # Payroll generation, validation, approvals
│   ├── reportService.js     # Reports & analytics queries
│   └── index.js             # Re-exports
│
├── controllers/             # Request handlers (request → service → response)
│   ├── authController.js    # Login/logout handlers
│   ├── employeeController.js# Employee endpoints
│   ├── attendanceController.js
│   ├── leaveController.js
│   ├── payrollController.js
│   ├── reportController.js
│   └── index.js             # Re-exports
│
├── routes/                  # Express route definitions
│   ├── auth.js              # POST /auth/*
│   ├── employees.js         # GET/POST/PUT/DELETE /employees
│   ├── attendance.js        # GET/POST /attendance/*
│   ├── leave.js             # GET/POST /leave/*
│   ├── payroll.js           # GET/POST /payroll/*
│   ├── reports.js           # GET /reports/*
│   └── index.js             # Register all routes
│
├── middleware.js            # Auth, role checks, error handling
├── db.js                    # Database connection pool
├── server.js                # Express app setup & route registration
├── setup-db.js              # Database initialization
└── README.md                # This file
```

## Module Pattern

Setiap fitur mengikuti pola: **Route → Controller → Service → Database**

### 1. Service Layer (`services/payrollService.js`)
```javascript
// Business logic & database queries
export async function generatePayrollRun(periodMonth) {
  // Query DB
  // Process data
  // Return results
}

export async function validatePayrollRun(runId) {
  // Validation checks
  // Return errors or null
}
```

### 2. Controller Layer (`controllers/payrollController.js`)
```javascript
// Request handlers
export async function generateRun(req, res, next) {
  try {
    validateRequired(req.body.periodMonth, 'Period Month')
    const result = await generatePayrollRun(req.body.periodMonth)
    res.status(201).json(result)
  } catch (err) {
    next(err) // Pass to errorHandler
  }
}
```

### 3. Routes Layer (`routes/payroll.js`)
```javascript
// Express route definitions
const router = express.Router()

router.post('/runs/generate', 
  authRequired, 
  roleRequired('HRD', 'Finance'), 
  generateRun
)

export default router
```

### 4. Server Setup (`server.js`)
```javascript
// Mount all routes
import * as payrollRoutes from './routes/payroll.js'
app.use('/payroll', payrollRoutes.default)
```

## Key Principles

### 1. Separation of Concerns
- **Service**: Database & business logic
- **Controller**: HTTP handling (parsing input, formatting output)
- **Routes**: Endpoint definitions

### 2. Error Handling
```javascript
// Use custom error classes from utils/errorHandler.js
throw new ValidationError('Invalid input')
throw new AuthError('Not logged in')
throw new NotFoundError('User')
throw new AppError('Generic error', 500)

// Caught by errorHandler middleware
```

### 3. Constants & Enums
```javascript
// Use constants from utils/constants.js, NOT hardcoded strings
import { PAYROLL_STATUS, LEAVE_TYPES } from '../utils/index.js'

if (run.status === PAYROLL_STATUS.DRAFT) { ... }
if (leave.type === LEAVE_TYPES.CUTI_TAHUNAN) { ... }
```

### 4. Validation
```javascript
// Always validate inputs in controller/service
import { validateRequired, validateNumber } from '../utils/validators.js'

validateRequired(req.body.name, 'Employee Name')
validateNumber(salary, 'Salary', { min: 0 })
```

### 5. Consistent Response Format
```javascript
// Success
res.status(200).json({ data: ..., message: 'OK' })

// Error (handled by errorHandler middleware)
throw new AppError('Message', 400)
```

## Refactoring server.js Strategy

Current `server.js` (943 lines) contains:
- Route definitions (60%)
- Controllers (30%)
- Middleware (5%)
- Error handling (5%)

### Step-by-step Refactoring:

1. **Extract Services** (Done)
   - Move database queries to `services/`
   - Keep SQL in one place per domain

2. **Extract Controllers** (Next)
   - Move request handlers to `controllers/`
   - Keep business logic calls

3. **Extract Routes** (Next)
   - Move route definitions to `routes/`
   - Keep role checks & middleware

4. **Update server.js** (Final)
   - Import routes & register them
   - Setup middleware
   - Error handling
   - Server listen

## Example: Refactoring Payroll Module

### Before (server.js, 200 lines)
```javascript
app.get('/payroll/runs', authRequired, async (req, res) => {
  try {
    const runs = await query('SELECT * FROM payroll_runs ORDER BY id DESC')
    res.json(runs)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

app.post('/payroll/runs/generate', authRequired, roleRequired('HRD'), async (req, res) => {
  // 50 lines of logic
})
```

### After: 3 files

**services/payrollService.js**
```javascript
export async function getPayrollRuns() {
  return await query('SELECT * FROM payroll_runs ORDER BY id DESC')
}

export async function generatePayrollRun(periodMonth) {
  // 50 lines of business logic
}
```

**controllers/payrollController.js**
```javascript
export async function listRuns(req, res, next) {
  try {
    const runs = await getPayrollRuns()
    res.json(runs)
  } catch (err) {
    next(err)
  }
}

export async function generateRun(req, res, next) {
  try {
    validateRequired(req.body.periodMonth)
    const result = await generatePayrollRun(req.body.periodMonth)
    res.status(201).json(result)
  } catch (err) {
    next(err)
  }
}
```

**routes/payroll.js**
```javascript
import { listRuns, generateRun } from '../controllers/payrollController.js'
import { authRequired, roleRequired } from '../middleware.js'

const router = express.Router()

router.get('/runs', authRequired, listRuns)
router.post('/runs/generate', 
  authRequired, 
  roleRequired('HRD', 'Finance'), 
  generateRun
)

export default router
```

## Testing Pattern

Each layer testable independently:

```javascript
// Test service (no HTTP)
await generatePayrollRun('2026-04-01')

// Test controller (mock service)
await generateRun(mockReq, mockRes, mockNext)

// Test route (integration)
await request(app)
  .post('/payroll/runs/generate')
  .send({ periodMonth: '2026-04-01' })
```

## Migration Checklist

- [ ] Extract auth service & controller
- [ ] Extract employee service & controller
- [ ] Extract attendance service & controller
- [ ] Extract leave service & controller
- [ ] Extract payroll service & controller (highest priority)
- [ ] Extract report service & controller
- [ ] Update server.js to import routes
- [ ] Update middleware imports
- [ ] Test all endpoints
- [ ] Run lint & build
- [ ] Update this README with completion

## Benefits of This Structure

✅ **Testability**: Each layer independently testable
✅ **Reusability**: Services can be called from CLI, webhooks, etc.
✅ **Maintainability**: Clear separation of concerns
✅ **Scalability**: Easy to add new modules
✅ **Performance**: Opportunity for caching in services
✅ **Documentation**: Clear where to find code
