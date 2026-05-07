import React from 'react'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'

type FriendManagerProps = {
  onInviteRequested?: (friendAddress: string) => void
}

const STORAGE_KEY = 'bbk:friends'
const CLOCK_OBJECT_ID = '0x6'
// Coi là online nếu đã ping trong khoảng thời gian "quá hạn" này.
// Lưu ý: hiện app ping mỗi ~2 phút, nên cần cửa sổ lớn hơn để tránh flicker offline/online.
const ONLINE_WINDOW_MS = 180_000 // 3 phút
const PRESENCE_REFRESH_MS = 15_000 // refresh online/offline từ event
const PING_EVERY_MS = 2 * 60_000 // chỉ ping 2 phút/lần để giảm số lần approve

function normalizeAddress(addr: string) {
  return addr.trim().toLowerCase()
}

function isValidSuiAddress(addr: string) {
  const a = normalizeAddress(addr)
  // Sui address format: 0x + up to 64 hex chars
  return /^0x[a-f0-9]{1,64}$/.test(a)
}

function shortAddress(value: string) {
  if (!value || value.length < 12) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

const FriendManager: React.FC<FriendManagerProps> = ({ onInviteRequested }) => {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction()

  const packageId = import.meta.env.VITE_PACKAGE_ID as string | undefined

  const [friends, setFriends] = React.useState<string[]>([])
  const [newFriend, setNewFriend] = React.useState('')
  const [onlineMap, setOnlineMap] = React.useState<Record<string, boolean>>({})
  const [pingEnabled, setPingEnabled] = React.useState(true)
  const [pingStatus, setPingStatus] = React.useState<string | null>(null)
  const [presenceError, setPresenceError] = React.useState<string | null>(null)

  // Load from localStorage once.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return
      }
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const cleaned = parsed.map((x) => String(x).toLowerCase()).filter((x) => isValidSuiAddress(x))
      window.setTimeout(() => {
        setFriends(Array.from(new Set(cleaned)))
      }, 0)
    } catch {
      // Nếu localStorage bị lỗi thì giữ state mặc định []
    }
  }, [])

  const persistFriends = React.useCallback((next: string[]) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const addFriend = () => {
    if (!isValidSuiAddress(newFriend)) return
    const me = account?.address ? normalizeAddress(account.address) : ''
    const f = normalizeAddress(newFriend)
    if (me && f === me) return
    const next = Array.from(new Set([...friends, f]))
    setFriends(next)
    persistFriends(next)
    setNewFriend('')
  }

  const removeFriend = (addr: string) => {
    const next = friends.filter((f) => f !== addr)
    setFriends(next)
    persistFriends(next)
  }

  const doPing = React.useCallback(async () => {
    if (!packageId) throw new Error('Thiếu VITE_PACKAGE_ID.')
    if (!account?.address) return

    const tx = new Transaction()
    tx.moveCall({
      target: `${packageId}::contractsb_b_k_prm::ping`,
      arguments: [tx.object(CLOCK_OBJECT_ID)],
    })

    const res = await signAndExecuteTransaction({ transaction: tx })
    setPingStatus(`Ping thành công. Tx: ${res.digest}`)
  }, [account?.address, packageId, signAndExecuteTransaction])

  // Periodic ping while user keeps "pingEnabled".
  React.useEffect(() => {
    if (!account?.address) return
    if (!pingEnabled) return

    let cancelled = false
    const run = async () => {
      if (cancelled) return
      try {
        await doPing()
      } catch (e) {
        setPingStatus(e instanceof Error ? e.message : 'Ping thất bại')
      }
    }

    // Ping immediately and then every interval.
    run()

    const id = window.setInterval(() => run(), PING_EVERY_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [account?.address, doPing, pingEnabled])

  // Query last PresencePing events and compute online map.
  React.useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      if (!packageId) return
      if (friends.length === 0) {
        setOnlineMap({})
        return
      }

      try {
        setPresenceError(null)

        type PresencePingEvent = {
          parsedJson?: {
            user?: string
            last_seen_ms?: string | number
          }
        }

        const res = await client.queryEvents({
          query: {
            MoveEventType: `${packageId}::contractsb_b_k_prm::PresencePing`,
          } as unknown as { MoveEventType: string },
          limit: 100,
          order: 'descending',
        })

        const now = Date.now()
        const wanted = new Set(friends.map(normalizeAddress))
        const latestSeen: Record<string, number> = {}

        const events = (res as unknown as { data?: PresencePingEvent[] }).data ?? []
        for (const ev of events) {
          const pj = ev.parsedJson ?? {}
          const user = pj?.user ? normalizeAddress(String(pj.user)) : ''
          if (!user || !wanted.has(user) || latestSeen[user] != null) continue

          const lastSeenRaw = pj?.last_seen_ms
          const lastSeenMs = Number(lastSeenRaw)
          if (!Number.isFinite(lastSeenMs) || lastSeenMs <= 0) continue
          latestSeen[user] = lastSeenMs
        }

        const nextOnline: Record<string, boolean> = {}
        for (const f of friends) {
          const seen = latestSeen[normalizeAddress(f)]
          nextOnline[f] = seen != null && now - seen <= ONLINE_WINDOW_MS
        }

        if (!cancelled) setOnlineMap(nextOnline)
      } catch (e) {
        if (!cancelled) setPresenceError(e instanceof Error ? e.message : 'Không thể truy vấn PresencePing.')
      }
    }

    refresh()
    const id = window.setInterval(() => refresh(), PRESENCE_REFRESH_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [client, friends, packageId])

  return (
    <section className="mb-4">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-1">Bạn bè</h4>
          <div className="text-muted small">Online dựa trên event `PresencePing`.</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm ${pingEnabled ? 'btn-success' : 'btn-outline-secondary'} rounded-pill`}
            onClick={() => setPingEnabled((v) => !v)}
            disabled={!account || isPending}
            title="Bật/tắt việc tự động ping để người khác thấy bạn online"
          >
            {pingEnabled ? 'Online: ON' : 'Online: OFF'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary rounded-pill"
            onClick={() => doPing().catch(() => undefined)}
            disabled={!account || isPending}
          >
            Ping ngay
          </button>
        </div>
      </div>

      <div className="card glass-card border-0 shadow-sm rounded-4 p-3">
        <div className="d-flex gap-2 mb-3 flex-wrap">
          <input
            className="form-control"
            placeholder="Nhập địa chỉ bạn (0x...)"
            value={newFriend}
            onChange={(e) => setNewFriend(e.target.value)}
            disabled={!account}
          />
          <button
            type="button"
            className="btn btn-success rounded-pill px-4"
            onClick={addFriend}
            disabled={!account || !isValidSuiAddress(newFriend)}
          >
            Thêm
          </button>
        </div>

        {!account ? (
          <div className="alert alert-secondary border-0">
            Kết nối ví để thêm bạn và hiển thị online/offline.
          </div>
        ) : friends.length === 0 ? (
          <div className="alert alert-info border-0 mb-0">Bạn chưa có danh sách bạn bè.</div>
        ) : (
          <div className="row g-2">
            {friends.map((f) => {
              const online = !!onlineMap[f]
              return (
                <div key={f} className="col-12">
                  <div className="d-flex align-items-center justify-content-between bg-white bg-opacity-5 border rounded-3 px-3 py-2">
                    <div className="d-flex align-items-center gap-3 overflow-hidden">
                      <div className="avatar bg-white bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center pulse-glow" style={{ width: 42, height: 42 }}>
                        <i className="bi bi-person-check-fill text-info" />
                      </div>
                      <div className="overflow-hidden">
                        <div className="fw-bold text-truncate">{shortAddress(f)}</div>
                        <div className="small text-muted">{online ? 'Đang online' : 'Đang offline'}</div>
                      </div>
                      <span className={`badge ${online ? 'bg-success' : 'bg-secondary'} ms-2`}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-primary rounded-pill"
                        onClick={() => onInviteRequested?.(f)}
                        disabled={!online || !onInviteRequested}
                        title={!online ? 'Bạn bè đang offline' : 'Mời chơi'}
                      >
                        Mời chơi
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary rounded-pill px-3"
                        onClick={() => removeFriend(f)}
                        disabled={isPending}
                        title="Xóa khỏi danh sách bạn bè"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {pingStatus && <div className="text-info small mt-3">{pingStatus}</div>}
        {presenceError && <div className="alert alert-warning border-0 mt-3 mb-0">{presenceError}</div>}
      </div>
    </section>
  )
}

export default FriendManager

