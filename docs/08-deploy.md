[← Daftar isi](README.md)

# 8. Deploy

Tidak ada kode yang berubah antara lokal dan produksi. Yang berubah cuma variabel environment.

---

## Database

Ganti `DATABASE_URL` ke Postgres yang di-host, lalu:

```bash
npm run db:push
```

Pilihan bertier gratis: **Neon**, **Supabase**, **Railway**. Drizzle dan driver `postgres` sama persis untuk ketiganya.

Satu catatan untuk platform serverless: pakai **connection pooler**-nya (di Neon namanya pooled connection string). Tanpa itu, tiap function instance membuka koneksi sendiri dan Postgres akan menolak saat trafik naik.

---

## Variabel environment

| Variabel | Wajib | Catatan |
|---|---|---|
| `DATABASE_URL` | ya | Pakai connection string yang pooled |
| `ENCRYPTION_KEY` | ya | **Buat yang baru untuk produksi** |
| `NEXT_PUBLIC_SITE_URL` | ya | Domain sungguhan, tanpa garis miring di akhir |
| `GOOGLE_GENERATIVE_AI_API_KEY` | untuk kuota bersama | Tanpa ini, semua pengunjung wajib BYOK |
| `GROQ_API_KEY` | tidak | Opsional |

### `ENCRYPTION_KEY`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Jangan pakai nilai yang sama dengan development.** Dan setelah ada pengguna, jangan diganti: semua API key tersimpan jadi tidak terbaca. Ini ditangani — Preflight jatuh balik ke kuota bersama, tidak crash — tapi pengguna harus memasang ulang key-nya.

### `NEXT_PUBLIC_SITE_URL`

Ini menentukan `sitemap.xml`, canonical link, tautan berbagi, dan URL MCP. Kalau salah, dua fitur langsung rusak:

- Rencana publik tidak bisa diindeks dengan benar
- Agent tidak bisa menjangkau server MCP-nya

Nilai produksi harus domain nyata: `https://preflight.example.com`.

---

## Vercel

1. Import repo-nya
2. Isi kelima variabel di atas
3. Deploy

Next.js terdeteksi otomatis. Tidak ada `vercel.json` yang perlu ditulis.

Batas durasi function penting di sini. Tahap pipeline sudah menyatakan kebutuhannya:

| Route | `maxDuration` |
|---|---|
| `/api/plan/questions`, `/create`, `/features`, `/specs`, `/revise` | 60 detik |
| `/api/plan/[id]/tasks` | 120 detik |

Tier Hobby Vercel membatasi 60 detik. Tahap `tasks` **bisa timeout di sana** untuk rencana besar. Kalau itu terjadi, statusnya tersimpan dan pengguna bisa mencoba ulang tahap itu saja — tapi kalau serius, tier berbayar atau platform tanpa batas durasi lebih tepat.

---

## Platform lain

Aplikasi Next.js biasa, tanpa kebutuhan khusus selain Node 22.

```bash
npm ci
npm run build
npm run start
```

Jalan di Railway, Render, Fly.io, atau VPS mana pun. Yang tidak akan jalan: static export — aplikasinya butuh server untuk sesi, database, dan MCP.

---

## Setelah deploy

Periksa lima hal:

```bash
curl -s https://domainmu.com/robots.txt
curl -s https://domainmu.com/sitemap.xml | head -20
```

1. `robots.txt` melarang `/plans/`, `/pengaturan`, `/api/`
2. `sitemap.xml` menunjuk domain yang benar, bukan localhost
3. Buat satu rencana sampai selesai — memastikan kuota bersama terpasang
4. Terbitkan satu rencana, buka tautannya di jendela penyamaran
5. Buat token MCP, sambungkan dari editor

Kalau nomor 5 gagal dengan "server tidak ditemukan", hampir pasti `NEXT_PUBLIC_SITE_URL` masih localhost.

---

## Yang belum ada

Ini bukan daftar keinginan, tapi hal yang perlu kamu tahu sebelum menaruhnya di depan banyak orang:

- **Tidak ada rate limit per IP.** Yang ada per sesi, dan sesi itu cookie — mudah direset. Kalau trafiknya nyata, pasang rate limit di tingkat edge.
- **Tidak ada pembersihan data lama.** Rencana tersimpan selamanya. Cookie kedaluwarsa setahun, jadi barisnya jadi yatim tanpa pernah terhapus.
- **Tidak ada backup otomatis.** Ikuti mekanisme penyedia Postgres-mu.

---

## Berikutnya

- [9. Kalau bermasalah](09-masalah.md)
