import { Innertube, UniversalCache, Platform } from 'youtubei.js'
import vm from 'vm'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

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

const sessionMap = new Map()

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
  if (sessionMap.has(userId)) {
    return sessionMap.get(userId)
  }

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

  sessionMap.delete(userId)
}

export function saveUserCookie(userId, cookieString, profile) {
  const dir = getUserDir(userId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  fs.writeFileSync(getCookieFile(userId), JSON.stringify({ cookie: cookieString }, null, 2))
  fs.writeFileSync(getProfileFile(userId), JSON.stringify(profile, null, 2))

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


const PENDING_DIR = path.resolve('./auth/pending')

function ensurePendingDir() {
  if (!fs.existsSync(PENDING_DIR)) {
    fs.mkdirSync(PENDING_DIR, { recursive: true })
  }
}

export function createPendingAuth(userId, discordUser = {}) {
  ensurePendingDir()
  const token = crypto.randomUUID()
  const filePath = path.join(PENDING_DIR, `${token}.json`)
  fs.writeFileSync(filePath, JSON.stringify({
    userId,
    discordUsername: discordUser.username || '',
    discordTag: discordUser.tag || '',
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000
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
  const filePath = path.join(PENDING_DIR, `${token}.json`)
  if (!fs.existsSync(filePath)) return null

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (Date.now() > data.expiresAt) {
      fs.unlinkSync(filePath)
      return null
    }
    fs.unlinkSync(filePath)
    return {
      userId: data.userId,
      discordUsername: data.discordUsername || '',
      discordTag: data.discordTag || ''
    }
  } catch {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    return null
  }
}

export function cleanupExpiredTokens() {
  ensurePendingDir()
  try {
    const files = fs.readdirSync(PENDING_DIR)
    let cleaned = 0
    for (const file of files) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(PENDING_DIR, file), 'utf-8')
        )
        if (Date.now() > data.expiresAt) {
          fs.unlinkSync(path.join(PENDING_DIR, file))
          cleaned++
        }
      } catch {
        fs.unlinkSync(path.join(PENDING_DIR, file))
      }
    }
    if (cleaned > 0) {
      console.log(`[PendingAuth] Cleaned ${cleaned} expired tokens`)
    }
  } catch (e) {
    console.warn('[PendingAuth] Cleanup failed:', e.message)
  }
}

export async function preloadAllSessions() {
  const users = getAllLoggedInUsers()
  console.log(`[UserSession] Preloading ${users.length} user sessions...`)
  for (const userId of users) {
    try {
      await getUserSession(userId)
      console.log(`[UserSession]  Loaded session for user ${userId}`)
    } catch (e) {
      console.warn(`[UserSession] Failed to load session for ${userId}:`, e.message)
    }
  }
}
