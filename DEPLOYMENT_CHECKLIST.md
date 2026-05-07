# Deployment Checklist

## Pre-Deployment ✅

### Smart Contract
- [ ] All Move code compiles without errors
  ```bash
  sui move build
  ```
- [ ] No warnings in compilation output
- [ ] Tests pass
  ```bash
  sui move test
  ```
- [ ] Review gas estimations
- [ ] Verify error codes are unique

### Frontend
- [ ] All TypeScript compiles
  ```bash
  cd frontend && pnpm build
  ```
- [ ] No ESLint warnings
  ```bash
  pnpm lint
  ```
- [ ] Environment variables configured
  ```bash
  cp .env.example .env.local
  ```
- [ ] Package ID placeholder replaced
- [ ] No console errors in development

---

## Deployment Steps 🚀

### Step 1: Deploy Smart Contract

```bash
# 1. Navigate to project root
cd c:\Users\TRUONG KIEN VAN\Learn\Bao_Bua_Keo_proMax

# 2. Build contract
sui move build

# 3. Check Sui client config
sui client active-address
sui client active-env

# 4. Ensure you're on testnet (or desired network)
sui client switch --env testnet

# 5. Publish contract
sui client publish --gas-budget 100000000 sources/

# 6. ⭐ SAVE the Package ID output
# Copy this and use in next step
```

**Expected Output:**
```
Transaction Digest: 0x...
...
Published Objects:
  0x... (Package)
  0x... (Game object)
...
```

### Step 2: Configure Frontend

```bash
# 1. Navigate to frontend
cd frontend

# 2. Create local env file
cp .env.example .env.local

# 3. Edit .env.local with your Package ID
# VITE_PACKAGE_ID=0x<your_package_id_from_step_1>

# 4. Save file
```

### Step 3: Build Frontend

```bash
# 1. Install dependencies (if not done)
pnpm install

# 2. Build for production
pnpm build

# 3. Check build output
# dist/ folder should contain optimized files
```

### Step 4: Test Deployment

```bash
# 1. Run dev server to test
pnpm dev

# 2. Open http://localhost:5173

# 3. Connect wallet to Testnet

# 4. Verify Package ID is correct
# Check browser console for any errors

# 5. Create a test game
# - Set small wager (0.1 SUI)
# - Verify transaction goes through
# - Check Sui Explorer for transaction
```

---

## Post-Deployment ✅

### Verification Checklist
- [ ] Smart contract deployed (verify on [Sui Explorer](https://explorer.sui.io/))
- [ ] Frontend accessible and loading
- [ ] Wallet connection working
- [ ] Can create new game
- [ ] Can join game
- [ ] Can reveal and settle
- [ ] All transactions appear on Sui Explorer
- [ ] Timeouts working correctly
- [ ] Error messages display properly

### Monitoring
- [ ] Set up monitoring for smart contract events
- [ ] Monitor frontend error logs
- [ ] Check wallet gas usage
- [ ] Monitor user transactions

---

## Troubleshooting 🔧

### Smart Contract Won't Publish
```bash
# Check error message, common issues:
# 1. Insufficient gas budget - increase to 200000000
# 2. Not on testnet - switch network first
# 3. Syntax errors - run 'sui move build' to debug

# Retry with more gas
sui client publish --gas-budget 200000000 sources/
```

### Frontend Can't Connect
```bash
# 1. Check Package ID in .env.local is correct
# 2. Verify network matches (testnet/mainnet)
# 3. Check browser console for errors (F12)
# 4. Verify wallet is on same network
```

### Game Creation Fails
```bash
# 1. Check wallet balance - need at least 1 SUI
# 2. Verify Package ID is correct
# 3. Check if contract published successfully
# 4. Look at transaction on Sui Explorer
```

### Build Fails
```bash
# Clear and rebuild
rm -rf node_modules dist
pnpm install
pnpm build
```

---

## Production Deployment 🌐

### For Mainnet Deployment

1. **Switch to Mainnet**
   ```bash
   sui client switch --env mainnet
   ```

2. **Publish Contract**
   ```bash
   sui client publish --gas-budget 200000000 sources/
   ```

3. **Update Frontend**
   - Update VITE_PACKAGE_ID in .env.local
   - Add production build optimizations
   - Update RPC endpoint if needed

4. **Deploy Frontend**
   - Build: `pnpm build`
   - Deploy dist/ folder to hosting (Vercel, Netlify, etc.)

---

## Rollback Plan 🔄

If issues arise:

1. **Smart Contract**
   - Publish new version with fixes
   - Update Package ID in frontend

2. **Frontend**
   - Deploy previous version
   - Clear cache if needed
   - Point to stable Package ID

---

## Performance Optimization 📊

After deployment:

1. **Optimize gas usage**
   - Monitor transaction costs
   - Optimize Move code if needed

2. **Optimize frontend**
   - Minify assets
   - Use CDN for distribution
   - Enable caching

3. **Monitor metrics**
   - Transaction success rate
   - Average gas consumption
   - Frontend load time

---

## Security Checklist 🔒

- [ ] No private keys in code
- [ ] Environment variables properly set
- [ ] Contract code reviewed for vulnerabilities
- [ ] Frontend sanitizes all inputs
- [ ] Error messages don't leak sensitive info
- [ ] CORS configured properly
- [ ] Rate limiting considered

---

## Documentation Updates 📝

- [ ] README.md updated
- [ ] Deployment instructions documented
- [ ] FAQ created
- [ ] Troubleshooting guide ready
- [ ] API documentation current
- [ ] Example .env files provided

---

## Sign-Off ✨

- [ ] All tests passing
- [ ] Code review completed
- [ ] Performance acceptable
- [ ] Security audit done
- [ ] Documentation complete
- [ ] Ready for production

---

**Deployment Date:** _________________

**Deployed By:** _________________

**Package ID:** _________________

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________
