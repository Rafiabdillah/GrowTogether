# GrowTogether v1.2.6 — kabar pasangan sekarang benar-benar bisa membangunkan HP yang tertutup, tanpa server dan tanpa bayar

Permintaan yang menggerakkan dua versi terakhir: notifikasi harus tetap muncul walaupun
aplikasinya sudah ditutup. Jalur Web Push resmi masih ada dan tetap siap deploy, tapi
ia menuntut Cloud Functions — dan Cloud Functions menuntut plan Blaze, artinya kartu
kredit. Versi ini menambahkan jalur yang **benar-benar gratis**: kabar dititip ke satu
bot Telegram milik kalian berdua, dikirim langsung dari browser pengirim. Tidak ada
server GrowTogether di tengah, tidak ada yang perlu di-upgrade, dan tidak ada isi
privat yang ikut keluar.

## Yang berubah

- **Relay Telegram sisi pengirim** (`src/lib/telegramRelay.ts`). Bot dibuat sekali lewat
  `@BotFather`, token-nya ditempel di kedua HP dan **hanya hidup di localStorage
  perangkat itu** — tidak pernah ikut tersinkron. `sendMessage` dipanggil sebagai POST
  `application/x-www-form-urlencoded` supaya tidak memicu preflight CORS (Telegram
  menjawab 501 untuk itu).
- **Alamat chat per anggota** (`src/lib/telegramBindings.ts` + koleksi
  `telegramBindings/{uid}`). Tiap perangkat mengumumkan alamat chat-nya sendiri;
  pengirim cukup membaca dokumen pasangan untuk tahu ke mana kabar boleh dititip.
  Aturan Firestore melarang `list` di koleksi ini, jadi menebak-nebak chat id orang
  lain tetap gagal, dan pasangan satu ruang boleh membaca ikatan kalian (`allow get`).
- **HP yang sedang digenggam tidak digetarkan.** Perangkat menandai kehadirannya setiap
  60 detik selama halaman terlihat; kalau pasangan tampak aktif dalam 90 detik
  terakhir, kabar berhenti di notifikasi in-app saja.
- **Kabar beruntun dilebur jadi satu pesan.** Jendela 4 detik, jeda 45 detik, maksimal
  ditahan 3 menit — jadi tiga habit sekaligus tidak mengubah chat kalian jadi spam.
- **Yang keluar dari ponsel hanya kalimat baku.** `Rafi mengirim pelukan untukmu. Buka
  GrowTogether untuk melihatnya.` Judul habit, isi jurnal, dan catatan check-in tidak
  pernah ikut; tes dua perangkat membuktikan teks privat tidak ada di payload.
- **Kartu "Bangunkan HP pasangan lewat Telegram" di Pengaturan → Notifikasi** yang
  melaporkan keadaan sebenarnya: pasangan belum memasang, sudah memasang tapi
  mematikan sakelarnya sendiri, server menolak membaca ikatannya, atau siap dibangunkan
  lengkap dengan kapan terakhir ia aktif. Token tidak pernah ditampilkan utuh dan bisa
  ditutup/lepas lagi.
- **Perbaikan akar: aplikasi bisa "salah ingat" siapa pasangannya.** Saat muat ulang,
  ruang belum tentu sudah terisi, dan `couple.id` sementara masih berisi data bawaan.
  Dulu pasangan diambil dari data itu, jadi kabar bisa diam-diam tidak pernah berangkat
  (atau menunjuk uid yang bukan pasangan di ruang ini). Sekarang identitas pasangan
  hanya dipercaya kalau dokumen ruang yang sama sudah benar-benar terbaca, dan sekali
  diketahui ia tidak terlupa selama muat ulang berlangsung.
- **Status pasangan di kartu sekarang hidup, bukan potret sesaat.** Dulu ikatan pasangan
  dibaca sekali waktu halaman dibuka, jadi kartu bisa bilang "belum memasang Telegram"
  berlama-lama padahal pasangan baru saja memasangnya. Sekarang dibaca lewat dua jalur
  sekaligus: satu pembacaan langsung ke server begitu kartu dibuka (langsung jujur, tanpa
  menunggu) ditambah langganan realtime yang mengoreksi kartu detik itu juga saat
  pasangan memasang, melepas, atau mematikan sakelarnya. Baris dari cache lokal dibuang —
  alamat chat yang basi bisa mengirim pelukan ke HP yang salah.
- **Semua kegagalan dibaca dari sumbernya, bukan ditebak.** Galat baca ikatan pasangan
  tidak lagi menyamar sebagai "belum memasang Telegram": ditolak aturan, dokumen belum
  ada, bentuk tidak lengkap, dan koneksi putus kini punya kalimat masing-masing di
  kartu. Bot yang menjawab `ok: false` tercatat sebagai ditolak, jaringan mati tercatat
  sebagai tidak ada jawaban — tidak pernah sebagai terkirim.

## Dibuktikan, bukan diklaim

- `npm run test:rules` — aturan asli Firestore diuji per-dokumen lewat
  rules-unit-testing, termasuk 12 uji ikatan Telegram: menerbitkan atas nama pasangan
  ditolak, chat id bukan angka ditolak, ikatan menunjuk ruang asing ditolak, `list`
  tidak tersedia, dan pasangan satu ruang boleh membaca.
- `npm run test:relay` — modul relay dijalankan di proses Node dengan bot tiruan:
  bentuk form, penggabungan burst, cooldown, privasi kalimat, pemetaan galat, dan
  `discoverChat` yang jujur saat belum ada yang menekan `/start`.
- `npm run test:devices` — dua Chrome nyata, dua perangkat terpisah, terhadap emulator:
  kedua HP mengikat chat lewat UI, satu HP benar-benar ditutup (`about:blank`), jam
  kehadirannya dimundurkan, lalu satu tekan 🤗 menghasilkan **tepat satu** `sendMessage`
  ke chat pasangan dan **nol** ke chat pengirim; dengan pasangan aktif kembali,
  hasilnya **nol** pesan; pasangan yang mematikan sakelarnya terbaca apa adanya di kartu
  pengirim.

## Memakai jalur ini (sekitar dua menit)

1. Telegram → `@BotFather` → `/newbot` → salin token.
2. Di **kedua** HP: Pengaturan → Notifikasi → tempel token yang sama → *Simpan token*.
3. Di masing-masing HP, kirim `/start` ke bot itu, lalu tekan *Deteksi chat saya*.
4. Tekan *Kirim pesan tes* untuk memastikan jalurnya hidup.

Jalur Web Push (Blaze) tetap tersedia dan tidak berubah: kalau nanti dinyalakan, kedua
kanal bisa hidup bersamaan dan aturan Firestore-nya sudah sama-sama terbukti.
