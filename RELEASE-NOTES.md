# GrowTogether v1.2.3 — Tombol tidak lagi menunggu server, dan setiap aksi minta izin dulu

v1.2.2 sudah membuat dua HP memakai angka yang sama. Versi ini membereskan hal
yang paling sering bikin pengguna panik: aplikasi kelihatan **macet** atau **diam
saja**. Dua kebiasaan lama jadi penyebabnya — form menunggu akui server sebelum
boleh ditutup, dan beberapa aksi memakai kotak konfirmasi bawaan browser yang
tidak bisa ditema, tidak berbahasa Indonesia, dan kadang hilang begitu saja.

## Yang berubah

- **Menekan "Simpan habit" tidak mengunci layar lagi.** Selama ini habit sudah
  muncul di daftar (karena aplikasinya optimistik), tapi dialognya menahan diri
  sampai server menjawab. Di koneksi lambat itu berarti belasan detik, dan habit
  kedua yang dibuat di dalamnya ikut hilang. Sekarang tulisan ke server berjalan
  di latar belakang: dialog menutup seketika, dan kalau server benar-benar menolak,
  baris sinkronisasi yang memberitahu — bukan tombol yang membeku.
- **Semua aksi destruktif minta izin lewat dialog aplikasi.** Menghapus habit,
  menolak/menghapus kesepakatan, memicu sanksi, memakai kartu maaf, keluar dari
  pasangan, menghapus akun, dan membersihkan salinan lokal kini memunculkan
  dialog dengan judul, alasan, dan tombol yang jelas. Tidak ada lagi `confirm`
  bawaan browser.
- **Satu ketukan = satu tulisan.** Setiap form punya penanda sedang menyimpan,
  jadi ketukan ganda (yang dulu bikin dua habit kembar, check-in dobel +25 XP,
  atau saldo XP terpakai dua kali) tidak lagi menghasilkan duplikat.
- **Catatan sesi fokus kalian kini bisa dibaca pasangan.** Di Pasangan → Ritual
  Berdua ada kartu baru "Catatan Sesi Fokus Berdua": judul sesi, durasi, dan apa
  yang kalian pelajari. Sesi dari habit privat tetap tidak pernah muncul di sana.
- **Sesi pendek diberi tahu dengan kalimat yang benar.** Fokus 40 detik yang tidak
  dihitung sebelumnya dilaporkan sebagai "sesi belum dimulai" padahal timer sudah
  jalan. Sekarang pesannya menyebut durasi sebenarnya dan ambang 1 menit, dan
  suara latar ikut dimatikan.
- **Kegagalan yang tadinya diam sekarang kelihatan.** Hasil tes notifikasi,
  notifikasi yang gagal terkirim, dan kegagalan "bersihkan salinan lokal" (yang
  membuat halaman muat ulang) kini sampai ke bar status, bukan hanya ke konsol.
- **Kartu maaf ikut kalender.** Jatah 2 kartu per bulan terisi ulang saat bulan
  berganti tanpa perlu tulisan tambahan, dan usulan tantangan pengganti yang
  kosong ditolak dengan penjelasan, bukan ditelan diam-diam.
- **Form lebih ramah pembaca layar.** Label untuk setiap isian, penanda "wajib
  diisi", `aria-pressed` pada pilihan yang aktif, tombol ikon bernama, dan target
  sentuh minimal 44 px.

## Cara menguji sendiri

1. Buat dua akun di dua perangkat (HP + browser PC), masuk dengan kode ruang.
2. Centang sebuah habit sambil membuka mode pesawat selama 2 detik — habit tetap
   tercentang di HP-mu, dan saat koneksi kembali, HP pasangan ikut berubah.
3. Ketuk "Simpan habit" dua kali cepat — hanya satu habit yang terbentuk.
4. Buka Pasangan → Ritual Berdua setelah salah satu menuntaskan timer fokus —
   catatan sesinya terbaca di kedua perangkat.

## Dibuktikan, bukan diasumsikan

Seluruh rilis ini diverifikasi pada dua instance Chrome nyata dengan dua sesi
Firebase anonim yang berbeda, bicara ke satu server Firestore yang sama:

- Uji dua perangkat (12 fase: masuk & kode ruang, habit & privasi, XP & streak &
  reaksi, timer fokus, buku/jurnal/check-in, kesepakatan & sanksi lintas
  perangkat, grace day & hadiah, taman & toko dekorasi, pengaturan, tautan dalam
  & muat ulang & luring, keluar-lalu-gabung-lagi): **92 PASS / 0 FAIL**.
- Uji aturan Firestore per dokumen (privasi habit, slot ruang, kode undangan,
  tanpa login, orang asing): **60 PASS / 0 FAIL**.
- `tsc --noEmit`, `eslint`, dan `vite build` bersih.
