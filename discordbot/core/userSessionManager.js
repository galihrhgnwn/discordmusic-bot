import { Innertube, UniversalCache, Platform } from 'youtubei.js'
import vm from 'vm'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// Set eval (aman dipanggil berkali-kali)
Platform.shim.eval = async (data, env) => {
  const properties = []
  if (env.n) properties.push(`n: exportedVars.nFunction("${env.n}")`)
  if (env.sig) properties.push(`sig: exportedVars.sigFunction("${env.sig}")`)
  const code = `${data.output}\nreturn { ${properties.join(', ')} }`
  try {
    return vm.runInNewContext(`(function() { ${code} })()`)
  } catch {
    return new Function(code)()
  }
}

const USERS_DIR = path.resolve('./auth/users')

const sessionMap = new Map()  // discordUserId → Innertube instance

function getUserDir(userId) {
  return path.join(USERS_DIR, userId)
}

function getCredsFile(userId) {
  return path.join(getUserDir(userId), 'credentials.json')
}

function getCookieFile(userId) {
  return path.join(getUserDir(userId), 'cookie.json')
}

function getProfileFile(userId) {
  return path.join(getUserDir(userId), 'profile.json')
}

export function hasCredentials(userId) {
  return fs.existsSync(getCredsFile(userId)) || fs.existsSync(getCookieFile(userId))
}

export function getUserProfile(userId) {
  const f = getProfileFile(userId)
  if (!fs.existsSync(f)) return null
  try {
    return JSON.parse(fs.readFileSync(f, 'utf-8'))
  } catch {
    return null
  }
}

export async function getUserSession(userId) {
  // Cek cache session
  if (sessionMap.has(userId)) {
    return sessionMap.get(userId)
  }

  // Load cookies jika ada
  if (fs.existsSync(getCookieFile(userId))) {
    try {
      const { cookie } = JSON.parse(fs.readFileSync(getCookieFile(userId), 'utf-8'))
      const yt = await Innertube.create({
        cookie,
        generate_session_locally: true,
        retrieve_player: true
      })
      sessionMap.set(userId, yt)
      return yt
    } catch(e) {
      console.error(`Failed to load cookie auth for ${userId}:`, e)
    }
  }

  // Load dari OAuth file jika ada
  if (fs.existsSync(getCredsFile(userId))) {
    const yt = await Innertube.create({
      cache: new UniversalCache(true, `./auth/users/${userId}/.ytcache`),
      generate_session_locally: true,
      retrieve_player: true
    })
    const creds = JSON.parse(fs.readFileSync(getCredsFile(userId), 'utf-8'))
    await yt.session.signIn(creds)
    sessionMap.set(userId, yt)
    return yt
  }

  return null
}

export function isUserLoggedIn(userId) {
  return hasCredentials(userId)
}

export function saveUserCredentials(userId, credentials, profile) {
  const dir = getUserDir(userId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  fs.writeFileSync(getCredsFile(userId), JSON.stringify(credentials, null, 2))
  fs.writeFileSync(getProfileFile(userId), JSON.stringify(profile, null, 2))

  // Update session cache
  sessionMap.delete(userId)  // force reload next time
}

export function saveUserCookie(userId, cookieString, profile) {
  const dir = getUserDir(userId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  fs.writeFileSync(getCookieFile(userId), JSON.stringify({ cookie: cookieString }, null, 2))
  fs.writeFileSync(getProfileFile(userId), JSON.stringify(profile, null, 2))
  
  // Update session cache
  sessionMap.delete(userId)
}

export function removeUserCredentials(userId) {
  const dir = getUserDir(userId)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  sessionMap.delete(userId)
}

export function getAllLoggedInUsers() {
  if (!fs.existsSync(USERS_DIR)) return []
  return fs.readdirSync(USERS_DIR)
    .filter(id => hasCredentials(id))
}

// ─── PENDING AUTH (For Cookie Login) ──────────────────────────

const PENDING_DIR = path.resolve('./auth/pending')

function ensurePendingDir() {
  if (!fs.existsSync(PENDING_DIR)) {
    fs.mkdirSync(PENDING_DIR, { recursive: true })
  }
}

export function createPendingAuth(userId) {
  ensurePendingDir()
  const token = crypto.randomUUID()
  const filePath = path.join(PENDING_DIR, `${token}.json`)
  fs.writeFileSync(filePath, JSON.stringify({
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000  // 30 menit
  }))
  return token
}

export function getPendingAuth(token) {
  ensurePendingDir()
  if (!/^[a-f0-9-]+$/i.test(token)) return null

  const filePath = path.join(PENDING_DIR, `${token}.json`)
  if (!fs.existsSync(filePath)) return null

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (Date.now() > data.expiresAt) {
      fs.unlinkSync(filePath)
      return null
    }
    return data.userId
  } catch {
    return null
  }
}

export function consumePendingAuth(token) {
  const userId = getPendingAuth(token)
  if (userId) {
    const filePath = path.join(PENDING_DIR, `${token}.json`)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  }
  return userId
}

// Cleanup expired tokens — panggil saat bot start
export async function cleanupExpiredTokens() {
  ensurePendingDir()
  try {
    const files = await fs.promises.readdir(PENDING_DIR)
    let cleaned = 0

    // Process in batches
    const BATCH_SIZE = 50
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async (file) => {
        const filePath = path.join(PENDING_DIR, file)
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8')
          const data = JSON.parse(content)
          if (Date.now() > data.expiresAt) {
            await fs.promises.unlink(filePath)
            cleaned++
          }
        } catch (e) {
          if (e.code !== 'ENOENT') {
            try {
              // File corrupt or parsing failed → hapus
              await fs.promises.unlink(filePath)
              cleaned++
            } catch (err) {}
          }
        }
      }))
    }

    if (cleaned > 0) {
      console.log(`[PendingAuth] Cleaned ${cleaned} expired tokens`)
    }
  } catch (e) {
    console.warn('[PendingAuth] Cleanup failed:', e.message)
  }
}

// Preload semua user sessions saat bot start
export async function preloadAllSessions() {
  const users = getAllLoggedInUsers()
  console.log(`[UserSession] Preloading ${users.length} user sessions...`)
  for (const userId of users) {
    try {
      await getUserSession(userId)
      console.log(`[UserSession] ✅ Loaded session for user ${userId}`)
    } catch (e) {
      console.warn(`[UserSession] Failed to load session for ${userId}:`, e.message)
    }
  }
}

