# Payroll Blueprint Teknis (HRIS Cloud)

Dokumen ini menjadi panduan implementasi modul payroll yang siap produksi untuk arsitektur saat ini (React + Node.js + MySQL).

## 1) Tujuan Modul Payroll

- Menghitung gaji karyawan secara akurat dari data master + variabel periode.
- Menyediakan proses bertahap: `draft -> review -> approve -> finalize -> publish`.
- Menjaga audit trail, keamanan data sensitif, dan kemudahan rekonsiliasi.

## 2) Data Model MySQL (Rancangan)

Gunakan tabel existing (`employees`, `attendance`) dan tambahkan entitas berikut:

### A. Master Komponen
- `payroll_components`
  - `id` (PK)
  - `code` (unik, contoh: BASIC, ALLOW_MEAL, DED_LATE)
  - `name`
  - `type` (`earning` | `deduction`)
  - `taxable` (boolean)
  - `is_active` (boolean)
  - `created_at`, `updated_at`

- `employee_salary_profiles`
  - `id` (PK)
  - `employee_id` (FK employees)
  - `effective_date`
  - `base_salary`
  - `payment_method` (`bank_transfer` | `cash`)
  - `bank_name`, `bank_account_name`, `bank_account_number`
  - `tax_profile_id` (nullable)
  - `bpjs_profile_id` (nullable)
  - `is_active`
  - `created_at`, `updated_at`

- `employee_salary_component_values`
  - `id` (PK)
  - `salary_profile_id` (FK employee_salary_profiles)
  - `component_id` (FK payroll_components)
  - `amount`
  - `is_percentage` (boolean)
  - `percentage_value` (nullable)
  - `created_at`, `updated_at`

### B. Variabel Periode
- `payroll_variable_inputs`
  - `id` (PK)
  - `employee_id` (FK)
  - `period_month` (DATE, format `YYYY-MM-01`)
  - `input_type` (`overtime` | `bonus` | `reimbursement` | `manual_adjustment`)
  - `amount`
  - `description`
  - `source_ref` (contoh: ID overtime request)
  - `approval_status` (`pending` | `approved` | `rejected`)
  - `created_by`, `approved_by` (nullable)
  - `created_at`, `updated_at`

### C. Payroll Run & Detail
- `payroll_runs`
  - `id` (PK)
  - `period_month`
  - `status` (`draft` | `reviewed` | `approved` | `finalized` | `published`)
  - `employee_count`
  - `total_gross`
  - `total_deduction`
  - `total_net`
  - `created_by`, `approved_by` (nullable), `finalized_by` (nullable)
  - `created_at`, `updated_at`, `finalized_at` (nullable)

- `payroll_run_items`
  - `id` (PK)
  - `payroll_run_id` (FK payroll_runs)
  - `employee_id` (FK employees)
  - `gross_amount`
  - `deduction_amount`
  - `net_amount`
  - `tax_amount`
  - `bpjs_amount`
  - `notes`
  - `created_at`, `updated_at`

- `payroll_run_item_components`
  - `id` (PK)
  - `payroll_run_item_id` (FK payroll_run_items)
  - `component_id` (FK payroll_components, nullable untuk komponen sistem)
  - `component_name_snapshot`
  - `component_type` (`earning` | `deduction`)
  - `amount`
  - `calculation_meta` (JSON, formula/rule snapshot)
  - `created_at`

### D. Approval, Publish, dan Audit
- `payroll_approvals`
  - `id` (PK)
  - `payroll_run_id` (FK payroll_runs)
  - `approval_level` (1, 2, 3)
  - `approver_user_id`
  - `status` (`pending` | `approved` | `rejected`)
  - `comment`
  - `approved_at` (nullable)

- `payslips`
  - `id` (PK)
  - `payroll_run_item_id` (FK payroll_run_items)
  - `employee_id` (FK employees)
  - `period_month`
  - `slip_number` (unik)
  - `published_at`
  - `pdf_url` (nullable)
  - `created_at`

- `payroll_audit_logs`
  - `id` (PK)
  - `payroll_run_id` (nullable FK)
  - `actor_user_id`
  - `action` (CREATE_RUN, RE-CALCULATE_ITEM, APPROVE, FINALIZE, PUBLISH)
  - `before_data` (JSON nullable)
  - `after_data` (JSON nullable)
  - `ip_address` (nullable)
  - `created_at`

## 3) Alur Proses Payroll

1. **Prepare Period**
   - Pilih periode payroll.
   - Lock cutoff variabel (overtime/bonus/deduction).

2. **Generate Draft Run**
   - Sistem ambil seluruh karyawan aktif.
   - Hitung komponen tetap + variabel.
   - Simpan hasil ke `payroll_runs` + `payroll_run_items`.

3. **Validation Gate**
   - Flag anomali: net < 0, base salary kosong, data bank kosong.
   - Tidak boleh lanjut approve jika ada error critical.

4. **Review & Approval**
   - HR review item karyawan.
   - Finance approve.
   - Opsional level 3 (Direksi) untuk nominal tertentu.

5. **Finalize**
   - Status run jadi `finalized`.
   - Data item dikunci (immutable untuk periode tsb).

6. **Publish**
   - Generate payslip.
   - Notifikasi employee.
   - Export bank transfer + jurnal akuntansi (opsional tahap berikut).

## 4) Desain Endpoint API Payroll

Base path: `/payroll`

### A. Master & Konfigurasi
- `GET /payroll/components`
- `POST /payroll/components`
- `PUT /payroll/components/:id`
- `GET /payroll/salary-profiles/:employeeId`
- `PUT /payroll/salary-profiles/:employeeId`

### B. Variable Input
- `GET /payroll/variables?period=YYYY-MM`
- `POST /payroll/variables`
- `PUT /payroll/variables/:id/approve`
- `PUT /payroll/variables/:id/reject`

### C. Payroll Run
- `POST /payroll/runs/generate`
  - body: `{ periodMonth: "2026-04-01" }`
- `GET /payroll/runs?period=2026-04-01`
- `GET /payroll/runs/:runId`
- `POST /payroll/runs/:runId/recalculate`
- `POST /payroll/runs/:runId/submit-review`
- `POST /payroll/runs/:runId/approve`
- `POST /payroll/runs/:runId/finalize`
- `POST /payroll/runs/:runId/publish`

### D. Payslip & Export
- `GET /payroll/runs/:runId/payslips`
- `GET /payroll/payslips/:id`
- `GET /payroll/runs/:runId/export/bank`
- `GET /payroll/runs/:runId/export/accounting`

## 5) Rule Engine Minimal (Tahap 1)

Urutan hitung per karyawan:
1. `gross = base_salary + sum(earning_components) + sum(approved_variables_earning)`
2. `deduction = sum(deduction_components) + sum(approved_variables_deduction)`
3. `tax_amount = simple tax rule (placeholder)`
4. `bpjs_amount = simple contribution rule (placeholder)`
5. `net = gross - deduction - tax_amount - bpjs_amount`

Catatan:
- Simpan setiap komponen hasil kalkulasi ke `payroll_run_item_components`.
- Simpan formula snapshot agar hasil historis tetap konsisten walaupun rule berubah.

## 6) Desain UI Halaman Payroll (Web Dashboard)

### Halaman 1: Payroll Overview
- Ringkasan run terbaru: status, total biaya, jumlah karyawan.
- Tombol: Generate Run, Lihat Draft, Finalize, Publish.

### Halaman 2: Payroll Run List
- Filter periode/status.
- Tabel run payroll + aksi cepat.

### Halaman 3: Payroll Run Detail
- Header run + status stepper.
- Daftar karyawan + gross/deduction/net.
- Error badge untuk item bermasalah.

### Halaman 4: Employee Payroll Detail
- Breakdown komponen earning/deduction.
- Riwayat adjustment.
- Tombol recalculate item.

### Halaman 5: Approval Queue
- Daftar run/item menunggu approval.
- Approve/reject dengan komentar wajib.

### Halaman 6: Payslip & Export
- List payslip per run.
- Download PDF.
- Export bank transfer & jurnal accounting.

## 7) Security & Compliance Minimum

- Gunakan role:
  - `HRD`: generate, review
  - `Finance`: approve, finalize
  - `Super Admin`: full override
  - `Employee`: read-only payslip pribadi
- Semua aksi kritis masuk `payroll_audit_logs`.
- Masking data rekening di UI (tampilkan 4 digit akhir saja).
- Lock period setelah status `finalized`.

## 8) Tahapan Implementasi Disarankan

### Sprint A (MVP Payroll Operasional)
- Tabel `payroll_runs`, `payroll_run_items`, `payroll_run_item_components`.
- Endpoint generate/review/finalize.
- UI run list + run detail + tombol finalize.

### Sprint B (Kontrol & Akurasi)
- Variable input + approval queue.
- Audit log + validation gate.
- Employee payroll detail.

### Sprint C (Distribusi)
- Payslip publish.
- Export bank transfer.
- Integrasi jurnal accounting.
