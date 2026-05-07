import React from 'react'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { blake2b } from '@noble/hashes/blake2.js'
import LoadingOverlay from './LoadingOverlay'
import { saveSecretFallback } from '../utils/secretManager'
import { parseError, validateAmount, validateAddress } from '../utils/errorHandler'
import { 
  toMist, 
  waitForTransaction, 
  getCreatedGameId, 
  CLOCK_OBJECT_ID,
  CHOICES,
  CHOICE_NAMES
} from '../utils/transactionHelper'

type CreateInviteModalProps = {
  open: boolean
  friendAddress: string | null
  onClose?: () => void
  onCreated?: (gameId: string, txDigest: string, secret: { choice: number; salt: string }) => void
}

const DEFAULT_JOIN_TIMEOUT_MS = 2 * 60 * 1000

const CHOICE_ROCK = CHOICES.ROCK
const CHOICE_PAPER = CHOICES.PAPER
const CHOICE_SCISSORS = CHOICES.SCISSORS
const VALID_CHOICES: readonly number[] = [CHOICE_ROCK, CHOICE_PAPER, CHOICE_SCISSORS]

async function makeCommitment(choice: number, salt: string): Promise<number[]> {
  const encoder = new TextEncoder()
  const saltBytes = encoder.encode(salt)
  const payload = new Uint8Array(1 + saltBytes.length)
  payload[0] = choice
  payload.set(saltBytes, 1)
  const out = blake2b(payload, { dkLen: 32 })
  return Array.from(out)
}

const CreateInviteModal: React.FC<CreateInviteModalProps> = ({ open, friendAddress, onClose, onCreated }) => {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutateAsync: signAndExecuteTransaction, isPending: isTxPending } = useSignAndExecuteTransaction()

  const packageId = import.meta.env.VITE_PACKAGE_ID as string | undefined

  const [stakeAmount, setStakeAmount] = React.useState('1.0')
  const [secretSalt, setSecretSalt] = React.useState('')
  const [secretChoice, setSecretChoice] = React.useState<number>(CHOICE_ROCK)

  const [isLoading, setIsLoading] = React.useState(false)
  const [loadingMessage, setLoadingMessage] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [amountError, setAmountError] = React.useState<string | null>(null)

  const generateRandomSalt = () => {
    const array = new Uint8Array(16)
    window.crypto.getRandomValues(array)
    const hex = Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    setSecretSalt(hex)
  }

  React.useEffect(() => {
    if (!open) return
    generateRandomSalt()
    setSecretChoice(CHOICE_ROCK)
    setStakeAmount('1.0')
    setIsLoading(false)
    setLoadingMessage('')
    setError(null)
    setAmountError(null)
  }, [open])

  const validateAndSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setAmountError(null)

    try {
      // Validation
      if (!account) {
        throw new Error('Bạn cần kết nối ví trước khi tạo lời mời.')
      }

      if (!packageId) {
        throw new Error('Thiếu VITE_PACKAGE_ID. Hãy cấu hình package ID của smart contract.')
      }

      if (!friendAddress) {
        throw new Error('Chưa chọn bạn để mời.')
      }

      // Validate address
      const addressValidation = validateAddress(friendAddress)
      if (!addressValidation.valid) {
        throw new Error(addressValidation.error)
      }

      // Validate amount
      const amountValidation = validateAmount(stakeAmount)
      if (!amountValidation.valid) {
        const validationError = amountValidation.error ?? 'Invalid amount.'
        setAmountError(validationError)
        throw new Error(validationError)
      }

      if (!secretSalt.trim()) {
        throw new Error('Bạn cần nhập mã bí mật.')
      }

      if (!VALID_CHOICES.includes(secretChoice)) {
        throw new Error('Nước đi bí mật không hợp lệ.')
      }

      setIsLoading(true)
      setLoadingMessage('Kiểm tra số dư ví...')

      const wagerMist = toMist(stakeAmount)
      if (wagerMist <= 0n) {
        throw new Error('Số tiền cược phải lớn hơn 0.')
      }

      setLoadingMessage('Tạo commitment...')
      const commitment = await makeCommitment(secretChoice, secretSalt.trim())

      setLoadingMessage('Chuẩn bị giao dịch...')
      const tx = new Transaction()
      const [wagerCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(wagerMist)])
      tx.moveCall({
        target: `${packageId}::contractsb_b_k_prm::create_game`,
        arguments: [
          wagerCoin,
          tx.pure.address(friendAddress),
          tx.pure.vector('u8', commitment),
          tx.pure.u64(DEFAULT_JOIN_TIMEOUT_MS),
          tx.object(CLOCK_OBJECT_ID),
        ],
      })

      setLoadingMessage('Đang ký giao dịch...')
      const result = await signAndExecuteTransaction({ transaction: tx })

      setLoadingMessage('Chờ kết quả giao dịch...')
      const txBlock = await waitForTransaction(client, result.digest)

      const gameId = getCreatedGameId(txBlock)
      if (!gameId) {
        throw new Error(
          'Không tìm thấy Game ID. Hãy kiểm tra:\n• Ví được kết nối với testnet\n• Package ID chính xác\n• Có đủ SUI trong ví',
        )
      }

      setLoadingMessage('Lưu mã bí mật...')
      await saveSecretFallback(gameId, secretChoice, secretSalt.trim())

      setLoadingMessage('Hoàn tất!')
      onCreated?.(gameId, result.digest, { choice: secretChoice, salt: secretSalt.trim() })
      
      setTimeout(() => {
        setIsLoading(false)
        setLoadingMessage('')
        onClose?.()
      }, 500)
    } catch (e) {
      setIsLoading(false)
      setLoadingMessage('')
      const errorInfo = parseError(e)
      setError(errorInfo.message)
      console.error('Create invite error:', e)
    }
  }

  return (
    <>
      <LoadingOverlay 
        isVisible={isLoading || isTxPending} 
        message={loadingMessage || 'Đang xử lý...'} 
      />
      
      <div
        className={`modal fade ${open ? 'show d-block' : 'd-none'}`}
        tabIndex={-1}
        role="dialog"
        aria-hidden={!open}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content glass-card border-0 shadow-lg overflow-hidden">
            <div className="modal-header border-0 pb-0 pt-4 px-4">
              <h5 className="modal-title fw-bold text-white fs-4">
                Mời chơi với {friendAddress ? friendAddress.slice(0, 8) + '...' : '...'}
              </h5>
              <button 
                type="button" 
                className="btn-close btn-close-white" 
                onClick={onClose} 
                aria-label="Close"
                disabled={isLoading || isTxPending}
              ></button>
            </div>

            <div className="modal-body p-4 text-dark">
              <form id="create-invite-form" onSubmit={validateAndSubmit}>
                <div className="mb-4">
                  <label htmlFor="stakeAmount" className="form-label fw-semibold">
                    Số tiền cược (SUI)
                  </label>
                  <input
                    type="number"
                    className={`form-control bg-light ${amountError ? 'is-invalid' : ''}`}
                    id="stakeAmount"
                    value={stakeAmount}
                    onChange={(e) => {
                      setStakeAmount(e.target.value)
                      setAmountError(null)
                    }}
                    step="0.01"
                    min="0.001"
                    max="1000000"
                    required
                    disabled={isLoading || isTxPending}
                  />
                  {amountError && <div className="invalid-feedback d-block">{amountError}</div>}
                  <div className="form-text mt-2 text-muted">
                    Số tiền này sẽ được khóa vào Smart Contract cho đến khi có kết quả.
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold d-block mb-3">Nước đi bí mật của bạn</label>
                  <div className="d-flex gap-2 mb-4">
                    {[CHOICE_ROCK, CHOICE_PAPER, CHOICE_SCISSORS].map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        className={`btn flex-fill py-3 rounded-4 fs-3 ${
                          secretChoice === choice 
                            ? 'btn-primary shadow pulse-glow' 
                            : 'btn-outline-secondary opacity-75'
                        }`}
                        onClick={() => setSecretChoice(choice)}
                        disabled={isLoading || isTxPending}
                      >
                        {choice === CHOICE_ROCK ? '👊' : choice === CHOICE_PAPER ? '✋' : '✌️'}
                        <div className="fs-6 mt-1 fw-bold">{CHOICE_NAMES[choice]}</div>
                      </button>
                    ))}
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label fw-semibold mb-0">Mã bí mật (Salt)</label>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-decoration-none"
                      onClick={generateRandomSalt}
                      disabled={isLoading || isTxPending}
                    >
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      Đổi mã ngẫu nhiên
                    </button>
                  </div>

                  <div className="secure-input-wrapper">
                    <input
                      type="text"
                      className="form-control bg-dark border-dark text-white border-start-0 font-monospace"
                      value={secretSalt}
                      readOnly
                      required
                    />
                  </div>

                  <div className="security-badge mt-2">
                    <span 
                      className="badge bg-warning-subtle text-dark border border-warning-subtle w-100 py-2 text-wrap" 
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className="bi bi-info-circle-fill me-2"></i>
                      Mã này sẽ được lưu an toàn. Bạn cần nó để reveal nước đi.
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="alert alert-danger py-2 mb-3 d-flex align-items-start gap-2">
                    <i className="bi bi-exclamation-circle-fill flex-shrink-0 mt-0.5"></i>
                    <div>{error}</div>
                  </div>
                )}
              </form>
            </div>

            <div className="modal-footer border-0 p-4 pt-0">
              <button 
                type="button" 
                className="btn btn-light rounded-pill px-4" 
                onClick={onClose}
                disabled={isLoading || isTxPending}
              >
                Hủy
              </button>
              <button
                type="submit"
                form="create-invite-form"
                className="btn btn-primary rounded-pill px-4 shadow"
                disabled={isLoading || isTxPending}
              >
                {isLoading || isTxPending ? 'Đang tạo...' : 'Xác nhận tạo lời mời'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default CreateInviteModal
