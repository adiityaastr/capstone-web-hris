// Validation utilities
import { ValidationError } from './errorHandler.js'

export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new ValidationError(`${fieldName} wajib diisi`)
  }
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    throw new ValidationError('Email tidak valid')
  }
}

export function validateNumber(value, fieldName, { min = null, max = null } = {}) {
  const num = Number(value)
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} harus berupa angka`)
  }
  if (min !== null && num < min) {
    throw new ValidationError(`${fieldName} minimal ${min}`)
  }
  if (max !== null && num > max) {
    throw new ValidationError(`${fieldName} maksimal ${max}`)
  }
}

export function validateDate(date, fieldName) {
  const d = new Date(date)
  if (isNaN(d.getTime())) {
    throw new ValidationError(`${fieldName} harus berupa tanggal valid`)
  }
}

export function validateEnum(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${fieldName} harus salah satu dari: ${allowedValues.join(', ')}`
    )
  }
}

export function validatePayrollRun(run) {
  const errors = []

  // Check for negative net salary
  if (run.total_net < 0) {
    errors.push('Net salary tidak boleh negatif')
  }

  // Check for zero gross salary
  if (run.total_gross === 0) {
    errors.push('Gross salary tidak boleh nol')
  }

  return errors
}

export function validateSalaryProfile(profile) {
  const errors = []

  if (!profile.employee_id) errors.push('employee_id wajib')
  if (profile.total_gross <= 0) errors.push('Total gaji harus > 0')

  return errors
}
