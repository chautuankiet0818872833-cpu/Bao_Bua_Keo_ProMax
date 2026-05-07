import React from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { blake2b } from '@noble/hashes/blake2.js';

interface CreateRoomModalProps {
  id: string;
  onCreated?: (gameId: string, txDigest: string, secret: { choice: number; salt: string }) => void;
}

const MIST_PER_SUI = 1_000_000_000n;
const DEFAULT_JOIN_TIMEOUT_MS = 2 * 60 * 1000;
const CLOCK_OBJECT_ID = '0x6';
const CHOICE_ROCK = 0;
const CHOICE_PAPER = 1;
const CHOICE_SCISSORS = 2;


function toMist(amountSui: string): bigint {
  const normalized = amountSui.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error('Số tiền cược không hợp lệ.');
  const [whole, frac = ''] = normalized.split('.');
  const fracPadded = (frac + '000000000').slice(0, 9);
  return BigInt(whole) * MIST_PER_SUI + BigInt(fracPadded);
}

async function makeCommitment(choice: number, salt: string): Promise<number[]> {
  const encoder = new TextEncoder();
  const saltBytes = encoder.encode(salt);
  const payload = new Uint8Array(1 + saltBytes.length);
  payload[0] = choice;
  payload.set(saltBytes, 1);
  return Array.from(blake2b(payload, { dkLen: 32 }));
}

function getCreatedGameId(transactionBlock: { objectChanges?: Array<{ type: string; objectId?: string; objectType?: string }> | null }) {
  const created = transactionBlock.objectChanges?.find(
    (change) => change.type === 'created' && change.objectType?.includes('::contractsb_b_k_prm::Game'),
  );
  return created?.objectId;
}

async function waitForTransaction(
  getTx: () => Promise<{ objectChanges?: Array<{ type: string; objectId?: string; objectType?: string }> | null }>,
  retries = 8,
  delayMs = 1200,
) {
  let lastError: unknown = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      return await getTx();
    } catch (e) {
      lastError = e;
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }
  throw lastError ?? new Error('Không thể đọc transaction sau nhiều lần thử.');
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ id, onCreated }) => {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();

  const [stakeAmount, setStakeAmount] = React.useState('');
  const [secretSalt, setSecretSalt] = React.useState('');
  const [secretChoice, setSecretChoice] = React.useState<number>(CHOICE_ROCK);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    setSecretSalt(hex);
  }, []);

  const packageId = import.meta.env.VITE_PACKAGE_ID as string | undefined;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    try {
      if (!account) throw new Error('Bạn cần kết nối ví trước khi tạo phòng.');
      if (!packageId) throw new Error('Thiếu VITE_PACKAGE_ID. Hãy cấu hình package id của smart contract.');
      
      const publicAddress = '0x0';

      if (!secretSalt.trim()) throw new Error('Bạn cần nhập mã bí mật.');
      if (![CHOICE_ROCK, CHOICE_PAPER, CHOICE_SCISSORS].includes(secretChoice)) {
        throw new Error('Nước đi bí mật không hợp lệ.');
      }

      const wagerMist = toMist(stakeAmount);
      if (wagerMist <= 0n) throw new Error('Số tiền cược phải lớn hơn 0.');

      setStatus('Đang gửi giao dịch tạo phòng...');
      const commitment = await makeCommitment(secretChoice, secretSalt.trim());

      const tx = new Transaction();
      const [wagerCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(wagerMist)]);
      tx.moveCall({
        target: `${packageId}::contractsb_b_k_prm::create_game`,
        arguments: [
          wagerCoin,
          tx.pure.address(publicAddress),
          tx.pure.vector('u8', commitment),
          tx.pure.u64(DEFAULT_JOIN_TIMEOUT_MS),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });

      const result = await signAndExecuteTransaction({ transaction: tx });
      const txBlock = await waitForTransaction(() => client.getTransactionBlock({
        digest: result.digest,
        options: { showObjectChanges: true },
      }));

      const gameId = getCreatedGameId(txBlock);
      if (!gameId) throw new Error('Không tìm thấy Game ID. Hãy kiểm tra ví đang cùng network với app (testnet).');

      onCreated?.(gameId, result.digest, { choice: secretChoice, salt: secretSalt.trim() });
      setStatus(`Tạo phòng thành công. Game ID: ${gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo phòng. Vui lòng thử lại.');
    }
  };

  return (
    <div className="modal fade" id={id} tabIndex={-1} aria-labelledby={`${id}Label`} aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content glass-card border-0 shadow-lg overflow-hidden">
          <div className="modal-header border-0 pb-0 pt-4 px-4">
            <h5 className="modal-title fw-bold text-white fs-4" id={`${id}Label`}>Tạo Phòng Mới</h5>
            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body p-4 text-dark">
            <form id={`${id}-form`} onSubmit={onSubmit}>
              <div className="mb-4">
                <label htmlFor="stakeAmount" className="form-label fw-semibold">Số tiền cược (SUI)</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <i className="bi bi-coin text-warning"></i>
                  </span>
                  <input 
                    type="number" 
                    className="form-control bg-light border-start-0" 
                    id="stakeAmount" 
                    placeholder="Ví dụ: 1.0" 
                    step="0.1" 
                    min="0"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-text mt-2 text-muted">
                  Số tiền này sẽ được khóa vào Smart Contract cho đến khi có kết quả.
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold d-block mb-3">Nước đi bí mật của bạn</label>
                <div className="d-flex gap-2 mb-4">
                  <button 
                    type="button"
                    className={`btn flex-fill py-3 rounded-4 fs-3 ${secretChoice === CHOICE_ROCK ? 'btn-primary shadow pulse-glow' : 'btn-outline-secondary opacity-75'}`}
                    onClick={() => setSecretChoice(CHOICE_ROCK)}
                  >
                    👊
                    <div className="fs-6 mt-1 fw-bold">Búa</div>
                  </button>
                  <button 
                    type="button"
                    className={`btn flex-fill py-3 rounded-4 fs-3 ${secretChoice === CHOICE_PAPER ? 'btn-primary shadow pulse-glow' : 'btn-outline-secondary opacity-75'}`}
                    onClick={() => setSecretChoice(CHOICE_PAPER)}
                  >
                    ✋
                    <div className="fs-6 mt-1 fw-bold">Bao</div>
                  </button>
                  <button 
                    type="button"
                    className={`btn flex-fill py-3 rounded-4 fs-3 ${secretChoice === CHOICE_SCISSORS ? 'btn-primary shadow pulse-glow' : 'btn-outline-secondary opacity-75'}`}
                    onClick={() => setSecretChoice(CHOICE_SCISSORS)}
                  >
                    ✌️
                    <div className="fs-6 mt-1 fw-bold">Kéo</div>
                  </button>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label fw-semibold mb-0">Mã bí mật (Salt)</label>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-link text-decoration-none"
                    onClick={() => {
                      const array = new Uint8Array(16);
                      window.crypto.getRandomValues(array);
                      const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
                      setSecretSalt(hex);
                    }}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Đổi mã ngẫu nhiên
                  </button>
                </div>
                
                <div className="secure-input-wrapper">
                  <div className="input-group">
                    <span className="input-group-text bg-dark border-dark text-white border-end-0">
                      <i className="bi bi-shield-lock-fill text-info"></i>
                    </span>
                    <input 
                      type="text" 
                      className="form-control bg-dark border-dark text-white border-start-0 font-monospace" 
                      id="secretCode" 
                      readOnly
                      value={secretSalt}
                      placeholder="Mã sẽ được tạo tự động..."
                      required
                    />
                    <button 
                      className="btn btn-dark border-dark" 
                      type="button"
                      onClick={() => {
                        if (secretSalt) {
                          navigator.clipboard.writeText(secretSalt);
                          setStatus('Đã copy mã bí mật!');
                          setTimeout(() => setStatus(null), 2000);
                        }
                      }}
                    >
                      <i className="bi bi-clipboard"></i>
                    </button>
                  </div>
                  <div className="security-badge mt-2">
                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle w-100 py-2 text-wrap" style={{ fontSize: '0.75rem' }}>
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      Hệ thống đã tạo mã bảo mật cực mạnh. Bạn không cần nhớ nó (đã lưu vào trình duyệt), nhưng có thể copy để dự phòng.
                    </span>
                  </div>
                </div>
              </div>

              {status && <div className="alert alert-success py-2">{status}</div>}
              {error && <div className="alert alert-danger py-2">{error}</div>}
            </form>
          </div>
          <div className="modal-footer border-0 p-4 pt-0">
            <button type="button" className="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Hủy</button>
            <button type="submit" form={`${id}-form`} className="btn btn-primary rounded-pill px-4 shadow" disabled={isPending}>
              {isPending ? 'Đang tạo phòng...' : 'Xác nhận tạo phòng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomModal;
