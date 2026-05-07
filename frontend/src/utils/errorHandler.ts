/**
 * Error handling utilities for better UX
 */

export class GameError extends Error {
  code: string
  recoverable: boolean

  constructor(
    code: string,
    message: string,
    recoverable: boolean = true,
  ) {
    super(message)
    this.name = 'GameError'
    this.code = code
    this.recoverable = recoverable
  }
}

/**
 * Parse error from transaction or API response
 */
export function parseError(error: unknown): { message: string; recoverable: boolean; code: string } {
  if (error instanceof GameError) {
    return {
      message: error.message,
      recoverable: error.recoverable,
      code: error.code,
    }
  }

  if (error instanceof Error) {
    const message = error.message || 'Lỗi không xác định'

    // Sui SDK errors
    if (message.includes('Insufficient balance')) {
      return {
        message: 'Số dư ví không đủ để thực hiện giao dịch này.',
        recoverable: true,
        code: 'INSUFFICIENT_BALANCE',
      }
    }

    if (message.includes('ENotPlayer') || message.includes('EInvalidPlayer')) {
      return {
        message: 'Bạn không phải là người chơi trong game này.',
        recoverable: false,
        code: 'NOT_PLAYER',
      }
    }

    if (message.includes('EInvalidState')) {
      return {
        message: 'Trò chơi ở trạng thái không hợp lệ. Có thể game đã kết thúc.',
        recoverable: false,
        code: 'INVALID_STATE',
      }
    }

    if (message.includes('EInvalidCommitment')) {
      return {
        message: 'Mã bí mật hoặc nước đi không khớp với commitment. Kiểm tra lại.',
        recoverable: false,
        code: 'INVALID_COMMITMENT',
      }
    }

    if (message.includes('ETimeoutNotReached')) {
      return {
        message: 'Thời gian timeout chưa đến. Vui lòng chờ thêm.',
        recoverable: true,
        code: 'TIMEOUT_NOT_REACHED',
      }
    }

    if (message.includes('EInvalidWagerAmount')) {
      return {
        message: 'Số tiền cược không khớp.',
        recoverable: true,
        code: 'WAGER_MISMATCH',
      }
    }

    if (message.includes('EInvalidChoice')) {
      return {
        message: 'Nước đi không hợp lệ. Chỉ nhận: 0 (Búa), 1 (Bao), 2 (Kéo).',
        recoverable: true,
        code: 'INVALID_CHOICE',
      }
    }

    if (message.includes('User rejected')) {
      return {
        message: 'Bạn đã hủy giao dịch.',
        recoverable: true,
        code: 'USER_REJECTED',
      }
    }

    if (message.includes('network') || message.includes('Network')) {
      return {
        message: 'Lỗi kết nối. Kiểm tra internet hoặc mạng Sui network.',
        recoverable: true,
        code: 'NETWORK_ERROR',
      }
    }

    return {
      message,
      recoverable: true,
      code: 'UNKNOWN_ERROR',
    }
  }

  return {
    message: 'Lỗi không xác định',
    recoverable: true,
    code: 'UNKNOWN',
  }
}

/**
 * User-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  const { message } = parseError(error)
  return message
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  const { recoverable } = parseError(error)
  return recoverable
}

/**
 * Format validation error
 */
export function validateAmount(amount: string): { valid: boolean; error?: string } {
  if (!amount.trim()) {
    return { valid: false, error: 'Vui lòng nhập số tiền.' }
  }

  if (!/^\d+(\.\d+)?$/.test(amount.trim())) {
    return { valid: false, error: 'Số tiền không hợp lệ.' }
  }

  const num = parseFloat(amount)
  if (num <= 0) {
    return { valid: false, error: 'Số tiền phải lớn hơn 0.' }
  }

  if (num > 1000000) {
    return { valid: false, error: 'Số tiền quá lớn.' }
  }

  return { valid: true }
}

/**
 * Validate address format
 */
export function validateAddress(address: string): { valid: boolean; error?: string } {
  if (!address.trim()) {
    return { valid: false, error: 'Vui lòng nhập địa chỉ.' }
  }

  // Sui addresses are hex strings, typically 64 characters with 0x prefix
  if (!/^0x[a-fA-F0-9]{1,64}$/.test(address.trim())) {
    return { valid: false, error: 'Địa chỉ không hợp lệ.' }
  }

  return { valid: true }
}

/**
 * Format transaction hash for display
 */
export function formatTxHash(hash: string): string {
  if (!hash || hash.length < 16) return hash
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`
}
