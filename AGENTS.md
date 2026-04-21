# AGENTS.md

Panduan ini membantu AI coding agent bekerja konsisten pada project HRIS ini.

## 1) Project Context

- Frontend: React + Vite (`src/`)
- Backend: Node.js + Express (`backend/src/`)
- Database: MySQL
- Domain utama: HRIS (employee, attendance, leave, payroll, reporting)

## 2) Prioritas Saat Mengerjakan Task

1. Jangan merusak fitur yang sudah berjalan.
2. Ikuti pola kode yang sudah ada sebelum membuat pola baru.
3. Utamakan perubahan kecil dan terfokus.
4. Pastikan perubahan frontend selaras dengan endpoint backend.

## 3) Struktur Folder Penting

- `src/App.jsx`: shell UI utama dashboard
- `src/App.css`: styling utama
- `backend/src/server.js`: API routes
- `backend/src/db.js`: koneksi MySQL
- `backend/schema.sql`: schema inti
- `backend/payroll-schema.sql`: schema payroll lanjutan
- `backend/seed.sql`: seed data awal

## 4) Aturan Coding

- Gunakan JavaScript ESM (import/export), konsisten dengan project ini.
- Gunakan nama variabel deskriptif (`payrollRuns`, `selectedRunId`, dll).
- Hindari hardcode berulang; ekstrak ke konstanta/fungsi bila dipakai berulang.
- Jangan tambahkan dependency baru kecuali benar-benar dibutuhkan.
- Untuk UI, utamakan style yang konsisten dengan `App.css` yang ada.

## 5) Aturan API & Data

- Endpoint baru harus mengikuti pola REST yang sudah dipakai.
- Untuk perubahan data sensitif payroll, selalu gunakan role check.
- Selalu kirim respons error yang jelas (`message`) agar mudah ditangani frontend.
- Saat hitung payroll, jaga konsistensi nilai agregat run (`total_gross`, `total_net`, dll).

## 6) Validasi Wajib Sebelum Selesai

Jalankan perintah berikut setelah perubahan signifikan:

- `npm run lint`
- `npm run build`

Jika perubahan menyentuh database/schema:

- `npm run db:setup`

## 7) Praktik Aman

- Jangan hapus endpoint lama jika masih dipakai UI.
- Jangan ubah struktur tabel existing tanpa alasan jelas.
- Jangan commit secret/credential.
- Jangan melakukan destructive operation pada data tanpa instruksi user.

## 8) UX Guidelines (Khusus Dashboard HRIS)

- Tampilan harus clean, modern, dan mudah dibaca HR/Finance.
- Selalu tampilkan feedback aksi (success/error message).
- Untuk data tabel panjang, prioritaskan search/filter dan aksi jelas.
- Fitur edit lebih disukai menggunakan modal/pop card untuk fokus pengguna.
