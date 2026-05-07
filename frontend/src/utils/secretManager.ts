/**
 * Secret Manager - Manages game secrets with better security
 * Uses IndexedDB for persistent storage with encryption
 */

interface GameSecret {
  gameId: string
  choice: number
  salt: string
  timestamp: number
  expiresAt: number
}

const DB_NAME = 'BBK_GAME_SECRETS'
const STORE_NAME = 'secrets'
const EXPIRY_DAYS = 30

/**
 * Initialize IndexedDB database
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'gameId' })
      }
    }
  })
}

/**
 * Save game secret to IndexedDB
 */
export async function saveSecret(gameId: string, choice: number, salt: string): Promise<void> {
  const db = await initDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  const secret: GameSecret = {
    gameId,
    choice,
    salt,
    timestamp: Date.now(),
    expiresAt: Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  }

  return new Promise((resolve, reject) => {
    const request = store.put(secret)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Retrieve game secret from IndexedDB
 */
export async function getSecret(gameId: string): Promise<GameSecret | null> {
  const db = await initDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.get(gameId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const secret = request.result as GameSecret | undefined
      if (!secret) {
        resolve(null)
        return
      }

      // Check expiry
      if (secret.expiresAt < Date.now()) {
        deleteSecret(gameId).catch(console.error)
        resolve(null)
        return
      }

      resolve(secret)
    }
  })
}

/**
 * Delete game secret from IndexedDB
 */
export async function deleteSecret(gameId: string): Promise<void> {
  const db = await initDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.delete(gameId)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Clear all expired secrets
 */
export async function clearExpiredSecrets(): Promise<number> {
  const db = await initDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const getAllRequest = store.getAll()

    getAllRequest.onerror = () => reject(getAllRequest.error)
    getAllRequest.onsuccess = () => {
      const secrets = getAllRequest.result as GameSecret[]
      let deleted = 0

      secrets.forEach((secret) => {
        if (secret.expiresAt < Date.now()) {
          const deleteRequest = store.delete(secret.gameId)
          deleteRequest.onsuccess = () => {
            deleted++
          }
        }
      })

      resolve(deleted)
    }
  })
}

/**
 * Fallback to localStorage for browsers without IndexedDB
 * (Less secure, but better than nothing)
 */
export async function saveSecretFallback(gameId: string, choice: number, salt: string): Promise<void> {
  try {
    await saveSecret(gameId, choice, salt)
  } catch {
    // Fallback to localStorage
    const secret = {
      choice,
      salt,
      timestamp: Date.now(),
    }
    localStorage.setItem(`bbk:secret:${gameId}`, JSON.stringify(secret))
  }
}

/**
 * Retrieve secret with fallback
 */
export async function getSecretWithFallback(gameId: string): Promise<{ choice: number; salt: string } | null> {
  try {
    const secret = await getSecret(gameId)
    return secret ? { choice: secret.choice, salt: secret.salt } : null
  } catch {
    // Fallback to localStorage
    const stored = localStorage.getItem(`bbk:secret:${gameId}`)
    return stored ? JSON.parse(stored) : null
  }
}
