/**
 * Example ideas for the empty idea box, one picked per visit.
 *
 * Written by hand, not generated: a placeholder is a promise about what kind
 * of input works, and the best way to show it is a real idea in the voice a
 * person would type it in — a product, who it is for, and two or three
 * concrete things it does. That is exactly the shape the pipeline plans best
 * from, so the example quietly teaches it.
 *
 * Each idea carries a matching constraint for the line underneath, so the two
 * placeholders read as one story instead of a finance app built "on a budget
 * of zero" next to a clinic queue.
 *
 * To add one: keep it under ~150 characters — 146 exactly fills the box's
 * five rows on a 375px phone — and make at least one feature specific enough
 * to plan against.
 */

export type ExampleIdea = {
  idea: string;
  /** Shown after "Batasannya apa? Misal: " */
  constraints: string;
};

export const EXAMPLE_IDEAS: readonly ExampleIdea[] = [
  {
    idea: 'Aplikasi pencatat keuangan buat freelancer. Catat pemasukan per klien, sisihkan uang pajak otomatis, ingetin invoice yang belum dibayar.',
    constraints: 'sendirian, 6 minggu, budget nol',
  },
  {
    idea: 'Aplikasi kasir buat warung kopi kecil. Catat pesanan per meja, pantau stok biji kopi dan susu, kirim rekap omzet harian ke WhatsApp pemilik.',
    constraints: 'berdua, 2 bulan, harus jalan di tablet Android murah',
  },
  {
    idea: 'Web buat pengelola kos. Daftar kamar dan penghuni, tagih sewa bulanan, catat keluhan kerusakan sampai beres.',
    constraints: 'sendirian, cuma bisa ngerjain akhir pekan',
  },
  {
    idea: 'Antrean online buat klinik gigi. Pasien ambil nomor dari rumah, lihat perkiraan jam dipanggil, dokter atur jadwal praktiknya sendiri.',
    constraints: 'tim 3 orang, 3 bulan, data pasien harus aman',
  },
  {
    idea: 'Pencatat setoran hafalan buat TPQ. Ustaz catat setoran tiap santri, orang tua lihat progres anaknya, rekap bulanan jadi otomatis.',
    constraints: 'sendirian, penggunanya banyak yang jarang pakai aplikasi',
  },
  {
    idea: 'Aplikasi arisan online. Kocok pemenang yang bisa dicek semua anggota, catat siapa yang sudah bayar, ingetin sebelum jatuh tempo.',
    constraints: 'sendirian, 1 bulan, tanpa biaya server',
  },
  {
    idea: 'Marketplace jasa tukang di satu kota. Pelanggan pesan tukang ledeng atau listrik, lihat ulasan, bayar setelah pekerjaan selesai.',
    constraints: 'berdua, 3 bulan, mulai dari satu kota dulu',
  },
  {
    idea: 'Jadwal les privat. Guru buka slot kosong, murid booking sendiri, tagihan dihitung per pertemuan tiap akhir bulan.',
    constraints: 'sendirian, 6 minggu, budget nol',
  },
  {
    idea: 'Pencatat stok toko bangunan. Scan barcode saat barang masuk, peringatan kalau semen atau cat hampir habis, laporan barang paling laku.',
    constraints: 'sendirian, 2 bulan, kasirnya belum pernah pakai komputer',
  },
  {
    idea: 'Galeri klien buat fotografer pernikahan. Satu galeri per acara, klien pilih foto yang mau dicetak, unduhan dikunci kata sandi.',
    constraints: 'sendirian, sambil tetap motret tiap akhir pekan',
  },
  {
    idea: 'Aplikasi bank sampah RT. Warga setor sampah terpilah, saldo tercatat per rumah, saldonya bisa ditukar sembako.',
    constraints: 'relawan 2 orang, budget nol, dipakai pengurus yang sudah sepuh',
  },
  {
    idea: 'Tracker olahraga buat pemula. Target mingguan kecil, catat lari atau push-up, streak yang tidak menghukum kalau bolos sehari.',
    constraints: 'sendirian, 1 bulan, harus enak dipakai di HP',
  },
  {
    idea: 'Booking lapangan futsal. Lihat jam yang masih kosong, bayar DP lewat QRIS, pengingat sejam sebelum main.',
    constraints: 'berdua, 6 minggu, pemilik lapangan mau coba dulu di satu tempat',
  },
  {
    idea: 'Pencatat keuangan rumah tangga buat pasangan. Dua orang catat pengeluaran bersama, bagi tagihan otomatis, lihat sisa anggaran bulan ini.',
    constraints: 'sendirian, akhir pekan saja, budget nol',
  },
  {
    idea: 'Absensi karyawan lapangan pakai foto dan lokasi. Buat usaha 10–30 orang, rekap jam kerja langsung jadi dasar hitung gaji.',
    constraints: 'tim 2 orang, 2 bulan, HP karyawannya beragam',
  },
  {
    idea: 'Pre-order katering harian. Pelanggan pesan menu minggu depan, dapur lihat total porsi per hari, kurir dapat daftar alamat urut rute.',
    constraints: 'sendirian, 6 minggu, pemesannya lewat WhatsApp selama ini',
  },
  {
    idea: 'Papan lowongan magang untuk satu kampus. Perusahaan pasang lowongan, mahasiswa melamar pakai CV tersimpan, dosen pantau siapa yang sudah diterima.',
    constraints: 'tim 3 mahasiswa, satu semester',
  },
  {
    idea: 'Aplikasi bengkel motor. Riwayat servis per plat nomor, pelanggan diingatkan ganti oli, estimasi biaya dikirim sebelum dikerjakan.',
    constraints: 'sendirian, 2 bulan, montirnya cuma mau pakai HP',
  },
  {
    idea: 'Laporan keuangan masjid yang transparan. Catat kotak amal dan transfer masuk, pengeluaran bisa dilihat jamaah, ekspor laporan ke PDF.',
    constraints: 'relawan, budget nol, bendaharanya terbiasa pakai buku tulis',
  },
  {
    idea: 'Resep buat anak kos. Cari resep dari bahan yang ada di kulkas, perkiraan biaya per porsi, daftar belanja mingguan.',
    constraints: 'sendirian, 1 bulan, tanpa biaya server',
  },
  {
    idea: 'Bot Telegram pengingat minum obat buat lansia. Keluarga atur jadwalnya, bot kirim pengingat, keluarga dikabari kalau belum dikonfirmasi.',
    constraints: 'sendirian, 3 minggu, lansianya cuma bisa balas satu tombol',
  },
  {
    idea: 'Manajemen acara komunitas. Pendaftaran peserta, tiket QR buat check-in, sertifikat terkirim otomatis setelah acara.',
    constraints: 'berdua, harus siap sebelum acara bulan depan',
  },
  {
    idea: 'Katalog UMKM satu kecamatan. Tiap usaha punya halaman produk, pembeli pesan lewat WhatsApp, admin desa kurasi mana yang tampil.',
    constraints: 'sendirian, budget nol, pelaku usahanya mengisi dari HP',
  },
  {
    idea: 'Pencatat usaha tani cabai. Catat biaya pupuk dan upah, hasil panen per petak, bandingkan untung antar musim.',
    constraints: 'sendirian, 2 bulan, sinyal di kebun sering hilang',
  },
  {
    idea: 'Aplikasi laundry kiloan. Timbang dan catat cucian, pelanggan bisa cek statusnya, notifikasi saat cucian siap diambil.',
    constraints: 'sendirian, 1 bulan, dipakai di satu outlet dulu',
  },
  {
    idea: 'Tryout UTBK online. Soal pilihan ganda berwaktu, pembahasan per soal, peringkat antar peserta setelah tryout ditutup.',
    constraints: 'tim 2 orang, 2 bulan, ribuan peserta di jam yang sama',
  },
  {
    idea: 'Sewa alat kemah. Katalog tenda dan carrier, cek ketersediaan per tanggal, denda otomatis kalau telat dikembalikan.',
    constraints: 'sendirian, 6 minggu, budget nol',
  },
  {
    idea: 'Pencatat tumbuh kembang anak buat posyandu. Kader input berat dan tinggi badan, grafik sesuai standar WHO, tanda kalau anak berisiko stunting.',
    constraints: 'tim 3 orang, 3 bulan, kadernya bukan orang IT',
  },
  {
    idea: 'Manajemen proyek kontraktor renovasi. Daftar pekerjaan per rumah, foto progres harian dari mandor, belanja material tercatat per proyek.',
    constraints: 'sendirian, 2 bulan, mandornya cuma pakai WhatsApp',
  },
  {
    idea: 'Galang dana kegiatan sekolah. Halaman kampanye per kegiatan, donasi lewat transfer, progres menuju target terlihat publik.',
    constraints: 'berdua, 1 bulan, tanpa payment gateway dulu',
  },
  {
    idea: 'Perpustakaan sekolah. Pinjam-kembali pakai kartu siswa, denda keterlambatan dihitung sendiri, daftar buku yang paling sering dipinjam.',
    constraints: 'sendirian, satu semester, komputer sekolahnya lawas',
  },
  {
    idea: 'Tracker lamaran kerja. Catat posisi yang dilamar dan tahap seleksinya, pengingat follow-up seminggu setelah interview.',
    constraints: 'sendirian, 2 minggu, budget nol',
  },
  {
    idea: 'Kas dan piket kelas. Jadwal piket berputar otomatis, bendahara catat iuran, semua siswa bisa lihat siapa yang belum bayar.',
    constraints: 'sendirian, 3 minggu, dipakai satu angkatan',
  },
  {
    idea: 'Tiket keluhan penghuni apartemen. Penghuni lapor kerusakan dengan foto, teknisi terima tugas, penghuni beri nilai setelah selesai.',
    constraints: 'tim 2 orang, 2 bulan, satu tower dulu',
  },
  {
    idea: 'Belajar kosakata bahasa Jepang. Kartu hafalan dengan pengulangan berjarak, audio pelafalan, target 10 kata sehari.',
    constraints: 'sendirian, 1 bulan, harus bisa dipakai offline',
  },
  {
    idea: 'Pencatat penjualan reseller skincare. Stok per produk, pesanan dari DM Instagram, untung bersih dihitung setelah ongkir.',
    constraints: 'sendirian, 3 minggu, budget nol',
  },
  {
    idea: 'Booking barbershop. Pilih barber dan jamnya, lihat antrean saat ini, riwayat potongan rambut sebelumnya tersimpan.',
    constraints: 'berdua, 6 minggu, tiga cabang',
  },
  {
    idea: 'Undangan pernikahan digital. Tamu isi RSVP, peta lokasi acara, pengantin lihat berapa tamu yang pasti datang.',
    constraints: 'sendirian, acaranya dua bulan lagi',
  },
  {
    idea: 'Aplikasi patungan. Foto struk, bagi per item yang dipesan masing-masing, ingetin teman yang belum transfer.',
    constraints: 'sendirian, 1 bulan, tanpa biaya server',
  },
  {
    idea: 'Dashboard toko di beberapa marketplace. Gabungkan pesanan dari tiga toko, stok terpusat, laporan produk terlaris per minggu.',
    constraints: 'tim 2 orang, 3 bulan, mulai dari satu marketplace dulu',
  },
  {
    idea: 'Rental mobil lepas kunci. Cek unit yang tersedia, unggah KTP dan SIM, foto kondisi mobil saat serah terima dan saat kembali.',
    constraints: 'berdua, 2 bulan, armadanya baru 8 mobil',
  },
  {
    idea: 'Rapor digital buat SD. Guru input nilai per mata pelajaran, rapor PDF jadi otomatis, orang tua lihat dari HP.',
    constraints: 'sendirian, satu semester, gurunya beda-beda kemampuan komputernya',
  },
  {
    idea: 'Adopsi kucing dari shelter. Profil tiap kucing, formulir pengajuan adopsi, shelter pantau kabar kucing setelah diadopsi.',
    constraints: 'relawan, budget nol, admin shelter-nya cuma satu orang',
  },
  {
    idea: 'Pencatat bensin kendaraan operasional. Sopir foto struk tiap isi bensin, admin lihat konsumsi per mobil, tanda kalau ada yang janggal.',
    constraints: 'sendirian, 6 minggu, 15 kendaraan',
  },
  {
    idea: 'Jadwal ronda RT. Giliran berputar per rumah, warga bisa tukar jadwal, laporan kejadian malam itu tercatat.',
    constraints: 'sendirian, akhir pekan saja, dipakai grup WhatsApp warga',
  },
  {
    idea: 'Kelas online pelatih kebugaran. Video latihan per program, murid kirim progres mingguan, pelatih balas dengan catatan.',
    constraints: 'berdua, 2 bulan, videonya sudah ada di Google Drive',
  },
  {
    idea: 'Sewa baju adat dan kostum. Katalog lengkap dengan ukuran, jadwal sewa per tanggal acara, uang jaminan tercatat per penyewa.',
    constraints: 'sendirian, 1 bulan, stoknya ratusan potong',
  },
  {
    idea: 'Buku utang warung. Catat bon pelanggan, total per orang, kirim pengingat lewat WhatsApp dengan bahasa yang sopan.',
    constraints: 'sendirian, 3 minggu, pemilik warung cuma pakai HP',
  },
  {
    idea: 'Distributor air galon. Pesanan dari pelanggan tetap, rute antar harian, galon kosong yang belum kembali tercatat per rumah.',
    constraints: 'berdua, 6 minggu, kurirnya 4 orang',
  },
  {
    idea: 'Pencari kos dekat kampus. Filter harga dan jarak jalan kaki, foto kamar asli, tanya pemilik langsung lewat chat.',
    constraints: 'tim 3 mahasiswa, satu semester, mulai dari satu kampus',
  },
];

/** A random example. Call on the server, per request, so it changes per visit. */
export function pickExampleIdea(): ExampleIdea {
  return EXAMPLE_IDEAS[Math.floor(Math.random() * EXAMPLE_IDEAS.length)];
}
