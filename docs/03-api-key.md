[← Daftar isi](README.md)

# 3. API key sendiri

Preflight jalan di atas model AI gratis. Halaman ini menjelaskan batasnya, kenapa ada, dan cara melepaskan diri darinya.

---

## Kenapa ada batas

Satu API key gratis melayani sekitar **71 rencana per hari untuk seluruh pengunjung** — bukan per orang. Tanpa pembatasan, satu orang bisa menghabiskan jatah semua orang sebelum makan siang.

Jadi kuota bersama dijatah:

| | Per browser | Per jaringan (IP) |
|---|---|---|
| Rencana baru | 3 per hari | 6 per hari |
| Menyiapkan pertanyaan | 8 per hari | 16 per hari |
| Revisi | 20 request per hari | 40 request per hari |
| Ulang tahap satu rencana | 24 request per hari per rencana | — |
| Plafon global | 420 request/hari untuk semua orang | |

Hitungannya **24 jam bergulir**, bukan reset tengah malam — jadi tidak ada tebing mendadak.

Batas per jaringan ada karena batas per browser cukup diakali dengan menghapus cookie. Angkanya dibuat lebih longgar karena satu kampus atau kantor bisa berbagi satu IP. Yang disimpan hanya hash IP, bukan alamatnya.

Revisi dihitung dalam request, bukan pesan: revisi yang menambah fitur ikut membayar tiga request untuk merinci tiap fitur baru. Dengan kuota bersama, paling banyak dua fitur baru dirinci per pesan; sisanya disimpan sebagai judul fitur saja.

Sisa jatahmu ditampilkan di halaman depan dan di `/pengaturan`. Batas yang tidak terlihat akan terasa sewenang-wenang saat menabrak.

Plafon global sengaja disisakan 80 request di bawah batas provider, supaya generasi yang sedang berjalan bisa selesai — bukan mati di tahap keempat.

---

## Memasang key sendiri

Buka **`/pengaturan`**.

### Google AI Studio — disarankan

1. Buka [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Klik **Create API key**. Gratis, tanpa kartu kredit.
3. Salin key-nya (diawali `AIza…`)
4. Tempel di `/pengaturan`, klik **Simpan key**

Sekitar 500 request/hari — cukup untuk **~70 rencana per hari untukmu sendiri**.

### Groq — bisa, tapi lambat untuk beban ini

Ada di [console.groq.com/keys](https://console.groq.com/keys), juga gratis.

Tapi jujur saja: tier gratis Groq membatasi **1.000 output token per menit**. Satu rencana butuh ~17.000 output token, jadi satu rencana makan sekitar **17 menit** di sana. Angka "1.000 request/hari" yang sering dikutip tidak pernah jadi batas yang mengikat untuk beban kerja ini.

Groq didukung, tapi bukan pilihan pertama.

---

## Apa yang berubah setelah pasang key

| | Kuota bersama | Key sendiri |
|---|---|---|
| Rencana per hari | 3 | sebatas kuota providermu |
| Revisi per hari | 20 request | sebatas kuota providermu |
| Model untuk PRD | Flash-Lite | **Flash** (lebih baik) |

Poin terakhir tidak sekadar bonus. Di tier gratis Google, model **Flash penuh cuma ~20 request/hari**, sementara Flash-Lite dapat ~500. Kalau kuota bersama memakai Flash, seluruh produk mentok di ~10 rencana/hari. Jadi kuota bersama jalan single-tier, dan yang membawa kuota sendiri dapat model lebih bagus untuk PRD.

---

## Bagaimana key kamu disimpan

- **Dienkripsi AES-256-GCM** sebelum masuk database. Yang tersimpan ciphertext, bukan key-nya.
- **Diverifikasi ke provider sebelum disimpan.** Salah ketik gagal saat ditempel, bukan di tengah generasi pertamamu.
- **Tidak pernah dikirim balik ke browser.** Halaman pengaturan cuma menerima empat karakter terakhir, supaya kamu tahu key mana yang terpasang.
- **Bisa dihapus kapan saja**, dan langsung hilang dari database.

Kalau key-nya jadi tidak terbaca — misalnya `ENCRYPTION_KEY` server berubah — Preflight jatuh balik ke kuota bersama, tidak crash.

---

## Yang perlu kamu tahu soal privasi

**Di tier gratis, Google memakai isi permintaan untuk melatih modelnya.** Itu berlaku untuk ide yang kamu tulis, jawaban kuesionermu, dan seluruh isi rencana.

Ini disebutkan terang-terangan di halaman pengaturan, bukan dikubur di syarat dan ketentuan. Kalau idemu benar-benar rahasia, jangan ditempel di sini — atau pakai akun berbayar yang punya ketentuan berbeda.

---

## Batas provider itu bergerak

Angka di halaman ini hasil pengukuran pada saat ditulis, dan provider mengubahnya tanpa pengumuman. Dua skrip untuk cek ulang sendiri:

```bash
npx tsx scripts/list-models.ts    # model yang benar-benar bisa dipanggil key kamu
npx tsx scripts/probe-limits.ts   # rate limit asli dari header respons
```

Skrip kedua yang menemukan batas OTPM Groq — angka itu tidak ada di dokumentasi mana pun yang kami baca.

---

## Berikutnya

- [4. Berbagi rencana](04-berbagi.md)
- [5. Sambungkan agent](05-agent.md)
- [9. Kalau bermasalah](09-masalah.md) — kalau kuotanya habis atau key ditolak
