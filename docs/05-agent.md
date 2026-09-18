[← Daftar isi](README.md)

# 5. Sambungkan agent

Daripada menyalin 36 prompt satu per satu, biarkan agent-nya yang mengambil sendiri. Setelah tersambung, kamu cukup bilang:

> kerjakan rencana Preflight-ku

Agent ambil task, kerjakan, tandai selesai, lanjut ke berikutnya — sendiri.

Jalan di **Claude Code** dan **Cursor** lewat MCP (Model Context Protocol).

---

## Pasang

### 1. Buat token

Buka **`/pengaturan`**, gulir ke **Sambungkan ke AI coding agent**, klik **Buat token**.

Muncul konfigurasi lengkap, sudah berisi token-nya. **Salin sekarang** — nilainya hanya ditampilkan sekali dan tidak bisa dilihat lagi.

### 2. Tempel ke editormu

Isinya seperti ini:

```json
{
  "mcpServers": {
    "preflight": {
      "url": "https://preflight.example.com/api/mcp/mcp",
      "headers": { "Authorization": "Bearer pf_xxxxxxxxxxxx" }
    }
  }
}
```

| Editor | Taruh di |
|---|---|
| **Claude Code** | `.mcp.json` di root proyek, atau `~/.claude.json` untuk semua proyek |
| **Cursor** | Settings → MCP → Add server |

### 3. Mulai

Restart editornya, lalu:

> kerjakan rencana Preflight-ku

Agent akan memanggil `preflight_next_task` sendiri.

---

## Tiga tool, dan kenapa cuma tiga

| Tool | Fungsinya |
|---|---|
| `preflight_next_task` | Ambil task berikutnya yang belum selesai, lengkap dengan instruksinya |
| `preflight_complete_task` | Tandai satu task selesai, laporkan sisanya |
| `preflight_plan_status` | Ringkasan progres, per fitur |

Definisi tiap tool **menetap di konteks agent sepanjang percakapan**. Server MCP dengan 30 tool akan memakan konteks penggunanya sebelum dia sempat kerja — itu keluhan paling umum soal MCP.

Jadi ini budget, bukan menu. Ukurannya diuji: **1.594 byte, sekitar 400 token** untuk ketiganya. Ada asersi yang gagal otomatis kalau membengkak.

---

## Rencana mana yang dikerjakan

Kalau tidak disebutkan, yang dipakai adalah **rencana yang paling baru diubah** — biasanya yang barusan kamu lihat.

Kalau kamu punya beberapa, `preflight_plan_status` menampilkan daftarnya beserta id-nya. Sebutkan saja ke agent:

> pakai rencana `a1b2c3d4` ya

---

## Beban server

Pertanyaan yang wajar, jadi ini angkanya:

| | Waktu server | Panggilan AI |
|---|---|---|
| 1× generate rencana | 120.478 ms | 17 |
| 1× `preflight_next_task()` | **0,049 ms** | 0 |

Tidak ada tool yang memanggil model. Rencananya sudah jadi dan tersimpan di Postgres; tool-nya cuma membaca baris yang ada — index scan, 3 buffer hit.

Round-trip penuh lewat HTTP: **31 ms median, 66 ms p95.** Sebagian besar itu overhead jaringan.

Dan yang biasanya bikin MCP terasa berat — koneksi SSE menggantung per agent — dimatikan (`maxSubscriptions: 0`). Agent yang nganggur berbiaya **nol**, karena tidak ada koneksi yang ditahan.

---

## Keamanan token

Token ini **kredensial**. Perlakukan seperti password.

- Dikirim di header `Authorization`, **tidak pernah di URL**. URL berakhir di log server, riwayat browser, dan header referrer — bearer token tidak punya urusan di sana.
- Yang disimpan cuma **SHA-256**-nya. Dump database tidak memberi siapa pun akses.
- Satu token memetakan ke **satu sesi anonim**. Agent menjangkau persis rencana yang bisa dijangkau pemiliknya, tidak lebih.
- **Jangan taruh di repo publik.** Kalau `.mcp.json` ikut ter-commit, cabut token itu dan buat yang baru.

Membuat token baru otomatis membatalkan yang lama. Itu juga cara mencabutnya kalau telanjur tersebar.

---

## Kalau tidak jalan

| Gejala | Kemungkinan |
|---|---|
| Agent bilang server tidak ditemukan | URL masih `localhost` padahal agent jalan di mesin lain |
| Ditolak / unauthorized | Token salah ketik, sudah dicabut, atau tertimpa token baru |
| Tool tidak muncul | Editor belum di-restart setelah config diubah |
| "Tidak ada rencana yang siap" | Rencananya belum selesai dibuat — statusnya harus `done` |

Lebih lengkap di [9. Kalau bermasalah](09-masalah.md).

---

## Catatan jujur

MCP masih bergerak cepat, dan dukungannya paling matang di Claude Code dan Cursor. Kalau editormu lain, jangkauannya lebih sempit.

Tapi biayanya nol dan bebannya kecil, jadi risikonya rendah — dan menyalin 36 prompt manual itu bukan pengalaman yang ingin diulang siapa pun.
