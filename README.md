# HRIS Cloud (Web + Backend API)

Implementasi fase 1 untuk HRIS:
- Web Dashboard (React + Vite)
- Backend API (Node.js + Express + MySQL + JWT)
- Modul utama: Auth, Employee, Attendance, Leave, Payroll, Reporting

## Setup Cepat

Untuk panduan setup lengkap (clone, env, db, run, troubleshooting):
- `SETUP.md`
- Windows PowerShell: `docs/setup-windows.md`
- Linux/macOS: `docs/setup-unix.md`

## 1) Setup Environment

1. Salin `backend/.env.example` menjadi `backend/.env`
2. Atur nilai:
   - `PORT=5000`
   - `JWT_SECRET=...`
   - `DB_HOST=localhost`
   - `DB_PORT=3306`
   - `DB_USER=root`
   - `DB_PASSWORD=...`
   - `DB_NAME=hris_db`

## 2) Setup Database

Jalankan SQL berikut ke MySQL:
- `backend/schema.sql`
- `backend/seed.sql`
- Opsional untuk payroll lanjutan:
  - `backend/payroll-schema.sql`
  - lihat rancangan teknis di `backend/payroll-blueprint.md`

Seeder menambahkan akun default:
- NIK: `ADM001`
- Password: `admin123`

## 3) Menjalankan Aplikasi

- Frontend saja:
  - `npm run dev`
- Backend API saja:
  - `npm run dev:server`
- Frontend + Backend bersamaan:
  - `npm run dev:all`

Frontend menggunakan proxy ke backend via `/api`.

## 4) Endpoint API Utama

- Auth:
  - `POST /auth/login`
  - `POST /auth/logout`
- Employee:
  - `GET /employees`
  - `POST /employees`
  - `PUT /employees/:id`
  - `DELETE /employees/:id`
- Attendance:
  - `POST /attendance/clockin`
  - `POST /attendance/clockout`
- Leave:
  - `POST /leave`
  - `PUT /leave/approve`
- Payroll:
  - `POST /payroll/run`
  - `GET /payslip/:id`
- Reporting:
  - `GET /reports/dashboard`
