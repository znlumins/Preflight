[← Daftar isi](README.md)

# 2. Memakai Preflight

Semua yang bisa dilakukan, satu per satu.

---

## Halaman dan apa fungsinya

| Halaman | Isinya |
|---|---|
| `/` | Tulis ide, jawab pertanyaan, lihat rencana sebelumnya |
| `/plans/[id]` | Satu rencana milikmu — bisa diubah, dicentang, dibagikan |
| `/p/[slug]` | Versi publik sebuah rencana, bisa dibaca siapa saja |
| `/rencana` | Daftar semua rencana yang dibagikan orang |
| `/pengaturan` | API key sendiri, token agent, sisa kuota |

---

## Isi sebuah rencana

### PRD

Bagian atas dokumen. Yang paling berguna biasanya bukan "Tujuan", tapi **"Bukan tujuan"** dan **"Ditunda"** — memotong lingkup itu pekerjaan tersulit dalam perencanaan, dan di situlah rencana yang jujur berbeda dari daftar keinginan.

Tech stack-nya konkret, bukan "framework modern". Kalau kamu menulis batasan "budget nol", stack-nya akan menyesuaikan ke layanan bertier gratis.

Bagian **Risiko** berisi hal yang benar-benar bisa menggagalkan pembangunan — bukan risiko umum.

### Fitur dan subfitur

Fitur dinamai dari sudut pandang pengguna ("Checkout", "Pencarian tersimpan"), bukan dari implementasinya ("PostgresService").

Prioritasnya soal **urutan bangun**, bukan seberapa penting:

| | Artinya |
|---|---|
| **P0** | Wajib ada supaya yang lain bisa jalan |
| **P1** | Nilai inti produk |
| **P2** | Layak di v1, tapi boleh geser |

Tiap fitur punya 3–4 subfitur — unit yang bisa diselesaikan sekali duduk.

### Spec

Klik **Lihat spec** di bawah tiap fitur. Empat bagian:

- **User story** — dari sudut pandang pengguna
- **Kriteria penerimaan** — bisa dicek orang yang tidak menulis kodenya. Bukan "berfungsi dengan benar", tapi "menolak password di bawah 8 karakter dengan error inline"
- **Data & state** — nama entitas dan field yang sebenarnya
- **Edge case** — kasus gagal dan batas

Spec ini yang membuat prompt task-nya berisi. Task tanpa spec menghasilkan prompt yang dangkal — ini terbukti saat membangunnya, lihat [catatan keputusan](10-keputusan.md).

### Task

Isi sebenarnya dari produk ini. Tiap task punya:

- Judul imperatif, 3–7 kata
- Satu kalimat: apa yang berubah dan di mana
- **Prompt siap tempel** — blok gelap di bawahnya

Prompt-nya ditulis untuk agent yang bisa membaca repo tapi belum pernah melihat PRD-mu. Isinya: tujuan, file yang disentuh, batasan, dan cara memverifikasi.

Task berurutan menurut urutan bangun. Yang di atas dikerjakan dulu.

---

## Mengubah rencana

Di bagian bawah ada **Ubah rencana**. Tulis apa yang mau diubah:

> Tambahkan fitur reset password di Autentikasi

> Buang fitur notifikasi, terlalu jauh untuk v1

> Pecah task migrasi database jadi dua

Tekan Enter atau klik **Terapkan**.

### Yang kamu sebut saja yang berubah

Revisi bekerja sebagai **diff**, bukan membuat ulang. Bagian yang tidak kamu sebut tidak tersentuh — termasuk centang "selesai" milikmu.

Setelah selesai, kuitansinya menyebut persis apa yang berubah:

```
−  Menghapus fitur  Pengingat WhatsApp
−  Menghapus task   Buat utilitas format nomor dan generator URL
−  Menghapus task   Perbarui skema appointments untuk status WhatsApp
```

Kalau ada operasi yang menunjuk bagian yang tidak ada, itu **dilewati dan dilaporkan** — bukan ditebak ke yang paling mirip.

### Fitur baru langsung berisi task

Kalau revisimu menambah fitur, Preflight langsung memecahnya jadi subfitur, spec, dan task. Kamu tidak akan dapat judul kosong.

### Membatalkan

Tiap revisi menyimpan snapshot rencana **sebelum** diubah. Tombol **Batalkan** memulihkannya persis — termasuk task yang terhapus dan centang selesai milikmu.

Dua batasan yang disengaja:

- Hanya revisi **terbaru** yang bisa dibatalkan. Memutar balik yang lama akan membuang semua yang dikerjakan sesudahnya.
- Sekali batal per revisi. Yang sudah dibatalkan tetap tampil di riwayat, memudar — supaya riwayatnya tidak berbohong soal apa yang pernah dicoba.

---

## Menandai task selesai

Klik kotak di sebelah kiri task. Tersimpan langsung.

Ini **milikmu, bukan milik model**. Regenerasi dan revisi tidak menghapusnya. Kalau agent kamu yang menandai lewat MCP, centangnya juga muncul di sini.

---

## Mengunduh

Tautan **Unduh semuanya sebagai Markdown** di atas bagian Rencana kerja. Satu file berisi PRD, fitur, spec, dan seluruh task dengan prompt-nya — sekitar 30.000 karakter.

Berguna untuk:

- Menaruhnya di repo sebagai `PLAN.md`
- Memberi seluruh rencana sekaligus ke agent
- Menyimpan sebelum menghapus cookie

---

## Rencana sebelumnya

Halaman depan menampilkan empat rencana terakhirmu. Yang belum selesai ditandai — klik untuk melanjutkan dari tahap terakhirnya.

Rencana terikat ke cookie browser ini. Tidak ada akun, jadi tidak ada cara memulihkannya di perangkat lain.

---

## Berikutnya

- [3. API key sendiri](03-api-key.md) — lepas dari batas 3 rencana/hari
- [4. Berbagi rencana](04-berbagi.md) — terbitkan ke tautan publik
- [5. Sambungkan agent](05-agent.md) — berhenti menyalin manual
