[← Daftar isi](README.md)

# 4. Berbagi rencana

Rencana yang sudah selesai bisa diterbitkan ke tautan publik. Berguna untuk mengirim ke tim, klien, atau siapa pun — dan halaman itu bisa dibaca mesin pencari.

---

## Cara menerbitkan

Buka rencanamu, gulir ke bawah sampai **Bagikan rencana ini**.

Klik **Terbitkan ke tautan publik**. Muncul konfirmasi yang menyebut konsekuensinya sebelum tombolnya ditekan — baca dulu, lalu klik **Ya, terbitkan**.

Hasilnya tautan seperti:

```
https://preflight.example.com/p/bukufreelance-mnwqxt
```

Ada tombol salin dan tautan untuk melihat hasilnya.

---

## Yang ikut terbit dan yang tidak

| Ikut terbit | Tetap pribadi |
|---|---|
| Judul dan PRD | Teks ide asli yang kamu tulis |
| Fitur dan subfitur | Baris batasan/konteks |
| Spec tiap fitur | Jawaban kuesioner |
| Semua task + prompt-nya | Riwayat revisi |
| | Id sesimu |

**Yang terbit adalah rencananya, bukan dirimu.**

Ini diuji, bukan diasumsikan. Suite pengujiannya menyelipkan penanda `RAHASIA-BISNIS-JANGAN-BOCOR` ke kolom konteks, lalu memastikan penanda itu tidak muncul di HTML publik.

---

## Menurunkan

Tombol **Turunkan dari publik** di bagian yang sama.

Slug-nya **dihapus**, bukan ditandai. Artinya tautan lama jadi 404 — bukan halaman yang diam-diam masih bisa dibuka oleh siapa pun yang menyimpan link-nya.

Satu hal yang harus jujur disampaikan, dan memang tertulis di konfirmasinya: **yang sudah terlanjur dibaca atau ter-cache tidak bisa ditarik kembali.** Mesin pencari perlu waktu untuk menghapus dari indeksnya. Kalau isinya sensitif, jangan diterbitkan sejak awal.

---

## Halaman publiknya

Dirender di server, tanpa JavaScript kecuali tombol salin. Satu rencana biasa menghasilkan sekitar **3.900 kata dan seluruh prompt task** di dalam HTML-nya.

Artinya:

- Bisa dibaca tanpa JavaScript aktif
- Bisa diindeks mesin pencari sepenuhnya
- Cepat dibuka di koneksi lambat
- Punya judul, deskripsi, Open Graph, dan structured data `TechArticle`

Di bawahnya ada ajakan untuk membuat rencana sendiri. Tiap rencana yang dibagikan adalah pintu masuk bagi orang yang sedang mencari cara memecah ide yang mau dibangunnya.

---

## Indeks publik

`/rencana` memuat semua rencana yang dibagikan, terbaru dulu, dengan ringkasan satu kalimat tiap rencana.

Halaman ini juga ada di `sitemap.xml`. Rencana privat tidak pernah muncul di sana — `robots.txt` bahkan melarang crawler menyentuh `/plans/`, `/pengaturan`, dan `/api/`.

---

## Berikutnya

- [5. Sambungkan agent](05-agent.md)
- [8. Deploy](08-deploy.md) — perlu domain sungguhan supaya bisa diindeks
