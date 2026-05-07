# Quick Reference Card

## 🚀 Quick Commands

### Smart Contract
```bash
# Build
sui move build

# Test
sui move test

# Publish
sui client publish --gas-budget 100000000

# Check address
sui client active-address
```

### Frontend
```bash
# Install
cd frontend && pnpm install

# Dev server
pnpm dev

# Build
pnpm build

# Test
pnpm test

# Lint
pnpm lint
```

---

## 🎮 Game Choices

| Choice | Code | Emoji |
|--------|------|-------|
| Rock/Búa | 0 | 👊 |
| Paper/Bao | 1 | ✋ |
| Scissors/Kéo | 2 | ✌️ |

---

## 💰 Currency Conversion

```typescript
// SUI to Mist (1 SUI = 1,000,000,000 mist)
const mist = toMist("1.5")  // 1,500,000,000n

// Mist to SUI
const sui = mistToSui(1_500_000_000n)  // "1.5"
```

---

## 🔐 Secret Management

```typescript
// Save secret
await saveSecretFallback(gameId, choice, salt)

// Get secret
const secret = await getSecretWithFallback(gameId)
// Returns: { choice: 0, salt: "..." } or null
```

---

## ❌ Error Handling

```typescript
import { parseError, getErrorMessage } from './utils/errorHandler'

try {
  // ... code
} catch (error) {
  const { message, recoverable } = parseError(error)
  if (recoverable) {
    // Retry logic
  }
}
```

---

## ⏱️ Timeouts

| Phase | Default | Configurable |
|-------|---------|--------------|
| Join | 2 min | Yes |
| Reveal | 10 min | Yes |
| Secret expiry | 30 days | No |

---

## 📊 Game States

```
Waiting  ──join_game──>  Reveal  ──reveal_and_settle──>  Finished
                              └─────claim_timeout─────┘
```

---

## 🔗 Smart Contract Functions

### Create Game
```move
create_game(
  wager_coin: Coin<SUI>,
  player2: address,
  commitment: vector<u8>,    // blake2b256 hash
  join_timeout_ms: u64,
  clock: &Clock
)
```

### Join Game
```move
join_game(
  game: &mut Game,
  wager_coin: Coin<SUI>,     // Must equal initial wager
  player2_choice: u8,        // 0-2
  reveal_timeout_ms: u64,
  clock: &Clock
)
```

### Reveal & Settle
```move
reveal_and_settle(
  game: Game,
  player1_choice: u8,        // 0-2
  salt: vector<u8>           // Original salt
)
```

### Claim Timeout
```move
claim_timeout(
  game: Game,
  clock: &Clock
)
```

---

## 🧪 Testing

### Create Test Game
1. Use testnet SUI from [faucet](https://discord.gg/sui)
2. Set small wager (0.1 SUI)
3. Use two different addresses
4. Verify on [Sui Explorer](https://explorer.sui.io/)

### Debug Game
```typescript
// Get game state
const gameData = await client.getObject({ id: gameId })
console.log(gameData.data?.content?.fields)

// Check transaction
const tx = await client.getTransactionBlock({ digest: txDigest })
console.log(tx.objectChanges)
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Package not found" | Update VITE_PACKAGE_ID |
| "Insufficient balance" | Fund wallet from faucet |
| "Game not found" | Refresh page, check network |
| "Invalid choice" | Use 0, 1, or 2 only |
| "Secret lost" | Re-enter salt on reveal |

---

## 📁 Key Files

| Path | Purpose |
|------|---------|
| `sources/bao_bua_keo_promax.move` | Smart contract |
| `frontend/src/utils/secretManager.ts` | Secret storage |
| `frontend/src/utils/errorHandler.ts` | Error handling |
| `frontend/src/utils/transactionHelper.ts` | Transaction helpers |
| `frontend/.env.local` | Configuration |

---

## 🔗 Links

- [Sui Docs](https://docs.sui.io/)
- [Explorer](https://explorer.sui.io/)
- [Testnet Faucet](https://discord.gg/sui)
- [Package Search](https://suiscan.xyz/)

---

## 📝 Checklists

### Before Deployment
- [ ] `sui move build` succeeds
- [ ] `sui move test` passes
- [ ] No TypeScript errors
- [ ] `.env.local` configured
- [ ] Tested with testnet wallet

### Before Publishing
- [ ] Contract compiled
- [ ] Sufficient gas budget
- [ ] Correct network selected
- [ ] Wallet has SUI balance

### After Deployment
- [ ] Package ID saved
- [ ] Frontend updated with Package ID
- [ ] Frontend builds successfully
- [ ] Can create test game
- [ ] Transaction visible on explorer

---

## ⚡ Performance Tips

- Use retry logic for network issues
- Cache game data when possible
- Batch transactions when allowed
- Monitor gas usage
- Clear expired secrets regularly

---

## 🔒 Security Notes

- Never commit `.env.local` with Package ID
- Validate all user inputs
- Use HTTPS in production
- Keep secrets in IndexedDB, not localStorage
- Review error messages (no info leaks)

---

**Last Updated:** May 8, 2026  
**Version:** 1.0
