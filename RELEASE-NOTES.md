# GrowTogether v1.2.5 — alamat push perangkat sudah dipasang di aplikasi; pengirimnya tinggal dinyalakan

Permintaannya: kabar pasangan harus tetap bangun di HP padahal aplikasinya ditutup.
Jalan satu-satunya yang jujur untuk itu adalah Web Push resmi — browser mendaftarkan
alamat perangkat ke layanan push, server menyimpan alamat itu, dan pengirimnya harus
berjalan di luar browser. Versi ini memasang separuh pertama dengan lengkap: aplikasi
sekarang benar-benar bisa berlangganan, menyimpan alamatnya, memperbaruinya saat
berputar, dan menghapusnya lagi. Separuh kedua (pengirim di Cloud Functions) sudah
ditulis dan siap deploy, tapi tertahan satu hal yang bukan kode: proyek Firebase masih
di plan Spark, dan Secret Manager — tempat kunci VAPID privat disimpan — hanya bisa
dinyalakan setelah upgrade Blaze.

## Yang berubah

- **Langganan push nyata di aplikasi.** Service worker menangani `push` dan
  `pushmessage` (termasuk `gt:push-renew` saat layanan push memutar alamat
  perangkat), alamat beserta `p224` auth dan `p256` applicationServerKey disimpan ke
  koleksi `pushSubscriptions` atas nama uid perangkat, dan preferensi per jenis kabar
  ikut terkirim supaya "jangan bangunkan aku untuk jurnal" juga berlaku saat aplikasi
  tertutup.
- **Aturan Firestore khusus kotak alamatnya.** `pushSubscriptions` hanya bisa dibaca,
  ditulis, dan dihapus oleh pemilik uid-nya; `endpoint` wajib benar-benar HTTPS, dan
  pemindaian kepemilikan memakai pola id yang sama seperti dokumen lain.
- **Kartu "Kanal push perangkat ini" yang tidak berpura-pura.** Pengaturan → Notifikasi
  melaporkan salah satu dari: belum ada kunci VAPID di build (server push belum
  dinyalakan), browser tidak menyediakan `PushManager`, izin belum diberikan, alamat
  terdaftar, atau percobaan gagal dengan alasannya. Tidak ada lagi keadaan yang tampak
  siap padahal tidak.
- **Catatan jujur di layar Pasangan** selama alamat push belum terdaftar: kabar tetap
  masuk selama aplikasi pasangan terbuka di latar, dan tidak hilang saat tertutup —
  antreannya menahan sampai aplikasi dibuka lagi.
- **README: blok "Notifikasi push (aplikasi benar-benar tertutup)"** berisi urutan nyata:
  upgrade Blaze, buat pasangan kunci VAPID, simpan publiknya di `VITE_VAPID_PUBLIC_KEY`
  (build) + ketiganya di Secret Manager (server), `deploy --only functions`, dan cara
  membuktikannya tanpa menyentuh produksi lewat `npm run test:push`. Nilai privat tidak
  pernah masuk repo; `functions/.env` dan `functions/.secret.local` sudah tertutup
  `.gitignore`.

## Yang sengaja belum aktif

Pengirim push (Cloud Functions + VAPID) belum berjalan di produksi, jadi hari ini HP
yang benar-benar tertutup masih belum bisa dibangunkan. Rantai kendalanya:

```
plan Spark → secretmanager.googleapis.com tidak bisa dinyalakan
           → VAPID_PRIVATE_KEY tidak bisa disimpan
           → functions tidak bisa deploy
           → tidak ada alamat yang dibangunkan
```

Begitu proyek naik ke Blaze, sisanya satu tarikan: tulis tiga secret
(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`), `deploy --only functions`,
lalu build ulang dengan `VITE_VAPID_PUBLIC_KEY`. Semua bagiannya sudah disiapkan dan
sudah teruji terhadap emulator.

## Verifikasi

- Harness dua perangkat nyata (emulator Firestore + dua Chrome dengan profil terpisah):
  **111 PASS / 0 FAIL**, 13 fase, termasuk dua cek yang sebelumnya salah ukur — beli
  dekorasi 200 XP → 700 XP di perangkat lain (database: `levelXp 700`,
  `unlockedDecorations ["lanterns"]`, layar "Dekorasi terpasang di pulau kalian!") dan
  cuaca Gerimis (mendarat di server dalam 3,8 detik, tombol yang menyala ikut berubah
  di kedua layar).
- Suite aturan produksi (`npm run test:rules`): **74 PASS / 0 FAIL**, empat probe baru
  menutup tulisan yang selama ini tidak teruji: baris `logs` dari `toggleHabit`, dan
  `reactions/seenAt` oleh penerima, oleh pengirim, serta ditolak untuk orang luar.
- Suite jalur push (`npm run test:push`): **28 PASS / 0 FAIL**, termasuk kontrak fungsi
  `subscribePush` dan granularitas 255 byte.
- `npm run lint` bersih. Log konsol kedua perangkat di akhir run: kosong (tanpa error
  maupun warning), dan tidak ada `window.confirm` yang tersisa.

## Perbaikan pada alat ukurnya, bukan aplikasinya

Dua FAIL terakhir ternyata cacat pengukuran, dan memperbaikinya sekaligus membuat
alasan kegagalan berikutnya bisa dibaca:

- **Jangan baca sekali untuk tulisan latar belakang.** Sekarang isi database dibaca
  lewat REST emulator dan di-poll sampai mendarat, plus jejak "Log aktivitas sinkron"
  perangkat sebagai saksi kenapa kalau tidak sampai — bedanya "server menolak" dan
  "masih dalam perjalanan" jadi terlihat.
- **Saksi teks yang menyesatkan dibuang.** "Gerimis ada di layar B" selalu benar karena
  deretan tombol cuaca memang berisi kata itu; yang dibaca sekarang tombol mana yang
  sedang menyala.
- **Chrome headless.desktop menghukum tab latar** dengan menunda timer Firestore, jadi
  tiga bendera anti-throttling dipasang; kasus "ponsel di kantong" tetap diuji lewat
  `visibilityState` paksa dan notifikasi sistem nyata.
- **Keheningan tidak boleh lagi berarti menunggu.** Koneksi CDP kini punya batas waktu
  per perintah dan menolak semua penunggu saat socket putus, jadi harness yang macet
  melapor sebagai FAIL alih-alih diam berjam-jam.
