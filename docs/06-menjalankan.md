[← Daftar isi](README.md)

# 6. Menjalankan lokal

---

## Prasyarat

| | |
|---|---|
| Node | 22 atau lebih baru |
| PostgreSQL | 14+ — Laragon, Postgres.app, Docker, apa saja |
| API key | Gratis dari [Google AI Studio](https://aistudio.google.com/apikey) |

---

## Pasang

```bash
git clone https://github.com/znlumins/Preflight.git
cd Preflight
npm install
cp .env.example .env.local
```

### Isi `.env.local`

```bash
# Ambil gratis, tanpa kartu kredit: https://aistudio.google.com/apikey
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Opsional. Didukung, tapi throughput gratisnya rendah untuk beban ini.
GROQ_API_KEY=

DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/preflight

# Kunci enkripsi untuk API key milik user. Wajib.
ENCRYPTION_KEY=

# Dipakai untuk sitemap, canonical link, tautan berbagi, dan URL MCP.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Buat `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Siapkan database

```bash
createdb preflight
npm run db:push
```

Kalau pakai Laragon: jalankan PostgreSQL dari panelnya, lalu

```bash
"C:/laragon/bin/postgresql/postgresql-14.5-1/bin/psql.exe" -h 127.0.0.1 -U postgres -c "CREATE DATABASE preflight;"
```

Password default Laragon untuk `postgres` adalah `postgres`.

### Jalankan

```bash
npm run dev
```

http://localhost:3000

---

## Perintah

### Sehari-hari

```bash
npm run dev          # jalankan aplikasi
npm run build        # build produksi
npm run start        # jalankan hasil build
npm run typecheck    # tsc --noEmit
npm run lint
```

### Database

```bash
npm run db:push      # terapkan perubahan skema
npm run db:studio    # Drizzle Studio, lihat isinya
```

`db:push` akan bertanya kalau ada perubahan yang berisiko, dan **gagal di shell tanpa TTY**. Kalau itu terjadi, terapkan DDL-nya langsung lewat `psql`.

### Lokal atau produksi

Semua perintah di atas memakai database lokal. Untuk menyentuh database produksi, taruh connection string-nya di `.env.local` sebagai `DATABASE_URL_PROD`, lalu pakai varian `:prod`:

```bash
npm run dev:prod         # aplikasi lokal, data produksi
npm run db:push:prod     # terapkan skema ke produksi
npm run db:studio:prod   # lihat isi database produksi
```

Saklarnya variabel `DB_TARGET` (`local` atau `prod`), dan defaultnya `local`. Jadi produksi hanya tersentuh kalau kamu memintanya, dan terminal akan memasang peringatan merah selama itu. Nilai selain `local`/`prod` membuat aplikasi berhenti, bukan diam-diam memilih salah satunya.

`db:push:prod` otomatis memakai port session Supabase (5432) walau `DATABASE_URL_PROD` menunjuk port transaction (6543), karena drizzle-kit butuh prepared statement.

### Mengukur biaya pipeline

```bash
npm run spike                        # jalankan pipeline penuh, laporkan biayanya
npm run spike -- --no-interview      # jawaban tetap, untuk A/B prompt
npm run spike -- --single-tier       # konfigurasi kuota bersama
npm run spike -- --provider groq
```

Hasilnya ditulis ke `out/`: satu file Markdown berisi rencananya, satu JSON berisi metrik per panggilan.

Keluarannya juga memuat pemeriksaan struktur — jumlah task per subfitur, panjang prompt, konsistensi bahasa. **Selalu jalankan ini setelah mengubah prompt apa pun.**

### Memeriksa batas provider

```bash
npx tsx scripts/list-models.ts    # model yang benar-benar bisa dipanggil key kamu
npx tsx scripts/probe-limits.ts   # rate limit asli dari header respons
```

Batas provider bergerak tanpa pengumuman. Jangan percaya angka di dokumen ini — ukur ulang.

### Pengujian

Semua suite dijalankan terhadap server yang **sedang hidup**, lewat HTTP asli dengan cookie asli. Jalankan `npm run dev` di terminal lain dulu.

```bash
npx tsx scripts/e2e.ts          # alur utama: ide → PRD → fitur → spec → task
npx tsx scripts/e2e-byok.ts     # API key milik user
npx tsx scripts/e2e-revise.ts   # revisi, undo, rate limit
npx tsx scripts/e2e-public.ts   # berbagi publik dan SEO
npx tsx scripts/e2e-mcp.ts      # MCP, pakai klien SDK sungguhan
```

Suite ini memakai kuota AI sungguhan — tiap run membuat rencana baru.

### Screenshot untuk review desain

```bash
npx tsx scripts/shots.ts
```

Menulis ke `shots/`. Butuh `npx playwright install chromium` sekali di awal.

---

## Struktur folder

```
app/
  api/plan/…            pipeline per tahap
  api/key               API key milik user
  api/agent-token       token MCP
  api/mcp/[transport]   server MCP
  plans/[id]            tampilan pemilik
  p/[slug]              tampilan publik
  rencana               indeks publik
  pengaturan

components/
  IdeaFlow              ide + kuesioner
  PlanDocument          dokumen interaktif
  PlanParts             bagian yang hanya merender — dipakai dua tampilan
  PromptBlock           blok gelap yang bisa disalin
  ReviseChat            revisi + undo
  SharePlan             terbitkan / turunkan
  KeySettings           BYOK
  AgentSetup            token MCP

lib/
  ai/                   pipeline: schemas, prompts, provider, validate, meter
  db/                   skema Drizzle + klien
  plans.ts              persistensi
  revise.ts             menerapkan diff + undo
  publish.ts            berbagi publik
  keys.ts, crypto.ts    BYOK
  limits.ts             rate limit kuota bersama
  agent-token.ts        token MCP
  agent-tools.ts        tiga tool MCP

scripts/                spike, e2e, utilitas
docs/                   manual ini
```

---

## Berikutnya

- [7. Arsitektur](07-arsitektur.md) — bagaimana pipeline-nya bekerja
- [9. Kalau bermasalah](09-masalah.md)
