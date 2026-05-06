import React, { useState, useEffect } from 'react';

// --- Logic Layer: Mock Data & Types ---
// Tách biệt phần này để dễ dàng thay thế bằng hooks từ Sui SDK sau này
type GameStatus = 'waiting' | 'staked' | 'reveal' | 'finished';

interface GameData {
  status: GameStatus;
  player1: string;
  player2: string;
  stake: string;
  gameId: string;
}

const INITIAL_MOCK_DATA: GameData = {
  gameId: '12345',
  player1: '0x123...abc',
  player2: '',
  status: 'waiting',
  stake: '1.0 SUI'
};

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
    <div className={`card border-0 shadow-sm rounded-4 ${isCurrentPlayer ? 'border-start border-4 border-primary' : ''}`}>
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="text-muted mb-0">{label}</h6>
          {getBadge()}
        </div>
        <div className="d-flex align-items-center mb-2">
          <div className="avatar me-3 bg-light rounded-circle d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
            <i className={`bi ${!address ? 'bi-person text-muted' : 'bi-person-check-fill text-primary'} fs-4`}></i>
          </div>
          <div>
            <div className="fw-bold text-truncate" style={{ maxWidth: '150px' }}>
              {address || 'Chưa có người chơi'}
            </div>
            <div className="small text-muted">
              {address ? 'Địa chỉ ví đã kết nối' : 'Đang chờ đối thủ'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const GameDashboard: React.FC = () => {
  const [game, setGame] = useState<GameData>(INITIAL_MOCK_DATA);

  // Giả lập logic: Chuyển sang trạng thái REVEAL sau 5 giây
  useEffect(() => {
    const timer = setTimeout(() => {
      setGame(prev => ({
        ...prev,
        player2: '0x456...def',
        status: 'reveal',
        stake: '2.0 SUI'
      }));
      console.log('MOCK LOGIC: Trò chơi đã chuyển sang trạng thái REVEAL');
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="game-dashboard py-5">
      <div className="container">
        <div className="row justify-content-center mb-5">
          <div className="col-md-8 text-center">
            <h2 className="fw-bold mb-4">Bàn đấu #{game.gameId}</h2>
            <div className="d-inline-block bg-white shadow-sm rounded-pill px-4 py-2 border">
              <span className="text-muted me-2">Tổng giải thưởng (Pot):</span>
              <span className="fw-bold text-primary fs-5">{game.stake}</span>
            </div>
          </div>
        </div>

        <div className="row g-4 align-items-center">
          <div className="col-md-5">
            <PlayerCard 
              label="Người chơi 1 (Chủ phòng)" 
              address={game.player1} 
              status={game.status === 'reveal' ? 'reveal' : 'staked'} 
              isCurrentPlayer={true}
            />
          </div>
          
          <div className="col-md-2 d-flex align-items-center justify-content-center py-3">
            <div className="vs-badge bg-primary text-white shadow rounded-circle border border-4 border-white d-flex align-items-center justify-content-center fw-bold fs-5" style={{ width: '60px', height: '60px', zIndex: 1 }}>
              VS
            </div>
          </div>

          <div className="col-md-5">
            <PlayerCard 
              label="Người chơi 2 (Đối thủ)" 
              address={game.player2} 
              status={game.status === 'reveal' ? 'reveal' : 'waiting'} 
              isCurrentPlayer={false}
            />
          </div>
        </div>

        <div className="row mt-5">
          <div className="col-12 text-center">
            {game.status === 'waiting' ? (
              <div className="alert alert-info border-0 shadow-sm rounded-pill d-inline-block px-5">
                <span className="spinner-border spinner-border-sm me-3" role="status"></span>
                Đang chờ người chơi thứ 2 tham gia...
              </div>
            ) : (
              <div className="alert alert-warning border-0 shadow-sm rounded-pill d-inline-block px-5">
                <i className="bi bi-unlock-fill me-2"></i>
                Cả 2 đã sẵn sàng! Người chơi 1 hãy <strong>Lật bài</strong> để kết thúc trận đấu.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameDashboard;
