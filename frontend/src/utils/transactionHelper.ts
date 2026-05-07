/**
 * Transaction utilities and helpers
 */

export const CLOCK_OBJECT_ID = '0x6'
export const MIST_PER_SUI = 1_000_000_000n

export interface TransactionOptions {
  maxRetries?: number
  retryDelayMs?: number
  timeoutMs?: number
}

type TransactionLookupClient = {
  getTransactionBlock: (input: {
    digest: string
    options: { showObjectChanges: boolean }
  }) => Promise<unknown>
}

/**
 * Convert SUI amount to mist
 */
export function toMist(amountSui: string): bigint {
  const normalized = amountSui.trim()

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Số tiền không hợp lệ')
  }

  const [whole, frac = ''] = normalized.split('.')
  const fracPadded = (frac + '000000000').slice(0, 9)

  return BigInt(whole) * MIST_PER_SUI + BigInt(fracPadded)
}

/**
 * Convert mist to SUI
 */
export function mistToSui(mist: bigint): string {
  const whole = mist / MIST_PER_SUI
  const frac = mist % MIST_PER_SUI

  if (frac === 0n) {
    return whole.toString()
  }

  const fracText = frac.toString().padStart(9, '0').replace(/0+$/, '')
  return `${whole.toString()}.${fracText}`
}

/**
 * Format mist amount for display
 */
export function formatMist(mist: bigint): string {
  return `${mistToSui(mist)} SUI`
}

/**
 * Format duration in milliseconds to MM:SS
 */
export function formatDuration(ms: bigint): string {
  if (ms <= 0n) return '00:00'

  const totalSeconds = Number(ms / 1000n)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Retry transaction with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const { maxRetries = 5, retryDelayMs = 1000 } = options

  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on certain errors
      if (
        lastError.message.includes('User rejected') ||
        lastError.message.includes('Invalid') ||
        lastError.message.includes('Not found')
      ) {
        throw lastError
      }

      if (i < maxRetries - 1) {
        // Exponential backoff
        const delayMs = retryDelayMs * Math.pow(1.5, i)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  throw lastError || new Error('Max retries reached')
}

/**
 * Wait for transaction to be indexed
 */
export async function waitForTransaction(
  client: TransactionLookupClient,
  digest: string,
  options: TransactionOptions = {},
): Promise<unknown> {
  const { maxRetries = 8, retryDelayMs = 1200 } = options

  return retryWithBackoff(
    () =>
      client.getTransactionBlock({
        digest,
        options: { showObjectChanges: true },
      }),
    { maxRetries, retryDelayMs },
  )
}

/**
 * Extract game ID from transaction response
 */
export function getCreatedGameId(
  transactionBlock: any,
  moduleFilter: string = 'contractsb_b_k_prm',
): string | null {
  const created = transactionBlock.objectChanges?.find(
    (change: any) =>
      change.type === 'created' &&
      change.objectType?.includes(`::${moduleFilter}::Game`),
  )

  return created?.objectId || null
}

/**
 * Create loading state manager
 */
export function createLoadingState() {
  return {
    isLoading: false,
    error: null as string | null,
    progress: '',
  }
}

/**
 * Validate transaction object
 */
export function validateTransactionBlock(tx: any): boolean {
  return tx && typeof tx === 'object' && typeof tx.moveCall === 'function'
}

/**
 * Format address for display
 */
export function shortAddress(value: string, startChars = 8, endChars = 6): string {
  if (!value || value.length < startChars + endChars) {
    return value
  }

  return `${value.slice(0, startChars)}...${value.slice(-endChars)}`
}

/**
 * Choice constants
 */
export const CHOICES = {
  ROCK: 0,
  PAPER: 1,
  SCISSORS: 2,
} as const

export const CHOICE_NAMES: Record<number, string> = {
  0: 'Búa',
  1: 'Bao',
  2: 'Kéo',
}

export function getChoiceName(choice: number): string {
  return CHOICE_NAMES[choice] || 'Không rõ'
}

/**
 * Decide winner
 */
export function decideWinner(player1Choice: number, player2Choice: number): 'draw' | 'player1' | 'player2' {
  if (player1Choice === player2Choice) return 'draw'

  if (
    (player1Choice === CHOICES.ROCK && player2Choice === CHOICES.SCISSORS) ||
    (player1Choice === CHOICES.PAPER && player2Choice === CHOICES.ROCK) ||
    (player1Choice === CHOICES.SCISSORS && player2Choice === CHOICES.PAPER)
  ) {
    return 'player1'
  }

  return 'player2'
}
