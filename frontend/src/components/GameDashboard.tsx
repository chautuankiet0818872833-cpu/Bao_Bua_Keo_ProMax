import React from 'react';
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClientQuery,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';

// --- Logic Layer: Mock Data & Types ---
// Tách biệt phần này để dễ dàng thay thế bằng hooks từ Sui SDK sau này
type GameStatus = 'waiting' | 'staked' | 'reveal' | 'finished';

interface GameDashboardProps {
  gameId: string;
  inviteLink: string;
  txDigest?: string;
  onBackHome?: () => void;
}

const CLOCK_OBJECT_ID = '0x6';
const MIST_PER_SUI = 1_000_000_000n;

interface ParsedGame {
  player1: string;
  player2: string;
  player2Choice: number;
  wagerMist: bigint;
  status: GameStatus;
  timeoutAtMs: bigint;
  closed: boolean;
}

function shortAddress(value: string) {
  if (!value || value.length < 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function mistToSuiString(mist: bigint) {
  const whole = mist / MIST_PER_SUI;
  const frac = mist % MIST_PER_SUI;
  if (frac === 0n) return `${whole.toString()} SUI`;
  const fracText = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fracText} SUI`;
}

function formatDuration(ms: bigint) {
  if (ms <= 0n) return '00:00';
  const totalSeconds = Number(ms / 1000n);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function parseState(raw: unknown): GameStatus {
  if (typeof raw === 'string') {
    if (raw.includes('Reveal')) return 'reveal';
    if (raw.includes('Finished')) return 'finished';
    return 'waiting';
  }
  if (raw && typeof raw === 'object') {
    if ('Reveal' in raw) return 'reveal';
    if ('Finished' in raw) return 'finished';
    return 'waiting';
  }
  return 'waiting';
}

function choiceLabel(choice: number) {
  if (choice === 0) return 'Búa';
  if (choice === 1) return 'Bao';
  if (choice === 2) return 'Kéo';
  return 'Không rõ';
}

function decideWinner(player1Choice: number, player2Choice: number) {
  if (player1Choice === player2Choice) return 'draw';
  if (
    (player1Choice === 0 && player2Choice === 2)
    || (player1Choice === 1 && player2Choice === 0)
    || (player1Choice === 2 && player2Choice === 1)
  ) return 'player1';
  return 'player2';
}

function parseGameObject(raw: unknown): ParsedGame | null {
  const fields = (raw as { data?: { content?: { fields?: Record<string, unknown> } } })?.data?.content?.fields;
  if (!fields) return null;
  const wagerField = fields.wager as { value?: string } | undefined;
  return {
    player1: String(fields.player1 ?? ''),
    player2: String(fields.player2 ?? ''),
    player2Choice: Number(fields.player2_choice ?? 0),
    wagerMist: BigInt(String(wagerField?.value ?? '0')),
    status: parseState(fields.state),
    timeoutAtMs: BigInt(String(fields.timeout_at_ms ?? '0')),
    closed: Boolean(fields.closed ?? false),
  };
}

// --- UI Layer: Components ---
interface PlayerInfoProps {
  label: string;
  address: string;
  status: GameStatus;
  isCurrentPlayer: boolean;
}

const PlayerCard: React.FC<PlayerInfoProps> = ({ label, address, status, isCurrentPlayer }) => {
  const getBadge = () => {
    switch (status) {
      case 'waiting': return <span className="badge bg-secondary">Đang đợi...</span>;
      case 'staked': return <span className="badge bg-success">Đã đặt cược</span>;
      case 'reveal': return <span className="badge bg-warning text-dark">Chờ lật bài</span>;
      case 'finished': return <span className="badge bg-info text-dark">Hoàn thành</span>;
      default: return null;
    }
  };

  return (
    <div className={`glass-card rounded-4 float-animation ${isCurrentPlayer ? 'border-primary border-opacity-50' : ''}`} style={{ animationDelay: label.includes('1') ? '0s' : '0.5s' }}>
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="text-muted mb-0 fw-semibold">{label}</h6>
          {getBadge()}
        </div>
        <div className="d-flex align-items-center mb-2">
          <div className="avatar me-3 bg-white bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center pulse-glow" style={{ width: '56px', height: '56px' }}>
            <i className={`bi ${!address ? 'bi-person text-muted' : 'bi-person-check-fill text-info'} fs-3`}></i>
          </div>
          <div className="overflow-hidden">
            <div className="fw-bold text-truncate text-white" style={{ maxWidth: '180px' }}>
              {address || 'Chưa có người chơi'}
            </div>
            <div className="small text-muted text-opacity-75">
              {address ? 'Địa chỉ ví đã kết nối' : 'Đang chờ đối thủ'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const GameDashboard: React.FC<GameDashboardProps> = ({ gameId, inviteLink, txDigest, onBackHome }) => {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction();
  const { data, refetch, isLoading } = useSuiClientQuery('getObject', {
    id: gameId,
    options: { showContent: true },
  });

  const game = parseGameObject(data);
  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nowMs, setNowMs] = React.useState<bigint>(BigInt(Date.now()));

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(BigInt(Date.now()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const canClaimTimeout = !!game && nowMs >= game.timeoutAtMs && game.status !== 'finished';
  const remainingMs = game ? game.timeoutAtMs - nowMs : 0n;
  const timeoutLabel = canClaimTimeout
    ? 'Đã hết hạn - có thể claim timeout'
    : `Còn lại: ${formatDuration(remainingMs)}`;
  const isWaitingLobby = !!game && game.status === 'waiting';

  const isPlayer1 = !!account && !!game && account.address.toLowerCase() === game.player1.toLowerCase();
  const isPlayer2 = !!account && !!game && account.address.toLowerCase() === game.player2.toLowerCase();

  // --- Auto Reveal Feature ---
  React.useEffect(() => {
    if (game?.status === 'reveal' && isPlayer1 && !isPending && !statusMsg?.includes('thành công')) {
      const saved = window.localStorage.getItem(`bbk:secret:${gameId}`);
      if (saved) {
        console.log('Phát hiện đối thủ đã tham gia, tự động lật bài...');
        doReveal();
      }
    }
  }, [game?.status, isPlayer1]);

  const doReveal = async () => {
    try {
      setError(null);
      const saved = window.localStorage.getItem(`bbk:secret:${gameId}`);
      if (!saved) throw new Error('Không tìm thấy secret của phòng này trên trình duyệt.');
      const parsed = JSON.parse(saved) as { choice: number; salt: string };
      const encoder = new TextEncoder();
      const saltBytes = Array.from(encoder.encode(parsed.salt));
      setStatusMsg('Đang reveal kết quả...');
      const tx = new Transaction();
      tx.moveCall({
        target: `${import.meta.env.VITE_PACKAGE_ID}::contractsb_b_k_prm::reveal_and_settle`,
        arguments: [
          tx.object(gameId),
          tx.pure.u8(parsed.choice),
          tx.pure.vector('u8', saltBytes),
        ],
      });
      const result = await signAndExecuteTransaction({ transaction: tx });
      setStatusMsg(`Reveal thành công. Tx: ${result.digest}`);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể reveal.');
    }
  };

  const doClaimTimeout = async () => {
    try {
      setError(null);
      setStatusMsg('Đang claim timeout...');
      const tx = new Transaction();
      tx.moveCall({
        target: `${import.meta.env.VITE_PACKAGE_ID}::contractsb_b_k_prm::claim_timeout`,
        arguments: [tx.object(gameId), tx.object(CLOCK_OBJECT_ID)],
      });
      const result = await signAndExecuteTransaction({ transaction: tx });
      setStatusMsg(`Claim timeout thành công. Tx: ${result.digest}`);
      await refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể claim timeout.');
    }
  };

  const stakeText = game ? mistToSuiString(game.wagerMist * 2n) : 'Đang tải...';
  const statusForP1: GameStatus = game?.status === 'waiting' ? 'staked' : game?.status ?? 'waiting';
  const statusForP2: GameStatus = game?.status === 'waiting' ? 'waiting' : game?.status ?? 'waiting';
  const savedSecret = window.localStorage.getItem(`bbk:secret:${gameId}`);
  const localSecret = savedSecret ? (JSON.parse(savedSecret) as { choice: number; salt: string }) : null;
  const [showRecovery, setShowRecovery] = React.useState(false);
  const [recoveryChoice, setRecoveryChoice] = React.useState(0);
  const [recoverySalt, setRecoverySalt] = React.useState('');

  const saveRecovery = () => {
    if (!recoverySalt.trim()) return;
    window.localStorage.setItem(`bbk:secret:${gameId}`, JSON.stringify({
      choice: recoveryChoice,
      salt: recoverySalt.trim()
    }));
    setShowRecovery(false);
    setStatusMsg('Đã khôi phục mã bí mật từ dữ liệu bạn nhập.');
  };

  const finishedResult = game?.status === 'finished' && localSecret
    ? decideWinner(localSecret.choice, game.player2Choice)
    : null;
  const isClosedRoom = !!game?.closed;

  return (
    <div className="game-dashboard py-5">
      <div className="container">
        {isClosedRoom ? (
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="alert alert-danger shadow-sm">
                <div className="fw-bold mb-2">Phòng không tồn tại</div>
                <div>
                  Phòng này đã bị đóng sau khi quá hạn chờ người chơi vào và chủ phòng đã hoàn tiền.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* Recovery UI if secret is missing for P1 */}
        {isPlayer1 && !localSecret && (
          <div className="row justify-content-center mb-4">
            <div className="col-lg-10">
              <div className="card border-danger border-opacity-25 bg-danger bg-opacity-10 shadow-sm rounded-4">
                <div className="card-body p-4">
                  <div className="d-flex align-items-center mb-3 text-danger">
                    <i className="bi bi-exclamation-octagon-fill fs-4 me-3"></i>
                    <h5 className="mb-0 fw-bold">Không tìm thấy mã bí mật!</h5>
                  </div>
                  <p className="mb-3">
                    Trình duyệt này không lưu thông tin nước đi của bạn. Nếu bạn đã tạo phòng này ở máy khác hoặc xóa cache, bạn cần nhập lại mã bí mật để có thể <strong>Reveal</strong> và nhận giải.
                  </p>
                  {!showRecovery ? (
                    <button className="btn btn-danger rounded-pill px-4" onClick={() => setShowRecovery(true)}>
                      Khôi phục ngay
                    </button>
                  ) : (
                    <div className="bg-white p-3 rounded-3 border">
                      <div className="row g-3">
                        <div className="col-md-4">
                          <label className="form-label small fw-bold">Nước đi bạn đã chọn</label>
                          <select className="form-select form-select-sm" value={recoveryChoice} onChange={e => setRecoveryChoice(Number(e.target.value))}>
                            <option value={0}>Búa</option>
                            <option value={1}>Bao</option>
                            <option value={2}>Kéo</option>
                          </select>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-bold">Mã bí mật (Salt)</label>
                          <input type="text" className="form-control form-control-sm font-monospace" value={recoverySalt} onChange={e => setRecoverySalt(e.target.value)} placeholder="Dán mã salt của bạn vào đây" />
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                          <button className="btn btn-primary btn-sm w-100" onClick={saveRecovery}>Lưu</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="row justify-content-center mb-4">
          <div className="col-lg-10">
            <div className="alert alert-success shadow-sm">
              <div className="fw-bold">Tạo phòng thành công</div>
              <div className="small mb-2">Game ID: <code>{gameId}</code></div>
              {txDigest && <div className="small mb-2">Tx: <code>{txDigest}</code></div>}
              <div className="d-flex gap-2 flex-wrap">
                <input className="form-control" value={inviteLink} readOnly />
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => navigator.clipboard.writeText(inviteLink)}
                >
                  Copy link mời
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="row justify-content-center mb-5">
          <div className="col-md-8 text-center">
            <h2 className="fw-bold mb-4 text-white">Bàn đấu #{shortAddress(gameId)}</h2>
            <div className="d-inline-block glass-card rounded-pill px-5 py-3 pulse-glow">
              <span className="text-white me-3 fs-5">Tổng giải thưởng (Pot):</span>
              <span className="fw-bold text-info fs-3">{stakeText}</span>
            </div>
          </div>
        </div>

        {isWaitingLobby ? (
          <div className="row justify-content-center mb-4">
            <div className="col-lg-10">
              <div className="card border-0 shadow-lg rounded-4">
                <div className="card-body p-4 p-md-5">
                  <h4 className="fw-bold mb-3">Sảnh chờ</h4>
                  <p className="text-muted mb-4">
                    Phòng đã được tạo. Gửi link mời cho người chơi B và chờ họ tham gia trước khi hết thời gian.
                  </p>

                  <div className="d-flex align-items-center justify-content-between bg-light rounded-3 p-3 mb-3 flex-wrap gap-2">
                    <div>
                      <div className="small text-muted">Thời gian chờ người chơi vào phòng</div>
                      <div className={`fs-4 fw-bold ${canClaimTimeout ? 'text-danger' : 'text-primary'}`}>
                        {canClaimTimeout ? '00:00' : formatDuration(remainingMs)}
                      </div>
                    </div>
                    <span className={`badge ${canClaimTimeout ? 'bg-danger' : 'bg-secondary'} fs-6 px-3 py-2`}>
                      {canClaimTimeout ? 'Hết thời gian chờ' : 'Đang chờ đối thủ'}
                    </span>
                  </div>

                  <div className="alert alert-info mb-3">
                    {canClaimTimeout
                      ? 'Không có người tham gia trong 2 phút. Bạn có thể bấm "Claim timeout" để hoàn lại SUI.'
                      : 'Nếu sau 2 phút không có ai vào phòng, bạn sẽ được hoàn lại SUI qua nút "Claim timeout".'}
                  </div>

                  <div className="d-flex gap-2 flex-wrap">
                    <input className="form-control" value={inviteLink} readOnly />
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => navigator.clipboard.writeText(inviteLink)}
                    >
                      Copy link mời
                    </button>
                    <button className="btn btn-outline-secondary" type="button" onClick={onBackHome}>
                      Quay lại trang chủ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="row g-4 align-items-center">
            <div className="col-md-5">
              <PlayerCard 
                label="Người chơi 1 (Chủ phòng)" 
                address={game ? shortAddress(game.player1) : ''} 
                status={statusForP1}
                isCurrentPlayer={!!isPlayer1}
              />
            </div>
            
            <div className="col-md-2 d-flex align-items-center justify-content-center py-3">
              <div className="vs-badge text-white shadow rounded-circle border border-2 border-info border-opacity-50 d-flex align-items-center justify-content-center fw-bold fs-5 pulse-glow" style={{ width: '64px', height: '64px', zIndex: 1 }}>
                VS
              </div>
            </div>

            <div className="col-md-5">
              <PlayerCard 
                label="Người chơi 2 (Đối thủ)" 
                address={game ? shortAddress(game.player2) : ''} 
                status={statusForP2}
                isCurrentPlayer={!!isPlayer2}
              />
            </div>
          </div>
        )}

        <div className="row mt-5">
          <div className="col-12 text-center">
            {!isLoading && game && game.status !== 'finished' && (
              <div className={`alert ${canClaimTimeout ? 'alert-danger' : 'alert-secondary'} border-0 shadow-sm rounded-pill d-inline-block px-4 mb-3`}>
                <i className="bi bi-clock-history me-2"></i>
                Timeout: <strong>{timeoutLabel}</strong>
              </div>
            )}
            {isLoading || !game ? (
              <div className="alert alert-secondary border-0 shadow-sm rounded-pill d-inline-block px-5">
                Đang tải dữ liệu game on-chain...
              </div>
            ) : game.status === 'waiting' ? (
              <div className="alert alert-info border-0 shadow-sm rounded-pill d-inline-block px-5">
                <span className="spinner-border spinner-border-sm me-3" role="status"></span>
                Đang chờ người chơi thứ 2 mở link mời và tham gia...
              </div>
            ) : (
              <div className="alert alert-warning border-0 shadow-sm rounded-pill d-inline-block px-5">
                <i className="bi bi-unlock-fill me-2"></i>
                Cả 2 đã sẵn sàng! Người chơi 1 hãy <strong>Lật bài</strong> để kết thúc trận đấu.
              </div>
            )}
          </div>
        </div>

        <div className="row mt-4">
          <div className="col-12 d-flex justify-content-center gap-2 flex-wrap">
            {game?.status === 'reveal' && isPlayer1 && (
              <button className="btn btn-warning" type="button" onClick={doReveal} disabled={isPending}>
                Reveal kết quả
              </button>
            )}

            {canClaimTimeout && (
              <button className="btn btn-danger" type="button" onClick={doClaimTimeout} disabled={isPending}>
                Claim timeout
              </button>
            )}
          </div>
        </div>

        {statusMsg && (
          <div className="row mt-3">
            <div className="col-12">
              <div className="alert alert-success">{statusMsg}</div>
            </div>
          </div>
        )}
        {error && (
          <div className="row mt-3">
            <div className="col-12">
              <div className="alert alert-danger">{error}</div>
            </div>
          </div>
        )}

        {game?.status === 'finished' && (
          <div className="row mt-3">
            <div className="col-12">
              <div className="alert alert-info">
                <div className="fw-bold mb-2">Kết quả trận đấu</div>
                <div>Player2 đã chọn: <strong>{choiceLabel(game.player2Choice)}</strong></div>
                {localSecret ? (
                  <>
                    <div>Player1 đã chọn: <strong>{choiceLabel(localSecret.choice)}</strong></div>
                    <div className="mt-2">
                      {finishedResult === 'draw' && 'Kết quả: Hòa, phần thưởng đã chia đều on-chain.'}
                      {finishedResult === 'player1' && 'Kết quả: Player1 thắng, nhận toàn bộ pot on-chain.'}
                      {finishedResult === 'player2' && 'Kết quả: Player2 thắng, nhận toàn bộ pot on-chain.'}
                    </div>
                  </>
                ) : (
                  <div className="mt-2">
                    Trận đấu đã kết thúc và đã trả thưởng on-chain. Trình duyệt này không có secret của player1 nên không suy ra trực tiếp người thắng.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default GameDashboard;
