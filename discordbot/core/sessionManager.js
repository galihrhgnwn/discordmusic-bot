import { Innertube, UniversalCache, Platform } from 'youtubei.js'
import vm from 'vm'
import fs from 'fs'
import path from 'path'

// WAJIB: set eval SEBELUM Innertube.create() dipanggil
// Ini yang bikin decipher bisa jalan di Node.js
Platform.shim.eval = async (data, env) => {
  const properties = []
  if (env.n) {
    properties.push(`n: exportedVars.nFunction("${env.n}")`)
  }
  if (env.sig) {
    properties.push(`sig: exportedVars.sigFunction("${env.sig}")`)
  }
  const code = `${data.output}\nreturn { ${properties.join(', ')} }`
  // Pakai vm.runInNewContext dengan context kosong (Object.create(null)) untuk keamanan
  return vm.runInNewContext(`(function() { ${code} })()`, Object.create(null))
}

let _session = null
const CREDS_FILE = path.resolve('./auth/yt_credentials.json')

export async function initSession() {
  _session = await Innertube.create({
    cache: new UniversalCache(true, './.ytcache'),
    generate_session_locally: true,
    retrieve_player: true
  })
  return _session
}

export function getSession() {
  if (!_session) throw new Error('Session not initialized')
  return _session
}

export function isLoggedIn() {
  const fileExists = fs.existsSync(CREDS_FILE)
  if (!fileExists) return false
  
  try {
    return _session?.session?.logged_in === true || fileExists
  } catch {
    return fileExists
  }
}

export async function loadSavedCredentials() {
  if (!fs.existsSync(CREDS_FILE)) return false
  try {
    const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'))
    await _session.session.signIn(creds)
    console.log('[Session] ✅ Credentials loaded')
    return true
  } catch (e) {
    console.warn('[Session] Failed to load credentials:', e.message)
    return false
  }
}

let _lastCredsMtime = null

export function watchCredentials() {
  const dir = path.dirname(CREDS_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  console.log('[Session] Polling for credential changes every 5s...')

  setInterval(async () => {
    try {
      if (!fs.existsSync(CREDS_FILE)) return

      const stat = fs.statSync(CREDS_FILE)
      const mtime = stat.mtimeMs

      if (_lastCredsMtime === mtime) return
      _lastCredsMtime = mtime

      const creds = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'))

      if (_session?.session?.logged_in) return

      await _session.session.signIn(creds)
      console.log('[Session] ✅ Credentials reloaded from file change')

    } catch (e) {
      console.warn('[Session] Polling reload failed:', e.message)
    }
  }, 5000)
}
