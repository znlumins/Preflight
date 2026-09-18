# Preflight

Ubah ide jadi PRD, daftar fitur, dan task berurutan — di mana **tiap task sudah berisi prompt siap tempel** ke Claude Code, Cursor, atau AI coding agent lain.

Vibe coding gagal bukan karena AI-nya jelek, tapi karena perencanaannya jelek. Preflight mengisi bagian itu: hulu dari agent coding, bukan penggantinya.

Jalan di atas model AI gratis. Tanpa daftar akun, tanpa bayar.

---

## Apa yang kamu dapat

Satu ide → lima pertanyaan → dokumen kerja lengkap:

```
BukuFreelance
├── PRD          masalah, tujuan, bukan-tujuan, lingkup v1, tech stack, risiko
├── 6 fitur      dari sudut pandang user, dengan prioritas P0/P1/P2
├── 18 subfitur  unit yang bisa diselesaikan sekali duduk
└── 36 task      tiap satu punya agent prompt siap tempel
```

Contoh isi satu task:

> Buat Zod validation schema untuk form registrasi pada file `lib/validations/auth.ts`.
> Skema harus memvalidasi field email (format email valid), password (minimal 8 karakter),
> dan nama lengkap (tidak boleh kosong). Berikan pesan error dalam Bahasa Indonesia yang
> jelas untuk setiap kegagalan validasi. Verifikasi bahwa file skema dapat diimport tanpa
> error TypeScript.

Nama file, library, pesan error, dan cara verifikasinya — lengkap. Itu yang dibawa pulang.

---

## Angka sebenarnya

Semua keputusan arsitektur di sini lahir dari pengukuran, bukan tebakan. Jalankan sendiri dengan `npm run spike`:

| | |
|---|---|
| Request per rencana | ~7 |
| Token per rencana | ~20.000 |
| Durasi | 40–60 detik |
| Rencana per hari, satu key bersama | ~71 |

Dua hasil pengukuran yang mengubah arsitekturnya:

**Model Gemini Flash penuh cuma ~20 request/hari di tier gratis**, bukan 250 seperti yang banyak disebut — sementara Flash-Lite dapat ~500. Karena itu kuota bersama jalan _single-tier_; memakai model yang lebih bagus di key bersama akan membatasi seluruh produk ke ~10 rencana per hari. Pengguna dengan key sendiri tetap dapat model yang lebih bagus untuk PRD.

**Groq free tier membatasi output di 1.000 token per menit.** Satu rencana butuh ~17.000 output token, jadi di sana satu rencana makan 17 menit. Angka "1.000 request/hari" yang sering dikutip tidak pernah jadi batas yang mengikat. Groq didukung, tapi bukan default.

Verifikasi sendiri kapan saja — batas provider sering berubah:

```bash
npx tsx scripts/list-models.ts    # model yang benar-benar bisa dipanggil key kamu
npx tsx scripts/probe-limits.ts   # rate limit asli dari header respons
```

---

## Menjalankan

**Prasyarat:** Node 22+, PostgreSQL, dan satu API key gratis.

```bash
git clone https://github.com/znlumins/Preflight.git
cd Preflight
npm install
cp .env.example .env.local
```

Isi `.env.local`:

```bash
# Ambil gratis, tanpa kartu kredit: https://aistudio.google.com/apikey
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/preflight

# Kunci enkripsi untuk API key milik user. Bikin dengan:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=
```

Lalu:

```bash
createdb preflight     # atau bikin lewat Laragon / pgAdmin
npm run db:push        # bikin tabelnya
npm run dev
```

Buka http://localhost:3000.

---

## Bagaimana cara kerjanya

Pipeline lima tahap plus revisi berbasis diff, di `lib/ai/`:

```
questions   ide                        → 5 pertanyaan yang mengubah rencana
prd         ide + jawaban              → struktur PRD (markdown dirender di kode)
features    PRD                        → fitur + subfitur, dari sudut pandang user
specs       fitur                      → spec 4-bagian: story, kriteria, data, edge case
tasks       fitur + spec               → task + agent prompt siap tempel
revise      pesan user + plan saat ini → operasi diff ber-ID, bukan regenerasi
```

Tiga hal yang bikin ini bertahan di model gratis:

**Batching.** Bentuk naifnya satu panggilan per fitur untuk spec dan satu lagi untuk task — ~17 panggilan. Dibatch jadi ~7. Yang mahal itu request, bukan token.

**Fallback antar-model.** Tier gratis mengembalikan 503 di empat dari tujuh run yang diukur, dan mengulang ke model yang sama tidak pernah menolong. Tiap tier punya rantai model cadangan.

**Kontrak output ditegakkan di kode, bukan di prompt.** Model kecil punya varians tinggi: prompt yang sama menghasilkan 2,0 task per subfitur di satu run dan 1,3 di run berikutnya; judul Indonesia sekali, Inggris berikutnya. `lib/ai/validate.ts` memeriksa tiap hasil, lalu _re-ask_ tertarget memperbaikinya. Dua percobaan dibandingkan dari **berapa item yang masih cacat**, bukan berapa jenis cacatnya.

Revisi mengembalikan diff, bukan plan baru — yang tidak kamu sebut tidak tersentuh. Sebelum diterapkan, plan di-snapshot, jadi menghapus fitur bisa dibatalkan.

---

## Kuota dan API key sendiri

Satu key gratis melayani ~71 rencana **untuk seluruh pengunjung**, bukan per orang. Karena itu:

- Kuota bersama dibatasi 3 rencana per sesi per hari, dan sisanya ditampilkan di depan — batas yang tidak terlihat akan terasa sewenang-wenang saat menabrak.
- Pengguna bisa memasang API key sendiri di `/pengaturan`. Gratis, tanpa kartu kredit, dan batasnya jadi milik mereka.

Key milik user dienkripsi AES-256-GCM sebelum masuk database, diverifikasi ke provider sebelum disimpan, dan tidak pernah dikirim balik ke browser selain empat karakter terakhir.

> Di tier gratis, Google memakai isi permintaan untuk melatih modelnya. Ini disebutkan terang-terangan di halaman pengaturan — pengguna yang menempel ide produknya berhak tahu.

---

## Stack

| | |
|---|---|
| Next.js 16, React 19 | App Router |
| AI SDK 7 + Zod 4 | structured output, provider-agnostic |
| PostgreSQL + Drizzle | lokal sekarang, Neon/Supabase tanpa ubah kode |
| Tailwind 4 | |

Sesi anonim lewat cookie — tanpa akun, supaya tidak ada dinding di depan hal yang orang datang untuk coba. Tiap tahap commit sendiri, jadi refresh di tengah generasi melanjutkan, bukan mengulang.

---

## Perintah

```bash
npm run dev                            # jalankan aplikasi
npm run build                          # build produksi
npm run typecheck                      # tsc --noEmit
npm run lint

npm run spike                          # ukur biaya pipeline, tulis ke out/
npm run spike -- --no-interview        # jawaban tetap, buat A/B prompt
npm run spike -- --single-tier         # konfigurasi kuota bersama
npm run spike -- --provider groq

npm run db:push                        # terapkan skema
npm run db:studio                      # Drizzle Studio

npx tsx scripts/e2e.ts                 # alur utama, lewat HTTP asli
npx tsx scripts/e2e-byok.ts            # API key sendiri
npx tsx scripts/e2e-revise.ts          # revisi + undo + rate limit
npx tsx scripts/shots.ts               # screenshot untuk review desain
```

Suite e2e dijalankan terhadap server yang sedang hidup, bukan mock. Asersi yang paling penting justru yang negatif: key tersimpan tidak pernah bisa dibaca balik, revisi tidak menyentuh bagian yang tidak diminta, dan rate limit benar-benar menolak — bukan sekadar memperingatkan.

---

## Deploy

Ganti `DATABASE_URL` ke Postgres yang di-host (Neon, Supabase, Railway — semuanya punya tier gratis) lalu `npm run db:push`. Tidak ada kode yang berubah.

Generate `ENCRYPTION_KEY` baru untuk produksi. Kalau nilai itu berubah setelah ada pengguna, semua key tersimpan jadi tidak terbaca — sudah ditangani dengan jatuh balik ke kuota bersama, bukan crash, tapi pengguna harus memasang ulang key-nya.

---

## Status

Bisa dipakai, masih ada yang kurang:

- Revisi belum bisa mengubah PRD, baru fitur dan task
- Undo baru satu langkah ke belakang
- Belum ada ekspor ke format selain Markdown
- Belum ada CLI untuk menarik task langsung ke dalam agent
