import './App.css'
import { useMemo, useState } from 'react'
import Navbar from './components/Navbar'
import CreateRoomModal from './components/CreateRoomModal'
import GameDashboard from './components/GameDashboard'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'

const CLOCK_OBJECT_ID = '0x6';
const REVEAL_TIMEOUT_MS = 5 * 60 * 1000;

function extractGameId(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (/^0x[a-fA-F0-9]+$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    return url.searchParams.get('gameId') ?? ''
  } catch {
    return ''
  }
}

function parseState(raw: unknown) {
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && 'variant' in raw) return (raw as { variant: string }).variant;
  return 'Waiting';
}

function App() {
  const account = useCurrentAccount()
  const initialGameId = useMemo(() => new URLSearchParams(window.location.search).get('gameId') ?? '', [])
  const [currentGameId, setCurrentGameId] = useState(initialGameId)
  const [lastTxDigest, setLastTxDigest] = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joinChoice, setJoinChoice] = useState(0)
  const [isJoiningTx, setIsJoiningTx] = useState(false)

  // Query game info if we have a gameId but not "in" the game dashboard yet
  const { data: gameData, refetch: refetchGame } = useSuiClientQuery('getObject', {
    id: currentGameId,
    options: { showContent: true },
  }, {
    enabled: !!currentGameId
  });

  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const gameFields = (gameData as any)?.data?.content?.fields;
  const gameStatus = parseState(gameFields?.state);
  const isPlayer1 = account && gameFields && account.address.toLowerCase() === gameFields.player1.toLowerCase();
  const isPlayer2 = account && gameFields && account.address.toLowerCase() === gameFields.player2.toLowerCase();
  const wagerMist = gameFields?.wager?.value ? BigInt(gameFields.wager.value) : 0n;

  // Quyết định có hiển thị dashboard hay không
  // Chỉ hiển thị dashboard nếu:
  // 1. Là chủ phòng
  // 2. Là người chơi 2 VÀ game đã qua trạng thái Waiting (đã join)
  const showDashboard = currentGameId && (isPlayer1 || (isPlayer2 && gameStatus !== 'Waiting'));

  const inviteLink = currentGameId ? `${window.location.origin}/?gameId=${currentGameId}` : ''

  const onCreatedGame = (gameId: string, txDigest: string, secret: { choice: number; salt: string }) => {
    setCurrentGameId(gameId)
    setLastTxDigest(txDigest)
    window.localStorage.setItem(`bbk:secret:${gameId}`, JSON.stringify(secret))
    const url = new URL(window.location.href)
    url.searchParams.set('gameId', gameId)
    window.history.replaceState({}, '', url.toString())
  }

  const onJoinByLink = () => {
    const gameId = extractGameId(joinInput)
    if (!gameId) {
      setJoinError('Link hoặc Game ID không hợp lệ.')
      return
    }
    setJoinError('')
    setCurrentGameId(gameId)
    const url = new URL(window.location.href)
    url.searchParams.set('gameId', gameId)
    window.history.replaceState({}, '', url.toString())
  }

  const doJoinTransaction = async () => {
    if (!currentGameId || !gameFields) return;
    try {
      setIsJoiningTx(true);
      setJoinError('');
      const tx = new Transaction();
      const [wagerCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(wagerMist)]);
      tx.moveCall({
        target: `${import.meta.env.VITE_PACKAGE_ID}::contractsb_b_k_prm::join_game`,
        arguments: [
          tx.object(currentGameId),
          wagerCoin,
          tx.pure.u8(joinChoice),
          tx.pure.u64(REVEAL_TIMEOUT_MS),
          tx.object(CLOCK_OBJECT_ID),
        ],
      });
      const result = await signAndExecuteTransaction({ transaction: tx });
      setLastTxDigest(result.digest);
      await refetchGame();
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : 'Không thể tham gia phòng.');
    } finally {
      setIsJoiningTx(false);
    }
  };

  const onBackHome = () => {
    setCurrentGameId('')
    setLastTxDigest('')
    setJoinInput('')
    const url = new URL(window.location.href)
    url.searchParams.delete('gameId')
    window.history.replaceState({}, '', url.toString())
  }

  return (
    <div className="min-vh-100 bg-dark text-white">
      <Navbar />
      <CreateRoomModal id="createRoomModal" onCreated={onCreatedGame} />
      
      <main className="container py-5">
        {!showDashboard ? (
          <div className="row justify-content-center g-4 mb-5">
            <div className="col-lg-10">
              <div className="glass-card rounded-4 overflow-hidden">
                <div className="card-body p-4 p-md-5">
                  <div className="text-center mb-5">
                    <h1 className="fw-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400" style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      Keo Bua Bao ProMax
                    </h1>
                    <p className="text-muted mb-4 fs-5">Trò chơi Kéo Búa Bao phi tập trung trên mạng lưới Sui</p>
                    <button
                      className="btn btn-success btn-lg rounded-pill px-5 shadow pulse-glow fw-bold"
                      data-bs-toggle="modal"
                      data-bs-target="#createRoomModal"
                    >
                      <i className="bi bi-plus-circle-fill me-2"></i>
                      Tạo Phòng Mới
                    </button>
                  </div>

                  <hr className="my-5 opacity-10" />

                  <div className="row justify-content-center">
                    <div className="col-md-8">
                      <h5 className="fw-bold mb-3 text-white">
                        {currentGameId ? 'Chi tiết phòng đấu' : 'Vào phòng bằng link mời'}
                      </h5>
                      
                      {currentGameId && gameFields ? (
                        <div className="bg-white bg-opacity-5 rounded-4 p-4 mb-4 border border-info border-opacity-25">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <span className="badge bg-primary px-3 py-2">Sẵn sàng tham gia</span>
                            <span className="text-info fw-bold">Wager: {Number(wagerMist) / 1_000_000_000} SUI</span>
                          </div>
                          <div className="mb-4">
                            <div className="small text-muted mb-1">Game ID:</div>
                            <code className="text-info d-block text-truncate p-2 bg-dark bg-opacity-50 rounded">{currentGameId}</code>
                          </div>
                          
                          <div className="mb-4">
                            <label className="form-label text-white fw-semibold mb-3">Chọn nước đi của bạn:</label>
                            <div className="d-flex gap-2 justify-content-center">
                              <button 
                                className={`btn flex-fill py-3 rounded-4 fw-bold ${joinChoice === 0 ? 'btn-primary pulse-glow' : 'btn-outline-light'}`}
                                onClick={() => setJoinChoice(0)}
                              >
                                👊 Búa
                              </button>
                              <button 
                                className={`btn flex-fill py-3 rounded-4 fw-bold ${joinChoice === 1 ? 'btn-primary pulse-glow' : 'btn-outline-light'}`}
                                onClick={() => setJoinChoice(1)}
                              >
                                ✋ Bao
                              </button>
                              <button 
                                className={`btn flex-fill py-3 rounded-4 fw-bold ${joinChoice === 2 ? 'btn-primary pulse-glow' : 'btn-outline-light'}`}
                                onClick={() => setJoinChoice(2)}
                              >
                                ✌️ Kéo
                              </button>
                            </div>
                          </div>

                          <div className="d-flex gap-2">
                            <button className="btn btn-outline-secondary rounded-pill px-4" onClick={onBackHome}>Hủy</button>
                            <button 
                              className="btn btn-primary rounded-pill flex-grow-1 py-3 fw-bold shadow" 
                              onClick={doJoinTransaction}
                              disabled={isJoiningTx}
                            >
                              {isJoiningTx ? (
                                <><span className="spinner-border spinner-border-sm me-2"></span>Đang xử lý...</>
                              ) : 'Xác nhận Tham Gia ngay'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="join-input-wrapper pulse-glow rounded-pill p-1 shadow-lg" style={{ background: 'var(--primary-gradient)' }}>
                          <div className="input-group input-group-lg overflow-hidden rounded-pill">
                            <span className="input-group-text bg-dark border-0 text-white ps-4">
                              <i className="bi bi-link-45deg fs-4 text-info"></i>
                            </span>
                            <input
                              type="text"
                              className="form-control bg-dark border-0 text-white p-4 fs-5 font-monospace"
                              style={{ boxShadow: 'none', borderRadius: 0 }}
                              placeholder="Dán link mời hoặc Game ID..."
                              value={joinInput}
                              onChange={(e) => setJoinInput(e.target.value)}
                            />
                            <button 
                              type="button" 
                              className="btn btn-primary px-5 fw-bold fs-5 border-0" 
                              onClick={onJoinByLink}
                              style={{ borderRadius: 0, borderLeft: '1px solid rgba(255,255,255,0.1)' }}
                            >
                              VÀO PHÒNG
                            </button>
                          </div>
                        </div>
                      )}
                      {joinError && <div className="alert alert-danger mt-3 rounded-4 border-0 shadow-sm">{joinError}</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <GameDashboard gameId={currentGameId} inviteLink={inviteLink} txDigest={lastTxDigest} onBackHome={onBackHome} />
        )}
      </main>
    </div>
  )
}

export default App
