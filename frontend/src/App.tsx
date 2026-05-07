import './App.css'
import { useState } from 'react'
import Navbar from './components/Navbar'
import GameDashboard from './components/GameDashboard'
import FriendManager from './components/FriendManager'
import InviteList from './components/InviteList'
import CreateInviteModal from './components/CreateInviteModal'

function App() {
  const [activeGameId, setActiveGameId] = useState('')
  const [lastTxDigest, setLastTxDigest] = useState('')
  const [inviteFriend, setInviteFriend] = useState<string | null>(null)

  const onBackHome = () => {
    setActiveGameId('')
    setLastTxDigest('')
    setInviteFriend(null)
  }

  const onCreatedGame = (gameId: string, txDigest: string, secret: { choice: number; salt: string }) => {
    setActiveGameId(gameId)
    setLastTxDigest(txDigest)
    window.localStorage.setItem(`bbk:secret:${gameId}`, JSON.stringify(secret))
  }

  const onInviteAccepted = (gameId: string, txDigest: string) => {
    setActiveGameId(gameId)
    setLastTxDigest(txDigest)
  }

  return (
    <div className="min-vh-100 bg-dark text-white">
      <Navbar />

      <CreateInviteModal
        open={inviteFriend != null}
        friendAddress={inviteFriend}
        onClose={() => setInviteFriend(null)}
        onCreated={onCreatedGame}
      />

      <main className="container py-5">
        {activeGameId ? (
          <GameDashboard
            gameId={activeGameId}
            inviteLink=""
            txDigest={lastTxDigest}
            onBackHome={onBackHome}
          />
        ) : (
          <div className="row justify-content-center g-4 mb-5">
            <div className="col-lg-11">
              <div className="glass-card rounded-4 overflow-hidden">
                <div className="card-body p-4 p-md-5">
                  <div className="text-center mb-5">
                    <h1
                      className="fw-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400"
                      style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                    >
                      Keo Bua Bao ProMax
                    </h1>
                    <p className="text-muted mb-4 fs-5">Trò chơi Kéo Búa Bao phi tập trung trên mạng lưới Sui</p>
                  </div>

                  <div className="row g-4">
                    <div className="col-lg-6">
                      <FriendManager onInviteRequested={(addr) => setInviteFriend(addr)} />
                    </div>
                    <div className="col-lg-6">
                      <InviteList onInviteAccepted={onInviteAccepted} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
