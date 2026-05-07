import './App.css'
import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import GameDashboard from './components/GameDashboard'
import FriendManager from './components/FriendManager'
import InviteList from './components/InviteList'
import CreateInviteModal from './components/CreateInviteModal'

function App() {
  const [activeGameId, setActiveGameId] = useState('')
  const [lastTxDigest, setLastTxDigest] = useState('')
  const [inviteFriend, setInviteFriend] = useState<string | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = window.localStorage.getItem('bbk:theme')
    return stored === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark')
    document.documentElement.classList.toggle('theme-light', theme === 'light')
    window.localStorage.setItem('bbk:theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))

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
    <div className="min-vh-100">
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

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
                  <div className="text-center mb-5 hero-section">
                    <div className="hero-pill mb-3 d-inline-flex align-items-center gap-2">
                      <span className="hero-pill-badge">Bao ProMax</span>
                      <span className="text-uppercase fw-semibold text-muted small">Trò chơi blockchain</span>
                    </div>

                    <h1 className="promax-title">
                      Kéo Búa Bao ProMax
                    </h1>

                    <p className="hero-description mx-auto mb-4">
                      Trải nghiệm Kéo Búa Bao phi tập trung trên mạng lưới Sui với bảo mật,
                      minh bạch và thách đấu bạn bè ngay tức thì.
                    </p>

                    <div className="hero-tags d-flex justify-content-center flex-wrap gap-2">
                      <span className="hero-tag">Phi tập trung</span>
                      <span className="hero-tag">Minh bạch</span>
                      <span className="hero-tag">Mời bạn bè</span>
                      <span className="hero-tag">Kết quả ngay</span>
                    </div>
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
