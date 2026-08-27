# Smusic Bot

Smusic Bot adalah bot Discord berbasis Node.js untuk memutar audio dari YouTube dan sumber media terkait. Project ini berjalan sebagai bot Discord saja; tidak ada dashboard web atau server frontend yang perlu dijalankan.

## Fitur

- Pemutaran lagu, playlist, dan URL media melalui slash command.
- Queue per server dengan dukungan skip, pause, resume, loop, autoplay, shuffle, dan pengaturan volume.
- Downloader berbasis backend PytubeDL dengan fallback ke `youtubei.js` dan `yt-search` untuk pencarian metadata.
- Penyimpanan cache audio lokal dengan batas ukuran yang dikendalikan oleh cache manager.
- Registrasi slash command otomatis secara global ketika bot berhasil login ke Discord.

## Persyaratan

- Node.js 20 atau lebih baru.
- FFmpeg tersedia di `PATH`, atau gunakan binary dari `ffmpeg-static`.
- Discord application dengan bot token yang valid.

## Instalasi

```bash
git clone https://github.com/galihrhgnwn/discordmusic-bot.git
cd discordmusic-bot
npm install
cp .env.example .env
```

Isi `DISCORD_TOKEN` pada `.env`. Jangan commit file `.env` atau kredensial apa pun ke repository.

## Menjalankan Bot

```bash
npm run bot
```

Script tersebut menjalankan `discordbot/index.js` dalam mode produksi. Bot tidak lagi menjalankan Next.js, Express, atau dashboard HTTP.

## Slash Commands

Slash command didaftarkan otomatis ke aplikasi Discord saat bot login. Karena registrasinya global, perubahan command dapat membutuhkan waktu propagasi sebelum terlihat di semua server.

| Command | Keterangan |
| --- | --- |
| `/play query:<judul atau URL>` | Memutar lagu atau playlist. |
| `/chart` | Menampilkan chart musik berdasarkan region dan genre. |
| `/playlist list` | Menampilkan playlist yang tersedia. |
| `/playlist play query:<nama>` | Memutar playlist. |
| `/playlist search query:<kata kunci>` | Mencari playlist. |
| `/auth login` | Mengirim link HTML untuk menghubungkan akun YouTube secara personal. |
| `/auth status` | Memeriksa status koneksi akun YouTube. |
| `/auth logout` | Memutuskan koneksi akun YouTube. |
| `/pause` | Menjeda pemutaran. |
| `/resume` | Melanjutkan pemutaran. |
| `/skip` | Melewati lagu aktif. |
| `/stop` | Menghentikan pemutaran dan mengosongkan queue. |
| `/queue view` | Melihat queue. |
| `/queue clear` | Mengosongkan queue. |
| `/queue remove index:<nomor>` | Menghapus item dari queue. |
| `/volume level:<1-100>` | Mengatur volume. |
| `/quality level:<low|medium|high|lossless>` | Mengatur kualitas audio. |
| `/loop` | Mengaktifkan atau menonaktifkan loop. |
| `/autoplay` | Mengaktifkan atau menonaktifkan autoplay. |
| `/shuffle` | Mengacak queue. |
| `/now` | Menampilkan lagu yang sedang diputar. |
| `/history` | Menampilkan riwayat pemutaran. |
| `/download` | Mengunduh lagu aktif. |
| `/recommend` | Menampilkan rekomendasi berdasarkan lagu aktif. |
| `/keepjoin` | Menjaga bot tetap berada di voice channel. |
| `/quitjoin` | Menonaktifkan mode persistent voice channel. |
| `/help` | Menampilkan daftar command. |

## Environment Variables

| Variable | Wajib | Keterangan |
| --- | --- | --- |
| `DISCORD_TOKEN` | Ya | Token bot dari Discord Developer Portal. |
| `AUTH_WEB_URL` | Tidak | URL publik halaman HTML auth. Default: `http://localhost:25557`. |
| `PYTUBE_API_URL` | Tidak | Endpoint downloader. Default: `http://dono-03.danbot.host:1386`. |
| `BOT_OWNER_ID` | Tidak | Discord user ID pemilik bot. |

## YouTube Authentication

Login YouTube bersifat opsional. Jalankan `/auth login` di Discord untuk menerima link HTML pribadi. Buka link tersebut, masukkan cookie Netscape dari browser, lalu kirim formulir untuk memvalidasi dan menyimpan sesi akun. Link auth berlaku selama 30 menit dan sebaiknya hanya dibuka melalui URL yang kamu kontrol.

Atur `AUTH_WEB_URL` ke alamat publik server bot jika link akan dibuka dari perangkat lain:

```env
AUTH_WEB_URL="https://bot.example.com"
```

## Backend Downloader

Downloader memakai endpoint audio resmi backend PytubeDL:

```text
GET /api/download/audio?url=<youtube-url>&format=m4a
```

Endpoint ini memilih dan mengunduh format audio langsung dari backend, sehingga bot tidak bergantung pada schema stream lama atau pemilihan `itag` secara lokal.

Endpoint default dapat diganti tanpa mengubah source code:

```env
PYTUBE_API_URL="http://dono-03.danbot.host:1386"
```

## Pengembangan

Jalankan lint sebelum membuat perubahan:

```bash
npm run lint
```

Pastikan working tree bersih dan tidak ada kredensial, cache runtime, atau file eksperimen yang ikut ter-commit.

## Lisensi

Project ini dikelola untuk penggunaan pribadi dan eksperimen. Pastikan penggunaan sumber media mematuhi ketentuan layanan dan hukum yang berlaku.

> Jangan bagikan `DISCORD_TOKEN`, cookie YouTube, atau kredensial backend melalui chat, issue, atau commit Git.

## Struktur Project

```text
discordbot/
├── commands/       Slash command handlers
├── core/           Player, queue, downloader, session, dan registrasi command
├── auth/           Utilitas auth lama yang tidak dipakai untuk startup bot
└── utils/          Cache, logger, permission, dan helper lainnya
```

Dashboard web telah dihapus dari project. Runtime utama sekarang hanya `discordbot/index.js`.

## Troubleshooting

Jika bot gagal login, periksa `DISCORD_TOKEN` dan pastikan bot sudah diundang ke server dengan scope `bot` dan `applications.commands`.

Jika audio gagal diputar, pastikan FFmpeg tersedia dan endpoint `PYTUBE_API_URL` dapat diakses dari server bot.

Jika slash command belum terlihat, tunggu propagasi registrasi global Discord atau hapus dan undang ulang bot dengan scope `applications.commands`.
