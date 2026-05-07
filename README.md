# Bao Bua Keo ProMax 🎮

> **Rock Paper Scissors** on Sui blockchain - Decentralized, Trustless, Lightning-Fast

![Version](https://img.shields.io/badge/version-1.0-blue)
![Network](https://img.shields.io/badge/network-Sui%20Testnet-purple)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🚀 Quick Start

### Prerequisites
- [Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install) installed
- Node.js 18+
- pnpm (or npm/yarn)
- Sui testnet wallet with SUI balance

### Setup (5 minutes)

```bash
# 1. Build smart contract
cd .
sui move build

# 2. Publish to testnet
sui client publish --gas-budget 100000000

# 3. Copy Package ID from output
# Update frontend/.env.local with VITE_PACKAGE_ID

# 4. Setup frontend
cd frontend
pnpm install

# 5. Run development server
pnpm dev
```

Visit `http://localhost:5173` and connect your wallet!

---

## 🎮 How to Play

### Step 1: Create Game 🎯
- Click "Tạo lời mời"
- Choose your secret move (Búa/Bao/Kéo)
- Set wager amount
- Choose an opponent
- Confirm

### Step 2: Share Link 📱
- Send invite link to your friend
- They join and make their move
- Timer starts

### Step 3: Reveal & Win 🎊
- After opponent joins, reveal your move
- Smart contract determines winner
- Automatic payout

---

## 📋 Project Structure

```
Bao_Bua_Keo_proMax/
├── sources/                    # Smart contract
│   └── bao_bua_keo_promax.move
│
├── contractsB_B_K_PRM/        # Alternative module
│   └── sources/contractsb_b_k_prm.move
│
├── frontend/                   # React + TypeScript
│   ├── src/
│   │   ├── components/         # UI Components
│   │   ├── utils/             # Business logic
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── Move.toml                  # Smart contract config
└── OPTIMIZATION_GUIDE.md      # Detailed improvements
```

---

## 🛠 Smart Contract Functions

### `create_game()`
Player 1 creates a game with a commitment

```move
create_game(
  wager_coin: Coin<SUI>,
  player2: address,           // Player 2 address
  commitment: vector<u8>,     // Hashed choice
  join_timeout_ms: u64,       // Join phase timeout
  clock: &Clock
)
```

### `join_game()`
Player 2 joins and makes their move

```move
join_game(
  game: &mut Game,
  wager_coin: Coin<SUI>,      // Must match wager amount
  player2_choice: u8,         // 0=Rock, 1=Paper, 2=Scissors
  reveal_timeout_ms: u64,     // Reveal phase timeout
  clock: &Clock
)
```

### `reveal_and_settle()`
Player 1 reveals and settles the game

```move
reveal_and_settle(
  game: Game,
  player1_choice: u8,         // Original choice
  salt: vector<u8>            // Random salt
)
```

### `claim_timeout()`
Claim compensation if opponent times out

```move
claim_timeout(
  game: Game,
  clock: &Clock
)
```

---

## 🔒 Security Features

### Commit-Reveal Pattern
- Player 1 commits to choice without revealing
- Prevents Player 2 from knowing choice before playing
- Cryptographically verified with blake2b256

### Fair Wagers
- Both players must stake equal amounts
- Verified on-chain before game starts

### Timeout Protection
- Join phase timeout: Player 1 can cancel if P2 is inactive
- Reveal phase timeout: Player 2 wins if P1 doesn't reveal

### Object Lifecycle
- Games are deleted after settlement
- No orphaned objects left behind
- Proper resource cleanup

---

## 📊 State Diagram

```
         ┌──────────────┐
         │   Waiting    │
         │ (P2 needs    │
         │  to join)    │
         └──────┬───────┘
                │
         join_game()
                │
                ▼
         ┌──────────────┐
         │   Reveal     │
         │ (P1 needs    │
         │  to reveal)  │
         └──────┬───────┘
                │
    reveal_and_settle()
    or claim_timeout()
                │
                ▼
         ┌──────────────┐
         │  Finished    │
         │ (Game over)  │
         └──────────────┘
```

---

## 💡 Frontend Architecture

### Utilities (`utils/`)

**`secretManager.ts`** - Secret persistence
- IndexedDB storage with automatic expiry
- 30-day retention
- Fallback to localStorage
- `saveSecret()`, `getSecret()`, `deleteSecret()`

**`errorHandler.ts`** - Error handling
- Parse blockchain errors
- User-friendly messages in Vietnamese
- Input validation helpers
- `parseError()`, `validateAmount()`, `validateAddress()`

**`transactionHelper.ts`** - Transaction utilities
- Currency conversion (SUI ↔ mist)
- Retry logic with exponential backoff
- Transaction waiting
- Helper functions
- `toMist()`, `mistToSui()`, `waitForTransaction()`

### Components (`components/`)

**`CreateInviteModal`** - Create new game
**`GameDashboard`** - Play game interface
**`FriendManager`** - Manage friends list
**`InviteList`** - View pending invites
**`LoadingOverlay`** - Loading indicator
**`Navbar`** - Navigation bar

---

## ⚙️ Configuration

### Environment Variables

Create `frontend/.env.local`:

```env
# Smart contract package ID (required)
VITE_PACKAGE_ID=0x123abc...

# Optional: Customize timeouts
VITE_JOIN_TIMEOUT_MS=120000  # 2 minutes
VITE_REVEAL_TIMEOUT_MS=600000 # 10 minutes
```

### Network Configuration

Default: Sui Testnet

To use mainnet, update Sui client config or environment variables.

---

## 🧪 Testing

### Smart Contract Tests
```bash
sui move test
```

### Frontend Tests
```bash
cd frontend
pnpm test
```

### Manual Testing Checklist
- [ ] Create game as Player 1
- [ ] Join game as Player 2
- [ ] Reveal with correct choice → Player 1 wins
- [ ] Reveal with losing choice → Player 2 wins
- [ ] Reveal with same choice → Draw (split wager)
- [ ] Timeout while waiting for Player 2
- [ ] Timeout while waiting for reveal
- [ ] Test with low balance
- [ ] Test network disconnection

---

## 📈 Performance

| Metric | Value |
|--------|-------|
| Contract compilation | ~1s |
| Publish gas | ~500,000 mist |
| Create game gas | ~50,000 mist |
| Join game gas | ~50,000 mist |
| Reveal & settle gas | ~80,000 mist |
| Frontend bundle | <5MB |
| Secret storage | IndexedDB (5-10MB) |

---

## 🐛 Troubleshooting

### "Insufficient balance"
- Check wallet balance on `https://explorer.sui.io/`
- Request testnet SUI tokens from [faucet](https://discord.gg/sui)

### "Package ID not found"
- Verify VITE_PACKAGE_ID in `.env.local`
- Make sure contract is published to same network

### "Game not found"
- Refresh page to resync data
- Check transaction on Sui Explorer

### Secret lost
- Secrets are stored locally for 30 days
- Can re-enter salt during reveal phase
- Check browser IndexedDB in DevTools

---

## 📚 Resources

- [Sui Documentation](https://docs.sui.io/)
- [Move Language Guide](https://move-language.github.io/)
- [Sui Explorer](https://explorer.sui.io/)
- [Sui Discord](https://discord.gg/sui)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 🙏 Acknowledgments

- [Sui Foundation](https://sui.io/) for the amazing blockchain
- [Mysten Labs](https://mystenlabs.com/) for the Sui SDK
- Community feedback and testing

---

## 📞 Support

- 📧 Email: support@example.com
- 💬 Discord: [Join Server](https://discord.gg/example)
- 🐛 Issues: [GitHub Issues](https://github.com/example/issues)
- 💡 Discussions: [GitHub Discussions](https://github.com/example/discussions)

---

<div align="center">

**Made with ❤️ on Sui**

⭐ Star us on GitHub if you like it!

</div>
