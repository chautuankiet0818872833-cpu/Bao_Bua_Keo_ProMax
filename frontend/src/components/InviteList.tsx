import React from 'react'
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'

type Invite = {
  gameId: string
  player1: string
  player2: string
  wagerMist: bigint
}

type InviteListProps = {
  onInviteAccepted?: (gameId: string, txDigest: string) => void
}

const CLOCK_OBJECT_ID = '0x6'
const MIST_PER_SUI = 1_000_000_000n
const REVEAL_TIMEOUT_MS = 5 * 60 * 1000
const CHOICE_ROCK = 0
const CHOICE_PAPER = 1
const CHOICE_SCISSORS = 2

const ACCEPT_POLL_MS = 10_000

function shortAddress(value: string) {
  if (!value || value.length < 12) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

function mistToSuiString(mist: bigint) {
  const whole = mist / MIST_PER_SUI
  const frac = mist % MIST_PER_SUI
  if (frac === 0n) return `${whole.toString()} SUI`
  const fracText = frac.toString().padStart(9, '0').replace(/0+$/, '')
  return `${whole.toString()}.${fracText} SUI`
}

function parseGameState(raw: unknown): string {
  if (typeof raw === 'string') {
    if (raw.includes('Waiting')) return 'Waiting'
    if (raw.includes('Reveal')) return 'Reveal'
    if (raw.includes('Finished')) return 'Finished'
    return 'Waiting'
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if ('Waiting' in obj) return 'Waiting'
    if ('Reveal' in obj) return 'Reveal'
    if ('Finished' in obj) return 'Finished'
  }
  return 'Waiting'
}

function choiceLabel(choice: number) {
  if (choice === CHOICE_ROCK) return 'Búa'
  if (choice === CHOICE_PAPER) return 'Bao'
  if (choice === CHOICE_SCISSORS) return 'Kéo'
  return 'Không rõ'
}

const InviteList: React.FC<InviteListProps> = ({ onInviteAccepted }) => {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const { mutateAsync: signAndExecuteTransaction, isPending } = useSignAndExecuteTransaction()

  const packageId = import.meta.env.VITE_PACKAGE_ID as string | undefined

  const [invites, setInvites] = React.useState<Invite[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const [activeInvite, setActiveInvite] = React.useState<Invite | null>(null)
  const [choice, setChoice] = React.useState<number>(CHOICE_ROCK)

  const doRefresh = React.useCallback(async () => {
    if (!packageId) return
    if (!account?.address) return

    const myAddr = account.address.toLowerCase()
    setLoading(true)
    setError(null)

    try {
      type GameCreatedEvent = {
        parsedJson?: {
          game_id?: string
          gameId?: string
          player1?: string
          player2?: string
          wager_amount?: string | number
          wagerAmount?: string | number
          wager?: string | number
          wagerAmountMist?: string | number
        }
      }

      const res = await client.queryEvents({
        query: {
          MoveEventType: `${packageId}::contractsb_b_k_prm::GameCreated`,
        } as unknown as { MoveEventType: string },
        limit: 50,
        order: 'descending',
      })

      const events = (res as unknown as { data?: GameCreatedEvent[] }).data ?? []
      const candidates: Invite[] = []

      for (const ev of events) {
        const pj = ev.parsedJson ?? {}
        const player2 = pj?.player2 ? String(pj.player2).toLowerCase() : ''
        if (!player2 || player2 !== myAddr) continue

        const gameId = pj?.game_id ? String(pj.game_id) : pj?.gameId ? String(pj.gameId) : ''
        const player1 = pj?.player1 ? String(pj.player1).toLowerCase() : ''

        const wagerRaw =
          pj?.wager_amount ?? pj?.wagerAmount ?? pj?.wager ?? pj?.wagerAmountMist
        const wagerMist = wagerRaw != null ? BigInt(String(wagerRaw)) : 0n

        if (!gameId || !player1 || wagerMist <= 0n) continue
        candidates.push({ gameId, player1, player2: player2, wagerMist })
      }

      // Verify game is still in Waiting state (and not closed).
      const nextInvites: Invite[] = []

      await Promise.all(
        candidates.slice(0, 10).map(async (c) => {
          try {
            const objRes = await client.getObject({
              id: c.gameId,
              options: { showContent: true },
            })

            const fields = (objRes as unknown as { data?: { content?: { fields?: { state?: unknown; closed?: boolean } } } })
              ?.data?.content?.fields
            if (!fields) return

            const state = parseGameState(fields.state)
            const closed = Boolean(fields.closed ?? false)
            if (state !== 'Waiting' || closed) return

            nextInvites.push({
              gameId: c.gameId,
              player1: c.player1,
              player2: c.player2,
              wagerMist: c.wagerMist,
            })
          } catch {
            // Ignore missing/invalid objects.
          }
        }),
      )

      // newest first by wager/gameId doesn't matter; keep insertion order.
      setInvites(nextInvites)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải lời mời.')
    } finally {
      setLoading(false)
    }
  }, [account, client, packageId])

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      doRefresh()
    }, 0)
    const id = window.setInterval(() => doRefresh(), ACCEPT_POLL_MS)
    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(id)
    }
  }, [doRefresh])

  const doJoin = React.useCallback(async () => {
    if (!packageId) throw new Error('Thiếu VITE_PACKAGE_ID.')
    if (!activeInvite) return

    const tx = new Transaction()
    const wagerMist = activeInvite.wagerMist
    const [wagerCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(wagerMist)])

    tx.moveCall({
      target: `${packageId}::contractsb_b_k_prm::join_game`,
      arguments: [
        tx.object(activeInvite.gameId),
        wagerCoin,
        tx.pure.u8(choice),
        tx.pure.u64(REVEAL_TIMEOUT_MS),
        tx.object(CLOCK_OBJECT_ID),
      ],
    })

    const result = await signAndExecuteTransaction({ transaction: tx })
    onInviteAccepted?.(activeInvite.gameId, result.digest)
    setActiveInvite(null)
    await doRefresh()
  }, [activeInvite, choice, doRefresh, onInviteAccepted, packageId, signAndExecuteTransaction])

  return (
    <section className="mb-4">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-1">Lời mời đang chờ</h4>
          <div className="text-muted small">Chỉ hiện khi bạn là `player2` trong Game đang ở `Waiting`.</div>
        </div>
      </div>

      {error && <div className="alert alert-warning border-0">{error}</div>}

      {!account ? (
        <div className="alert alert-secondary border-0">Kết nối ví để xem lời mời.</div>
      ) : loading ? (
        <div className="alert alert-secondary border-0">Đang tải lời mời...</div>
      ) : invites.length === 0 ? (
        <div className="alert alert-info border-0">Chưa có lời mời nào.</div>
      ) : (
        <div className="row g-3">
          {invites.map((inv) => (
            <div key={inv.gameId} className="col-12">
              <div className="glass-card rounded-4 p-3 border border-opacity-10 bg-white bg-opacity-5">
                <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                  <div>
                    <div className="fw-bold">Từ: {shortAddress(inv.player1)}</div>
                    <div className="text-muted small">Game: {shortAddress(inv.gameId)}</div>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold text-info">{mistToSuiString(inv.wagerMist)}</div>
                    <div className="small text-muted">Pot: {mistToSuiString(inv.wagerMist * 2n)}</div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-primary rounded-pill px-4"
                      onClick={() => {
                        setChoice(CHOICE_ROCK)
                        setActiveInvite(inv)
                      }}
                      disabled={isPending}
                    >
                      Chấp nhận
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accept modal */}
      <div
        className={`modal fade ${activeInvite ? 'show d-block' : 'd-none'}`}
        tabIndex={-1}
        role="dialog"
        aria-hidden={!activeInvite}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content glass-card border-0 shadow-lg overflow-hidden">
            <div className="modal-header border-0 pb-0 pt-4 px-4">
              <h5 className="modal-title fw-bold text-white fs-4">Chấp nhận lời mời</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={() => setActiveInvite(null)}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body p-4 text-dark">
              <div className="mb-3">
                <div className="fw-bold">Chọn nước đi của bạn</div>
                <div className="small text-muted">
                  {activeInvite ? `Pot: ${mistToSuiString(activeInvite.wagerMist * 2n)}` : ''}
                </div>
              </div>

              <div className="d-flex gap-2 justify-content-center mb-3">
                <button
                  type="button"
                  className={`btn flex-fill py-3 rounded-4 fw-bold ${choice === CHOICE_ROCK ? 'btn-primary' : 'btn-outline-light'}`}
                  onClick={() => setChoice(CHOICE_ROCK)}
                >
                  👊 Búa
                </button>
                <button
                  type="button"
                  className={`btn flex-fill py-3 rounded-4 fw-bold ${choice === CHOICE_PAPER ? 'btn-primary' : 'btn-outline-light'}`}
                  onClick={() => setChoice(CHOICE_PAPER)}
                >
                  ✋ Bao
                </button>
                <button
                  type="button"
                  className={`btn flex-fill py-3 rounded-4 fw-bold ${choice === CHOICE_SCISSORS ? 'btn-primary' : 'btn-outline-light'}`}
                  onClick={() => setChoice(CHOICE_SCISSORS)}
                >
                  ✌️ Kéo
                </button>
              </div>

              <div className="alert alert-info border-0">
                Bạn chọn: <strong>{choiceLabel(choice)}</strong>. Sau khi chấp nhận, app sẽ gọi `join_game`.
              </div>
              <div className="text-danger small">
                Lưu ý: Bạn cần approve transaction khi ví yêu cầu.
              </div>
            </div>

            <div className="modal-footer border-0 p-4 pt-0">
              <button type="button" className="btn btn-outline-secondary rounded-pill px-4" onClick={() => setActiveInvite(null)} disabled={isPending}>
                Hủy
              </button>
              <button type="button" className="btn btn-primary rounded-pill px-4" onClick={() => doJoin().catch((e) => setError(e instanceof Error ? e.message : 'Không thể join'))} disabled={isPending}>
                {isPending ? 'Đang xử lý...' : 'Chấp nhận & vào trận'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default InviteList

