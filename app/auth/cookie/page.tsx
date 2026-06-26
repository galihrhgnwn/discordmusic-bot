'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'
import {
  Loader2, CheckCircle, ShieldCheck, Youtube,
  AlertCircle, Copy, Check, ChevronDown, ChevronUp
} from 'lucide-react'

// Step-by-step instruksi dengan gambar deskripsi
const INSTRUCTIONS = [
  {
    step: '1',
    title: 'Buka YouTube Music di browser',
    desc: 'Buka music.youtube.com di Chrome atau Firefox dan pastikan sudah login dengan akun Google kamu.',
    code: null,
    url: 'https://music.youtube.com'
  },
  {
    step: '2',
    title: 'Buka DevTools → Network tab',
    desc: 'Tekan F12 (atau Ctrl+Shift+I di Windows, Cmd+Option+I di Mac) untuk buka Developer Tools. Klik tab "Network".',
    code: 'F12 → Network',
    url: null
  },
  {
    step: '3',
    title: 'Filter request "browse"',
    desc: 'Di kolom filter/search Network tab, ketik "browse". Kalau tidak ada request, klik halaman lain di YouTube Music (misal klik Library atau Home) sampai muncul.',
    code: null,
    url: null
  },
  {
    step: '4',
    title: 'Copy Cookie header',
    desc: 'Klik salah satu request "browse" → pilih tab "Headers" → scroll ke bagian "Request Headers" → cari baris "cookie:" → klik kanan → Copy value.',
    code: 'Request Headers → cookie: SID=...',
    url: null
  },
  {
    step: '5',
    title: 'Paste di bawah dan submit',
    desc: 'Paste semua teks cookie yang sudah dicopy ke kolom di bawah ini. Cookie yang valid biasanya panjang dan mengandung SID, SSID, SAPISID, dan lainnya.',
    code: null,
    url: null
  }
]

// Alternatif: pakai ekstensi browser
const EXTENSION_METHOD = {
  title: 'Cara Alternatif: Pakai Ekstensi Browser',
  steps: [
    'Install ekstensi "Get cookies.txt Locally" di Chrome/Firefox',
    'Buka music.youtube.com dan pastikan sudah login',
    'Klik ikon ekstensi → pilih domain music.youtube.com',
    'Klik "Export" → format "Netscape" → Copy semua teks',
    'Paste di kolom di bawah'
  ]
}

function CookieAuthPageContent() {
  const params = useSearchParams()
  const token = params.get('token')

  const [cookie, setCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showAlt, setShowAlt] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/submit-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cookie })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to authenticate')
      setSuccess(data.accountName || 'YouTube User')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Invalid token
  if (!token && !success) return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl max-w-md w-full text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Link Tidak Valid</h2>
        <p className="text-neutral-400 text-sm">
          Link ini tidak memiliki token yang valid.<br />
          Jalankan <code className="text-red-400 bg-red-400/10 px-1 py-0.5 rounded">!smusic auth login</code> di Discord untuk mendapatkan link baru.
        </p>
      </div>
    </div>
  )

  // Success
  if (success) return (
    <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl max-w-md w-full text-center">
        <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Berhasil Terhubung!</h2>
        <p className="text-neutral-400 text-sm mb-4">
          Akun <span className="text-white font-medium">{success}</span> berhasil dihubungkan ke bot.
        </p>
        <p className="text-neutral-500 text-xs">
          Kamu sekarang bisa menutup halaman ini dan kembali ke Discord.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Youtube className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Connect YouTube Music</h1>
          <p className="text-neutral-400 text-sm max-w-md mx-auto">
            Hubungkan akun YouTube Music kamu ke bot untuk mendapatkan
            rekomendasi yang dipersonalisasi dan akses ke playlist kamu.
          </p>
        </div>

        {/* Warning */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 text-sm font-medium mb-1">Penting</p>
            <p className="text-yellow-200/70 text-xs">
              Cookies harus diambil dari <strong>music.youtube.com</strong>, bukan youtube.com biasa.
              Cookies ini bersifat sensitif — jangan share ke siapapun selain bot ini.
            </p>
          </div>
        </div>

        {/* Step by step instructions */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-800">
            <h2 className="text-sm font-semibold text-white">
              📋 Cara Mendapatkan Cookie (DevTools)
            </h2>
          </div>
          <div className="divide-y divide-neutral-800">
            {INSTRUCTIONS.map((item) => (
              <div key={item.step} className="px-5 py-4 flex gap-4">
                <div className="w-7 h-7 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center flex-shrink-0 text-red-400 text-xs font-bold">
                  {item.step}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white mb-1">{item.title}</p>
                  <p className="text-xs text-neutral-400 leading-relaxed">{item.desc}</p>
                  {item.code && (
                    <code className="mt-2 inline-block text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded">
                      {item.code}
                    </code>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-red-400 hover:text-red-300 underline"
                    >
                      {item.url}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alternative method toggle */}
        <button
          type="button"
          onClick={() => setShowAlt(!showAlt)}
          className="w-full flex items-center justify-between px-5 py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
        >
          <span>🔌 {EXTENSION_METHOD.title}</span>
          {showAlt
            ? <ChevronUp className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />
          }
        </button>

        {showAlt && (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
            <ol className="space-y-2">
              {EXTENSION_METHOD.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-neutral-300">
                  <span className="text-red-400 font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Cookie input form */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-800">
            <h2 className="text-sm font-semibold text-white">
              🍪 Paste Cookie Di Sini
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex gap-3 text-sm text-red-300">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-2">
                Cookie string dari music.youtube.com
              </label>
              <textarea
                className="w-full h-36 bg-neutral-950 border border-neutral-700 focus:border-red-500 rounded-xl p-4 text-xs font-mono text-neutral-300 resize-none outline-none transition-colors placeholder-neutral-600"
                placeholder="Paste cookie di sini...&#10;&#10;Contoh:&#10;SID=xxx; SSID=xxx; APISID=xxx; SAPISID=xxx; __Secure-1PSID=xxx..."
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                required
              />
              <p className="mt-2 text-xs text-neutral-500">
                Cookie yang valid mengandung: <code className="text-neutral-400">SID</code>, <code className="text-neutral-400">SSID</code>, <code className="text-neutral-400">SAPISID</code>, <code className="text-neutral-400">__Secure-1PSID</code>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !cookie.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white hover:bg-neutral-100 text-neutral-900 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed font-semibold rounded-xl transition-colors text-sm"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</>
                : 'Connect Account'
              }
            </button>
          </form>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-3 px-4 py-3 bg-neutral-900/50 border border-neutral-800 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-neutral-500 leading-relaxed">
            Cookie disimpan secara lokal di server bot dan hanya digunakan untuk
            mengakses data YouTube Music kamu. Password kamu tidak pernah terekspos.
            Cookie biasanya valid selama 1–2 tahun atau sampai kamu logout dari browser.
          </p>
        </div>

      </div>
    </div>
  )
}

export default function CookieAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    }>
      <CookieAuthPageContent />
    </Suspense>
  )
}
