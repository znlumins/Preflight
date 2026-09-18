[← Daftar isi](README.md)

# 9. Kalau bermasalah

Gejala, sebabnya, dan cara membereskannya.

---

## Saat memakai

### "Kuota AI gratis bersama untuk hari ini sudah habis"

Semua pengunjung berbagi satu key, dan hari itu sudah terpakai.

Pasang API key sendiri di `/pengaturan` — gratis, tanpa kartu kredit, dan batasnya jadi milikmu. Lihat [3. API key sendiri](03-api-key.md).

### "Kamu sudah membuat 3 rencana hari ini dengan kuota bersama"

Batas per sesi, dihitung 24 jam bergulir. Sama solusinya: pasang key sendiri.

### "Model AI sedang penuh"

Tier gratis mengembalikan 503 cukup sering — empat dari tujuh run saat diukur. Preflight sudah otomatis pindah ke model cadangan, tapi kadang semuanya sedang penuh.

Tunggu semenit, klik **Coba lagi**. Tahap yang sudah selesai tidak diulang.

### "API key ditolak provider"

Key-nya salah ketik, terpotong saat menyalin, atau sudah dihapus di sisi Google. Buat baru di [AI Studio](https://aistudio.google.com/apikey) dan pasang ulang.

### Generasi berhenti di tengah

Statusnya tersimpan. Refresh halamannya — dia melanjutkan dari tahap terakhir yang berhasil. Kalau ada pesan error, ada tombol **Coba lagi** yang mengulang tahap itu saja.

### Rencana lama hilang

Rencana terikat ke cookie `preflight_sid`. Kalau kamu menghapus cookie, ganti browser, atau memakai jendela penyamaran, rencananya tidak bisa ditemukan.

Tidak ada cara memulihkan — tidak ada akun yang bisa dijadikan pegangan. Untuk rencana yang penting, **unduh Markdown-nya** atau terbitkan ke tautan publik.

### Revisi tidak mengubah apa-apa

Kuitansinya akan bilang "Tidak ada yang diubah" atau menyebut berapa operasi yang dilewati. Yang dilewati biasanya karena model menyebut id yang tidak ada — itu sengaja dilewati, bukan ditebak ke yang paling mirip.

Coba lebih spesifik: sebut nama fitur atau judul task-nya persis seperti yang tertulis.

### Tombol "Batalkan" tidak muncul

Hanya revisi **terbaru** yang bisa dibatalkan, dan hanya kalau revisi itu benar-benar mengubah sesuatu. Membatalkan yang lebih lama akan membuang semua yang dikerjakan sesudahnya.

---

## Saat menyambungkan agent

### Agent bilang server MCP tidak ditemukan

Hampir selalu `NEXT_PUBLIC_SITE_URL`. Kalau nilainya `http://localhost:3000`, konfigurasi yang dihasilkan menunjuk ke localhost — dan agent di mesin lain tidak bisa menjangkaunya.

Cek URL di konfigurasimu. Harus domain yang benar-benar bisa dibuka.

### Unauthorized / ditolak

- Token salah ketik saat ditempel
- Token sudah dicabut
- Kamu membuat token baru — yang lama otomatis berhenti berlaku

Buat token baru di `/pengaturan` dan tempel ulang.

### Tool-nya tidak muncul di editor

Restart editornya. Config MCP dibaca saat startup.

### "Tidak ada rencana yang siap dikerjakan"

Tool MCP hanya melihat rencana berstatus `done`. Kalau generasinya belum selesai atau berhenti karena error, tidak ada yang bisa diberikan.

Buka rencananya di web, pastikan selesai.

### Agent mengerjakan rencana yang salah

Kalau tidak disebutkan, yang dipakai adalah rencana yang **paling baru diubah**. Minta agent memanggil `preflight_plan_status` untuk melihat daftar dan id-nya, lalu sebutkan id yang kamu mau.

---

## Saat mengembangkan

### `db:push` gagal dengan "Interactive prompts require a TTY"

Drizzle ingin konfirmasi untuk perubahan berisiko, dan tidak bisa bertanya di shell non-interaktif.

Terapkan DDL-nya langsung:

```bash
psql "$DATABASE_URL" -c "ALTER TABLE ... ;"
```

### Turbopack panic soal glob pattern

```
Parsing glob pattern: **/*.{aspx,...,jsx,length},liquid,...
unopened alternate group; missing '{'
```

Ada **file dengan nama aneh di root proyek** — Tailwind memindainya dan membaca "ekstensi"-nya sebagai bagian dari daftar.

Ini pernah terjadi karena file bernama `${afterUndo.tasks.length}`, sisa perintah shell yang rusak. Cek `ls -a` di root, hapus yang tidak seharusnya ada.

### Hydration mismatch

Biasanya nilai yang berbeda antara server dan klien. Penyebab paling umum: `window.location`, `Date.now()`, atau `Math.random()` di dalam client component.

Untuk URL, pakai `process.env.NEXT_PUBLIC_SITE_URL` — sama di kedua sisi.

### Suite e2e gagal padahal kodenya benar

Dua sebab yang pernah terjadi:

- **Kuota habis.** Tiap run membuat rencana sungguhan. Pasang key sendiri di `.env.local`.
- **Asersi yang lemah.** Satu tes pernah mencocokkan berdasarkan judul rencana, dan gagal karena dua rencana kebetulan bernama sama. Kalau tesnya gagal, periksa dulu apakah tesnya yang salah — jangan langsung menyalahkan kode.

### `npm run spike` melaporkan WARN

Itu memang tugasnya. Pemeriksaan strukturnya menandai plan yang terlalu dangkal, prompt yang terlalu pendek, atau bahasa yang tidak konsisten.

Kalau muncul setelah kamu mengubah prompt, kemungkinan besar perubahanmu yang menyebabkannya. Jalankan `--no-interview` supaya dua run bisa dibandingkan dengan masukan yang sama.

---

## Melihat apa yang sebenarnya terjadi

Semua panggilan AI tercatat, termasuk yang gagal:

```sql
SELECT stage, model, tier, byok, ms, input_tokens, output_tokens, ok, error
FROM usage_log
ORDER BY created_at DESC
LIMIT 20;
```

Berapa kuota bersama yang terpakai hari ini:

```sql
SELECT count(*) FROM usage_log
WHERE byok = false AND created_at > now() - interval '24 hours';
```

Kualitas prompt yang dihasilkan:

```sql
SELECT count(*) FILTER (WHERE length(agent_prompt) < 180) AS stub,
       count(*) AS total,
       round(avg(length(agent_prompt))) AS rata2
FROM tasks;
```

Angka `stub` seharusnya nol. Kalau tidak, repair loop-nya tidak bekerja — lihat [7. Arsitektur](07-arsitektur.md).

---

## Berikutnya

- [10. Catatan keputusan](10-keputusan.md)
