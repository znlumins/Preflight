[← Daftar isi](README.md)

# 1. Mulai

Dari ide di kepala ke task pertama yang bisa dikerjakan agent. Sekitar lima menit, dan kamu tidak perlu mendaftar apa pun.

---

## Langkah 1 — Tulis idenya

Buka halaman depan. Kotak besar itu untuk idemu, ditulis apa adanya:

> Aplikasi pencatat keuangan buat freelancer. Catat pemasukan per klien, sisihkan uang pajak otomatis, ingetin invoice yang belum dibayar.

Tidak perlu rapi. Tidak perlu istilah teknis. Satu kalimat utuh sudah cukup untuk mulai — kalau terlalu pendek, tombolnya memang tidak aktif.

Di bawahnya ada satu baris opsional untuk batasan:

> Sendirian, 6 minggu, budget nol

**Isi ini.** Rencana untuk proyek akhir pekan dan rencana untuk produk berpendanaan seharusnya berbeda jauh, dan satu baris ini yang membedakannya. Tanpa itu, Preflight akan menebak — biasanya menebak terlalu besar.

## Langkah 2 — Jawab lima pertanyaan

Preflight bertanya lima hal yang **jawabannya mengubah isi rencana**. Bukan formalitas: kalau semua jawaban menghasilkan fitur yang sama, pertanyaannya tidak akan ditanyakan.

Contohnya, untuk ide di atas:

- Bagaimana perhitungan pajak otomatis yang harus diterapkan?
- Lewat channel apa pengingat invoice dikirim ke klien?
- Apakah aplikasi perlu terhubung ke mutasi rekening bank?
- Bagaimana strategi penyimpanan data supaya budget tetap nol?
- Fitur apa yang **pasti tidak** akan dibuat dalam batas waktu ini?

Di bawah tiap pertanyaan ada satu baris kecil yang menjelaskan kenapa itu ditanyakan.

**Boleh dilewati.** Yang tidak kamu jawab akan diisi dengan default yang masuk akal. Tapi pertanyaan terakhir — soal apa yang **tidak** akan dibuat — biasanya yang paling menyelamatkan, karena memotong lingkup itu pekerjaan tersulit dalam perencanaan.

## Langkah 3 — Tunggu sebentar

Klik **Susun rencana**. Sekitar 40–60 detik.

Halamannya terisi bertahap, bukan diam lalu muncul sekaligus:

```
PRD  ──  Fitur  ──  Spec  ──  Task
```

Tiap tahap yang selesai langsung tersimpan. Kalau kamu refresh di tengah jalan, dia melanjutkan dari tahap terakhir — tidak mengulang dari nol.

## Langkah 4 — Ambil task pertama

Yang kamu dapat:

```
BukuFreelance
├── PRD          masalah, tujuan, bukan-tujuan, lingkup v1, tech stack, risiko
├── 6 fitur      dari sudut pandang user, dengan prioritas P0/P1/P2
├── 18 subfitur  unit yang bisa diselesaikan sekali duduk
└── 36 task      tiap satu punya prompt siap tempel
```

Gulir ke bagian **Rencana kerja**. Tiap task punya blok gelap di bawahnya — itu isi sebenarnya:

> Buat Zod validation schema untuk form registrasi pada file `lib/validations/auth.ts`. Skema harus memvalidasi field email (format email valid), password (minimal 8 karakter), dan nama lengkap (tidak boleh kosong). Berikan pesan error dalam Bahasa Indonesia yang jelas untuk setiap kegagalan validasi. Verifikasi bahwa file skema dapat diimport tanpa error TypeScript.

Nama file, library, pesan error, dan cara memverifikasinya — lengkap.

**Klik bloknya untuk menyalin.** Seluruh blok itu tombolnya. Tempel ke Claude Code, Cursor, atau agent apa pun.

Setelah selesai, centang kotak di sebelah kiri task. Centangnya milikmu — tidak akan hilang meski rencananya kamu revisi.

---

## Berikutnya

| Kalau kamu mau… | Baca |
|---|---|
| Tahu semua yang bisa dilakukan | [2. Memakai Preflight](02-memakai.md) |
| Lepas dari batas 3 rencana/hari | [3. API key sendiri](03-api-key.md) |
| Berhenti menyalin 36 prompt manual | [5. Sambungkan agent](05-agent.md) |

## Dua hal yang perlu kamu tahu sejak awal

**Rencana kamu tersimpan di browser ini, tanpa akun.** Identitasnya cookie. Ganti browser atau hapus cookie, rencananya tidak bisa ditemukan lagi. Kalau ada rencana yang penting, unduh Markdown-nya atau terbitkan ke tautan publik.

**Di tier gratis, Google memakai isi permintaan untuk melatih modelnya.** Kalau idemu benar-benar rahasia, jangan ditempel di sini.
