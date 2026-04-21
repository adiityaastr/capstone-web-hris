# Setup Guide HRIS Project

Panduan ini untuk clone, install, setup database, dan menjalankan project HRIS dari nol.

## 1) Prasyarat

Pastikan sudah install:

- Git
- Node.js (disarankan v20+)
- npm (ikut Node.js)
- MySQL Server (disarankan 8.x)

Cek versi:

```bash
node -v
npm -v
git --version
```

## 2) Clone Repository

```bash
git clone https://github.com/adiityaastr/capstone-web-hris.git
cd capstone-web-hris
```

## 3) Install Dependencies

```bash
npm install
```

## 4) Setup Environment Backend

Copy `backend/.env.example` menjadi `backend/.env`, lalu isi:

```env
PORT=5000
JWT_SECRET=super-secret-key
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=hris_db
```

## 5) Setup Database

Jalankan:

```bash
npm run db:setup
```

Script akan:
- membuat database `hris_db` (jika belum ada),
- menjalankan schema inti (`backend/schema.sql`),
- menjalankan schema payroll (`backend/payroll-schema.sql`, jika ada),
- menjalankan seed data (`backend/seed.sql`).

## 6) Jalankan Aplikasi

Frontend + backend bersamaan:

```bash
npm run dev:all
```

URL default:
- Frontend: `http://localhost:5173` (atau 5174/5175 jika bentrok)
- Backend: `http://localhost:5000`

Health check backend:
- `http://localhost:5000/health`

## 7) Login Default

- NIK: `ADM001`
- Password: `admin123`

## 8) Validasi Sebelum Commit

```bash
npm run lint
npm run build
```

## 9) Workflow Lanjutan

```bash
git pull origin main
git checkout -b feat/nama-fitur
```

Setelah selesai coding:

```bash
npm run lint
npm run build
git add .
git commit -m "feat: deskripsi perubahan"
git push -u origin feat/nama-fitur
```

## 10) Troubleshooting

- `Unknown database 'hris_db'`:
  - Jalankan ulang `npm run db:setup`.
- `ECONNREFUSED` MySQL:
  - Pastikan MySQL berjalan dan cek `DB_HOST/DB_PORT` di `backend/.env`.
- Frontend tidak bisa dibuka:
  - Pastikan `npm run dev:all` masih aktif.
  - Cek port yang dipakai Vite di output terminal.
- Login gagal:
  - Jalankan `npm run db:setup` agar seed user terpasang ulang.

---

Panduan OS spesifik:

- Windows PowerShell: `docs/setup-windows.md`
- Linux/macOS: `docs/setup-unix.md`
