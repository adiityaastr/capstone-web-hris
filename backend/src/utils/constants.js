// Global constants
export const PAYROLL_STATUS = {
  DRAFT: 'draft',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  FINALIZED: 'finalized',
}

export const PAYROLL_ROLES = ['HRD', 'Finance', 'Super Admin']
export const HRD_ROLES = ['HRD', 'Super Admin']
export const FINANCE_ROLES = ['Finance', 'Super Admin']
export const ADMIN_ROLES = ['Super Admin']

export const APPROVAL_LEVELS = {
  HRD_REVIEW: 1,
  FINANCE_APPROVE: 2,
  FINANCE_FINALIZE: 3,
}

export const LEAVE_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

export const LEAVE_TYPES = {
  CUTI_TAHUNAN: 'Cuti Tahunan',
  IZIN_SAKIT: 'Izin Sakit',
  IZIN: 'Izin',
}

export const ATTENDANCE_STATUS = {
  AKTIF: 'Aktif',
  TERLAMBAT: 'Terlambat',
  MEETING: 'Meeting',
}

export const AUDIT_ACTIONS = {
  GENERATE_PAYROLL_RUN: 'GENERATE_PAYROLL_RUN',
  REVIEW_PAYROLL_RUN: 'REVIEW_PAYROLL_RUN',
  APPROVE_PAYROLL_RUN: 'APPROVE_PAYROLL_RUN',
  REJECT_PAYROLL_RUN: 'REJECT_PAYROLL_RUN',
  FINALIZE_PAYROLL_RUN: 'FINALIZE_PAYROLL_RUN',
  QUICK_PAYROLL_RUN: 'QUICK_PAYROLL_RUN',
  CREATE_SALARY_PROFILE: 'CREATE_SALARY_PROFILE',
  UPDATE_SALARY_PROFILE: 'UPDATE_SALARY_PROFILE',
  DELETE_SALARY_PROFILE: 'DELETE_SALARY_PROFILE',
}

export const DEFAULT_SALARY_COMPONENTS = {
  GAPOK: { name: 'Gaji Pokok', type: 'earning' },
  TUNJ: { name: 'Tunjangan Tetap', type: 'earning' },
  TJ_TRANSPORT: { name: 'Tunjangan Transport', type: 'earning' },
  TJ_MAKAN: { name: 'Tunjangan Makan', type: 'earning' },
  POT: { name: 'Potongan Absensi', type: 'deduction' },
}
