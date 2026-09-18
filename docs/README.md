# Manual Preflight

Panduan lengkap untuk memakai, menjalankan, dan mengembangkan Preflight.

Preflight mengubah ide jadi PRD, daftar fitur, dan task berurutan — di mana tiap task sudah berisi prompt siap tempel ke AI coding agent. Jalan di atas model AI gratis.

---

## Untuk pengguna

Baca ini kalau kamu mau memakai Preflight.

| | |
|---|---|
| **[1. Mulai](01-mulai.md)** | Dari ide ke task pertama dalam lima menit |
| **[2. Memakai Preflight](02-memakai.md)** | Semua fitur, satu per satu |
| **[3. API key sendiri](03-api-key.md)** | Kuota bersama, BYOK, dan batas-batasnya |
| **[4. Berbagi rencana](04-berbagi.md)** | Menerbitkan ke tautan publik |
| **[5. Sambungkan agent](05-agent.md)** | Claude Code / Cursor lewat MCP |

## Untuk pengembang

Baca ini kalau kamu mau menjalankan atau mengubah kodenya.

| | |
|---|---|
| **[6. Menjalankan lokal](06-menjalankan.md)** | Setup, database, perintah |
| **[7. Arsitektur](07-arsitektur.md)** | Bagaimana pipeline-nya bekerja |
| **[8. Deploy](08-deploy.md)** | Ke produksi |
| **[9. Kalau bermasalah](09-masalah.md)** | Gejala, sebab, solusi |
| **[10. Catatan keputusan](10-keputusan.md)** | Kenapa bentuknya begini, dengan angkanya |

---

## Ringkasan sepuluh detik

```bash
git clone https://github.com/znlumins/Preflight.git
cd Preflight && npm install
cp .env.example .env.local     # isi GOOGLE_GENERATIVE_AI_API_KEY + ENCRYPTION_KEY
npm run db:push
npm run dev
```

Buka http://localhost:3000, tulis idemu, jawab lima pertanyaan. Sekitar satu menit kemudian rencananya jadi.

## Angka yang perlu kamu tahu

| | |
|---|---|
| Biaya satu rencana | ~7 request AI, ~20.000 token |
| Waktu | 40–60 detik |
| Kuota bersama | ~71 rencana/hari untuk **semua** pengunjung |
| Batas per sesi | 3 rencana/hari, 20 revisi/hari |
| Dengan API key sendiri | tanpa batas dari sisi Preflight |

Semua angka ini hasil pengukuran, bukan perkiraan. Cara mengukurnya sendiri ada di [catatan keputusan](10-keputusan.md).
