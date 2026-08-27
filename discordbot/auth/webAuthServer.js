import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Innertube } from 'youtubei.js'
import { consumePendingAuth, saveUserCookie } from '../core/userSessionManager.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const htmlPath = path.join(__dirname, 'cookie.html')

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1024 * 1024) {
        reject(new Error('Request body is too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

async function handleCookieSubmission(req, res) {
  try {
    const body = JSON.parse(await readBody(req))
    const token = typeof body.token === 'string' ? body.token : ''
    const cookie = typeof body.cookie === 'string' ? body.cookie.trim() : ''
    if (!token || !cookie) return sendJson(res, 400, { error: 'Token and cookie are required' })

    const authRequest = consumePendingAuth(token)
    if (!authRequest?.userId) return sendJson(res, 400, { error: 'This authentication link is invalid or expired' })
    const { userId, discordUsername, discordTag } = authRequest

    const yt = await Innertube.create({
      cookie,
      generate_session_locally: true,
      retrieve_player: true
    })

    let accountName = 'YouTube account'
    let accountEmail = ''
    try {
      const info = await yt.account.getInfo()
      const item = info?.contents?.[0] || info?.header?.accountName
      accountName = item?.account_name || item?.name || item?.channel_handle || accountName
      accountEmail = item?.email || item?.account_byline || ''
    } catch {
    }

    saveUserCookie(userId, cookie, {
      accountName,
      accountEmail,
      userId,
      discordUsername,
      discordTag,
      loginTime: new Date().toISOString()
    })
    return sendJson(res, 200, { success: true, accountName })
  } catch (error) {
    console.error('[Auth] Cookie submission failed:', error.message)
    return sendJson(res, 400, { error: 'Invalid cookie or malformed request' })
  }
}

export function startAuthWebServer(port = process.env.PORT || 25557) {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    if (req.method === 'GET' && requestUrl.pathname === '/auth/cookie') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(fs.readFileSync(htmlPath))
    }
    if (req.method === 'POST' && requestUrl.pathname === '/auth/cookie') {
      return handleCookieSubmission(req, res)
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not found')
  })

  server.listen(port, () => {
    console.log(`[Auth] HTML auth page listening on port ${port}`)
  })
  return server
}
