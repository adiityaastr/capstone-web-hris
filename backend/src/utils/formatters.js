// Formatting utilities
export function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value || 0)
}

export function formatDate(date, format = 'id-ID') {
  return new Date(date).toLocaleDateString(format)
}

export function formatDateTime(datetime, format = 'id-ID') {
  return new Date(datetime).toLocaleString(format)
}

export function formatTime(datetime) {
  return new Date(datetime).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatPercent(value, decimals = 1) {
  return `${(value || 0).toFixed(decimals)}%`
}

export function normalizePhoneNumber(phone) {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '')

  // Convert leading 0 to +62 for Indonesian numbers
  if (cleaned.startsWith('0')) {
    return `+62${cleaned.slice(1)}`
  }

  // If already has country code
  if (cleaned.startsWith('62')) {
    return `+${cleaned}`
  }

  return cleaned
}

export function truncateText(text, maxLength = 100) {
  if (text.length > maxLength) {
    return `${text.substring(0, maxLength - 3)}...`
  }
  return text
}
