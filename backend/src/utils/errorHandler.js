// Error handling utilities
export class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR')
    this.details = details
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'AUTH_ERROR')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN_ERROR')
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} tidak ditemukan`, 404, 'NOT_FOUND')
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database error', originalError = null) {
    super(message, 500, 'DATABASE_ERROR')
    this.originalError = originalError
  }
}

export function handleDatabaseError(error) {
  if (error.code === 'ER_NO_REFERENCED_ROW_2') {
    return new AppError('Referensi data tidak ditemukan di database', 400)
  }
  if (error.code === 'ER_BAD_NULL_ERROR') {
    return new AppError('Data wajib tidak boleh kosong', 400)
  }
  if (error.code === 'ER_DUP_ENTRY') {
    return new AppError('Data sudah ada (duplikat)', 400)
  }
  if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
    return new AppError('Database tidak tersedia. Hubungi administrator.', 503)
  }
  return new DatabaseError('Terjadi kesalahan database', error)
}

export function errorHandler(err, _req, res, _next) {
  console.error(err)

  if (err instanceof AppError) {
    return res.status(err.status).json({
      message: err.message,
      code: err.code,
      ...(err.details && { details: err.details }),
    })
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Token tidak valid atau telah kadaluarsa. Silakan login kembali.',
      code: 'TOKEN_ERROR',
    })
  }

  if (err instanceof Error) {
    const dbError = handleDatabaseError(err)
    return res.status(dbError.status).json({
      message: dbError.message,
      code: dbError.code,
    })
  }

  res.status(500).json({
    message: 'Terjadi kesalahan server. Coba lagi nanti.',
    code: 'INTERNAL_SERVER_ERROR',
  })
}
