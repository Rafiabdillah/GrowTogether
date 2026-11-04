# GrowTogether v1.2.2 — Kedua HP benar-benar memakai angka yang sama

Versi ini menutup tiga relasi yang di v1.2.1 masih bisa membuat dua HP berbeda
jawaban untuk ruang yang sama: satu HP bisa diam-diam memakai build lama, streak
bisa beda angka setelah lewat tengah malam, dan saldo XP bisa tampil negatif yang
akhirnya memberi dekorasi gratis.

## Yang dibuat

- **HP yang memakai build lama sekarang diberitahu.** Service worker menyiarkan
  nomornya tiap kali mengambil alih, dan halaman yang masih menjalankan build lama
  memunculkan baris: **Versi baru v… sudah terpasang — halaman ini masih berjalan
  pada v…** dengan tombol **Muat ulang** dan tombol tunda. Baris ini hanya muncul
  kalau build baru benar-benar sudah terpasang, bukan dugaan.
- **Streak ikut hari nyata, bukan hari saat aplikasi dibuka.** Sebelumnya HP yang
  dibiarkan terbuka dari kemarin sampai hari berikutnya tetap menghitung streak
  dari kemarin, sementara HP pasangan menghitung dari hari baru — dua angka untuk
  ruang yang sama. Sekarang angkanya dijangkar ke hari nyata, dan penyimulasi
  "maju 1 hari" di mode demo tetap bertingkah seperti hari yang benar-benar lewat.
- **XP tidak bisa negatif lagi, di tampilan maupun di server.** XP dipakai ganda
  sebagai poin level dan sebagai uang toko, jadi satu pembatalan habit dari saldo
  nol menghasilkan angka minus yang membuat semua dekorasi tampak bisa dibuka.
  Tampilan menjepitnya ke 0, dan aturan Firestore menolak penulisan saldo di bawah
  0 serta menolak daftar dekorasi diubah menjadi bukan-daftar. Aturan ini sudah
  dipublikasikan ke proyek `growtogether-rafiabdillah`.
- **Harness uji runtime ikut ke dalam repo**: `scripts/shop-live.cjs`
  (`npm run test:runtime`). Jalur emulator/Chrome dibaca dari environment
  variable (`GT_JDK`, `GT_CLI`, `GT_SYNCTEST`, `GT_CHROME`) dan nomor versi yang
  dibaca dari `package.json`, jadi ujiannya tidak perlu diedit lagi tiap rilis.
  Ekspresi yang disuntik ke browser dikompilasi lebih dulu supaya salah ketik
  kelihatan saat itu juga, bukan setelah bermenit-menit menjalankan emulator.

## Bukti jalan (43 pemeriksaan hijau, 0 gagal)

Dua rangkaian pada Chrome asli dan emulator Firestore dengan aturan **asli**:

- Fase aturan (20 pemeriksaan): belanja lewat transaksi oleh kedua anggota, orang
  asing ditolak baca dan tulis, `increment(+10)` dan transaksi memakai saldo yang
  sama, lalu tiga penulisan yang harus gagal: saldo `-50`, `increment(-600)` dari
  saldo 560, dan `unlockedDecorations` jadi teks. Ketiganya `permission-denied`
  dan dokumennya terbukti tidak berubah; `+10`, saldo 0, dan cuaca tetap lolos.
- Fase aplikasi (23 pemeriksaan): masuk kode ruang → streak 8 hari hanya dari log
  bersama; belanja dua dekorasi, 900 → 550 XP, kedua dekorasi tergambar di taman;
  dengan 100 XP tidak ada item yang bisa dibuka. Lalu tiga relasi baru:
  - saldo `-50` yang dipaksa di server terbaca **Toko Dekorasi (0 XP)** dan tanda
    minus tidak muncul di layar;
  - halaman yang jamnya didorong lewat tengah malam berubah **8 hari → 9 hari**
  - setelah build kedua dengan nomor lebih tinggi dipasang, baris **Versi baru
    v9.9.9 … masih berjalan pada v1.2.2** muncul, dan **Muat ulang** dari baris itu
    benar-benar pindah ke build baru (penanda versi berubah jadi v9.9.9 dan
    barisnya hilang).
- `npm run lint` bersih (tsconfig aplikasi + tsconfig worker).

## Yang diketahui belum rapi

- XP masih punya dua peran sekaligus (poin level dan uang toko). Aman sekarang,
  tapi suatu saat sebaiknya dipisah.
- Kartu joker bulanan, tujuan mingguan, dan pemicu sanksi masih hanya bisa dibaca
  dari angka mentah — belum ada ringkasannya di layar.
- Notifikasi nyata antar-perangkat saat aplikasi tertutup (Fase 2) masih menunggu
  proyek Firebase dipindah ke paket Blaze; yang sekarang jalan pengingat lokal.

## Yang perlu kamu lakukan

1. Buka aplikasi di kedua HP, tutup total, lalu buka lagi supaya build baru
   terpasang. Kalau salah satu HP masih terbuka, baris **Versi baru** akan muncul
   di HP itu — tekan **Muat ulang**.
2. Buka Pengaturan → **Sinkronisasi** dan pastikan keduanya menulis
   **Versi aplikasi: v1.2.2**.
3. Kalau kemarin kamu membatalkan habit sampai toko menampilkan angka minus,
   hari ini tokonya akan menampilkan (0 XP) — itu normal, bukan bug baru.

Berkas: `GrowTogether-1.2.2-web.zip` dan `SHA256SUMS-v1.2.2.txt`
