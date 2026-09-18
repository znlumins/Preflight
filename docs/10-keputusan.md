[← Daftar isi](README.md)

# 10. Catatan keputusan

Kenapa bentuknya begini, berikut angka yang mendasarinya. Semua diukur pada aplikasi ini, bukan dikutip dari dokumentasi.

---

## Yang salah dari dokumentasi provider

Dua angka ini menentukan hampir seluruh arsitekturnya, dan dua-duanya tidak bisa didapat dari membaca dokumen.

### Model Flash penuh cuma ~20 request/hari

```
Quota exceeded for metric: generate_content_free_tier_requests,
limit: 20, model: gemini-3.8-flash
```

Banyak sumber menyebut 250. Yang benar 20 — sementara **Flash-Lite dapat ~500**.

Konsekuensinya langsung: kalau kuota bersama memakai model Flash, seluruh produk mentok di **10 rencana per hari**. Jadi kuota bersama jalan _single-tier_ (semua tahap di Flash-Lite), dan pengguna dengan key sendiri dapat Flash untuk PRD.

Perbandingannya diukur:

| | Rencana/hari per key | Durasi | Kualitas PRD |
|---|---|---|---|
| Dual-tier (Flash untuk PRD) | **10** | 60 detik | 4 non-goal, lebih tajam |
| Single-tier (semua Flash-Lite) | **71** | **39 detik** | 3 non-goal, 1 agak meleset |

Turun kualitasnya tipis; throughputnya naik 7× dan lebih cepat.

### Groq membatasi output 1.000 token/menit

Dari header responsnya sendiri:

```
x-ratelimit-limit-requests    1000      ← yang diiklankan
x-ratelimit-limit-tokens      8000      ← per menit
OTPM (output tokens/minute)   1000      ← yang sebenarnya mengikat
```

Satu rencana butuh ~17.000 output token. Di 1.000 OTPM itu **17 menit per rencana**. Angka "1.000 request/hari" tidak pernah relevan untuk beban kerja ini.

Groq tetap didukung, tapi bukan default. Seluruh lini model Llama juga sudah dihapus dari sana — tersisa tiga model, dan yang 20B tidak sanggup memegang skema task.

**Pelajaran:** ukur, jangan percaya. `scripts/probe-limits.ts` ada untuk itu.

---

## Biaya satu rencana

| | |
|---|---|
| Request AI | ~7 |
| Token | ~20.000 |
| Waktu | 40–60 detik |

Perkiraan awal sebelum diukur adalah 12–20 request dan 150.000–300.000 token. **Meleset sekitar 15×.**

Itu bukan koreksi sepele: perkiraan yang salah membuat kesimpulan "kuota bersama tidak mungkin, BYOK wajib". Angka sebenarnya membalik kesimpulan itu — satu key gratis menampung ~71 rencana/hari, cukup untuk free tier yang mengalahkan paket berbayar kompetitor.

---

## Yang mahal itu request, bukan token

Saat kedalaman rencana dinaikkan tiga kali lipat, biaya request tidak bergerak:

| | Request | Token | Hasil |
|---|---|---|---|
| Sebelum | 7 | 13.972 | 12 task |
| Sesudah | **7** | 19.581 | **36 task** |

Karena itu batching jadi keputusan yang paling menentukan: 17 panggilan naif ditekan jadi ~7.

---

## Model kecil punya varians tinggi, dan prompt tidak mengikatnya

Prompt yang sama, dua run berurutan:

| | Run A | Run B |
|---|---|---|
| Task per subfitur | 2,0 | 1,3 |
| Judul berbahasa Inggris | 0 | 9 dari 24 |

Menambal prompt dicoba berkali-kali dan tidak menempel. Yang bekerja adalah menegakkan kontraknya **di kode** (`lib/ai/validate.ts`) lalu menjalankan satu re-ask tertarget yang memperlihatkan model keluarannya sendiri beserta daftar persis apa yang salah.

### Satu bug yang membuat repair loop-nya sia-sia

```ts
after.length < defects.length      // salah
severity(after) < severity(defects) // benar
```

Versi pertama membandingkan **jumlah jenis cacat**. Perbaikan yang membereskan 7 dari 10 prompt stub tetap melaporkan satu jenis cacat, jadi dianggap tidak membaik — dan hasilnya dibuang.

Gejalanya: repair loop terlihat berjalan di log, tapi stub tetap sampai ke pengguna.

---

## Mengukur tidak sama dengan menegakkan

Panjang agent prompt diperiksa di `spike.ts` sejak hari pertama. Tapi pemeriksaan itu hanya mencetak peringatan — tidak ada di jalur produksi.

Akibatnya tiga prompt stub 60 karakter sampai ke rencana pengguna, padahal ambangnya sudah diketahui sejak awal.

Sekarang ambang yang sama (`MIN_PROMPT_CHARS = 180`) ada di `validate.ts` dan memicu repair loop.

**Pelajaran:** kalau sebuah ambang cukup penting untuk diukur, dia cukup penting untuk ditegakkan.

---

## Jangan memotong jalan yang sudah terbukti

Saat revisi menambah fitur baru, fitur itu perlu diisi subfitur dan task.

Percobaan pertama: satu panggilan yang menghasilkan subfitur **dan** task sekaligus, demi hemat kuota. Hasilnya prompt 56–88 karakter, padahal pipeline utama rata-rata 352.

Sebabnya: jalur task yang sudah matang — aturan granularitas, injeksi jumlah target, repair loop — ditulis ulang dalam versi yang lebih jelek.

Percobaan kedua memakai ulang `tasks()` tapi melewati tahap `specs()`. Masih 2 stub, karena tanpa kriteria penerimaan dan edge case, model tidak punya bahan konkret.

Yang akhirnya bersih: **urutan penuh** — `expandFeature()` → `specs()` → `tasks()`. Tiga panggilan, hanya saat ada fitur yang ditambah.

---

## Tier gratis memang tidak stabil

503 "high demand" muncul di **empat dari tujuh** run yang diukur. Di satu run, dua dari tiga model tier `deep` penuh bersamaan.

Mengulang ke model yang sama tidak pernah menolong. Rantai fallback antar-model yang menolong — dan pipeline selamat di semua kejadian.

Rantai awalnya salah desain: ketiga kandidat tier `deep` sama-sama model 20-RPD, jadi saat kuota habis dia jatuh ke sesama model yang juga habis. Sekarang rantainya berakhir di Flash-Lite yang berkuota besar.

---

## Beban MCP

| | Waktu server | Panggilan AI |
|---|---|---|
| 1× generate rencana | 120.478 ms | 17 |
| 1× `preflight_next_task()` | **0,049 ms** | 0 |

Query-nya index scan, 3 buffer hit. Round-trip penuh lewat HTTP: 31 ms median, 66 ms p95.

Beban yang sebenarnya perlu dijaga bukan CPU, tapi **konteks agent**: definisi tool menetap sepanjang percakapan. Tiga tool = 1.594 byte (~400 token), dan ada asersi yang gagal kalau membengkak.

`maxSubscriptions: 0` mematikan SSE, jadi agent yang nganggur tidak menahan koneksi.

---

## Keputusan produk

**Tanpa akun.** Sesi anonim lewat cookie. Kompetitor mewajibkan signup untuk 1 PRD; di sini tidak ada dinding di depan hal yang orang datang untuk coba. Konsekuensinya jujur: ganti browser, rencananya hilang.

**Halaman publik server-rendered.** Satu rencana menghasilkan ~3.900 kata di HTML. Aplikasi kompetitor berbentuk SPA Vite — halaman `/plan` mereka cuma 8,5 KB shell dan `/live` malah merender 404 di server. Ini celah struktural yang tidak bisa ditutup tanpa menulis ulang frontend.

**Menerbitkan itu opt-in dan bisa ditarik.** Slug dihapus, bukan ditandai, supaya tautan lama benar-benar 404.

**Batas kuota ditampilkan di depan.** Batas yang tidak terlihat terasa sewenang-wenang saat menabrak.

---

## Cara mengukur ulang sendiri

```bash
npm run spike -- --no-interview      # biaya pipeline, masukan deterministik
npm run spike -- --single-tier       # konfigurasi kuota bersama
npx tsx scripts/probe-limits.ts      # rate limit asli dari header
npx tsx scripts/list-models.ts       # model yang benar-benar hidup
```

Angka di dokumen ini akan usang. Skripnya tidak.
