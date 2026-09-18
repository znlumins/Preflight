[← Daftar isi](README.md)

# 7. Arsitektur

---

## Stack

| | |
|---|---|
| Next.js 16, React 19 | App Router |
| AI SDK 7 + Zod 4 | structured output, provider-agnostic |
| PostgreSQL + Drizzle | lokal dan produksi sama |
| Tailwind 4 | |
| mcp-handler | server MCP |

---

## Pipeline

Lima tahap plus revisi, semuanya di `lib/ai/pipeline.ts`:

```
questions   ide                        → 5 pertanyaan yang mengubah rencana
prd         ide + jawaban              → struktur PRD
features    PRD                        → fitur + subfitur
specs       fitur                      → spec 4-bagian
tasks       fitur + spec               → task + prompt siap tempel
revise      pesan + plan saat ini      → operasi diff ber-ID
```

Kuota gratis adalah sumber daya langka di sini, dan tiga keputusan berikut lahir dari itu.

### Batching

Bentuk naifnya satu panggilan per fitur untuk spec dan satu lagi untuk task — sekitar 17 panggilan untuk rencana 8 fitur. Dibatch 4 fitur per panggilan spec dan 3 per panggilan task, jadi **~7 panggilan**.

Yang mahal itu **request**, bukan token. Saat kedalaman rencana dinaikkan 3× (12 → 36 task), jumlah request tidak berubah sama sekali.

### PRD tidak menghasilkan Markdown

Tahap PRD mengembalikan struktur saja; prosanya dirakit di `lib/ai/render.ts`. Ini memangkas output token panggilan termahal kira-kira separuh, dan mengubah format dokumen jadi gratis.

### Fallback antar-model

Tier gratis mengembalikan 503 di **empat dari tujuh** run yang diukur. Mengulang ke model yang sama tidak pernah menolong.

Tiap tier punya rantai model cadangan (`lib/ai/provider.ts`). Kegagalan dipindah ke model berikutnya kalau penyebabnya kapasitas, kuota, model pensiun, atau JSON yang tidak bisa divalidasi — yang terakhir itu tanda modelnya terlalu kecil untuk memegang skema, bukan skemanya yang salah. Prompt atau skema yang benar-benar rusak akan gagal sama di semua model, jadi tidak diulang.

---

## Kontrak output ditegakkan di kode

Ini bagian yang paling menentukan kualitas.

Model gratis punya **varians tinggi antar-run**. Prompt yang sama menghasilkan 2,0 task per subfitur di satu run dan 1,3 di run berikutnya; judul Indonesia sekali, Inggris berikutnya. Menambal prompt tidak menempel.

Jadi kontraknya ditegakkan di `lib/ai/validate.ts`:

| Cacat | Ambang |
|---|---|
| `too-few-features` | minimal 5 fitur |
| `thin-features` | minimal 3 subfitur per fitur |
| `too-few-tasks` | minimal 2 task per subfitur |
| `thin-prompts` | minimal 180 karakter per agent prompt |
| `wrong-language` | judul harus sesuai bahasa keluaran |

Kalau ada cacat, satu **re-ask tertarget** dijalankan: model diperlihatkan keluarannya sendiri plus daftar persis apa yang salah — bukan disuruh mengulang dari nol.

Dan satu detail yang penting: dua percobaan dibandingkan lewat **berapa item yang masih cacat**, bukan berapa jenis cacatnya.

```ts
severity(after) < severity(defects)   // benar
after.length < defects.length         // salah, dan sempat jadi bug
```

Versi yang salah membuang perbaikan yang membereskan 7 dari 10 prompt stub, karena jenis cacatnya tetap satu.

---

## Persistensi

Tiap tahap commit sendiri-sendiri begitu selesai. Refresh di tengah generasi 60 detik akan melanjutkan dari `plan.status`, bukan mengulang.

```
plans         rencana, PRD (jsonb), status, slug publik
features      + spec (jsonb)
subfeatures
tasks         + agent_prompt, done
revisions     pesan, balasan, ops, snapshot untuk undo
api_keys      key user, terenkripsi
mcp_tokens    token agent, ter-hash
usage_log     tiap panggilan AI: model, tier, token, byok
```

`usage_log` diisi sejak hari pertama, termasuk panggilan yang **gagal** — panggilan gagal tetap menghabiskan kuota, jadi tetap masuk catatan.

---

## Revisi sebagai diff

Model mengembalikan **operasi ber-ID**, bukan rencana baru. Yang tidak disebut tidak tersentuh.

Dua aturan pengaman di `lib/revise.ts`:

- **Operasi yang menunjuk id tidak ada dilewati, bukan ditebak.** Model gratis kadang mengarang id; mengedit "yang paling mirip" akan merusak rencana tanpa jejak. Yang dilewati dilaporkan ke pengguna.
- **Menghapus fitur ikut menghapus subfitur dan task-nya.** Meninggalkan yatim lebih buruk daripada tidak berubah.

Sebelum diterapkan, seluruh rencana di-snapshot ke `revisions.snapshot`. Undo memulihkan snapshot itu — bukan menghitung kebalikan operasinya, karena begitu cascade menghapus baris, menghitung kebalikannya jadi tebakan.

Fitur yang ditambah revisi langsung diisi: subfitur, lalu **spec**, lalu task. Melewati tahap spec pernah dicoba demi hemat satu panggilan, dan hasilnya prompt stub 60 karakter — lihat [catatan keputusan](10-keputusan.md).

---

## Sesi dan akses

Tanpa akun. Identitasnya cookie `preflight_sid`, httpOnly, umur satu tahun.

Semua query rencana di-scope ke sesi. Batasannya diuji: cookie lain mendapat 404, bukan daftar kosong.

Tiga jalur akses berbagi batas yang sama:

| Jalur | Identitas |
|---|---|
| Aplikasi web | cookie `preflight_sid` |
| MCP | bearer token → sesi |
| Halaman publik | tidak ada — memang untuk siapa saja, dan hanya memuat rencananya |

---

## Dua tampilan, satu sumber

`components/PlanParts.tsx` berisi bagian yang hanya merender, dan **sengaja bukan client module**.

- Tampilan pemilik membungkusnya dengan interaktivitas — centang, revisi, progres generasi.
- Halaman publik merendernya di server tanpa JavaScript sama sekali.

Hasilnya satu rencana menghasilkan ~3.900 kata di HTML, bisa diindeks sepenuhnya, dan kedua tampilan tidak bercabang seiring waktu.

---

## MCP

`app/api/mcp/[transport]/route.ts`. Tiga tool, tanpa panggilan model — cuma membaca dan menulis baris yang sudah ada.

`maxSubscriptions: 0` mematikan SSE, jadi tidak ada koneksi digantung per agent. Transportnya request–response biasa, sama seperti endpoint lain.

Ukurannya dijaga: definisi ketiga tool 1.594 byte (~400 token), dan ada asersi yang gagal kalau membengkak — karena definisi tool menetap di konteks agent sepanjang percakapan.

---

## Berikutnya

- [10. Catatan keputusan](10-keputusan.md) — angka pengukuran di balik semua ini
- [8. Deploy](08-deploy.md)
