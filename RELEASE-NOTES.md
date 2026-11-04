# GrowTogether v1.2.4 — Kabar pasangan benar-benar sampai, dan memeluk jadi bikin ketagihan

Keluhannya sederhana dan benar: notifikasi tidak pernah muncul di HP, padahal
pasangan seharusnya tahu kapan kamu mengirim semangat. Ternyata penyebabnya bukan
jaringan dan bukan Firebase — dialog izin notifikasi pernah diminta oleh halaman
sebelum ada sentuhan nyata. Chrome Android menjawab `denied` untuk permintaan
seperti itu, dan penolakan itu permanen sampai pengguna sendiri mengubahnya di
setelan browser. Sekali terbakar, tidak ada notifikasi yang pernah muncul lagi.

## Yang berubah

- **Izin notifikasi hanya diminta lewat sentuhan nyata.** Ada gerbang khusus di
  layar Pasangan dan tombol "Aktifkan notifikasi" di Pengaturan → Notifikasi untuk
  setiap state izin: belum pernah ditanya, pernah ditolak (dengan petunjuk letak
  setelan di Chrome Android dan iPhone), atau tidak didukung browser.
- **Berhenti berpura-pura.** Dulu aplikasi mengklaim pengingat harian tetap jalan
  saat HP tertutup. API yang menopang klaim itu (Notification Triggers) sudah
  dihentikan Chrome, jadi sekarang kartu "Saluran notifikasi perangkat ini"
  melaporkan keadaan sebenarnya per perangkat, termasuk baris jujur
  "Kabar saat HP pasangan tertutup → belum — perlu pengirim push dari server".
- **Tidak ada kabar yang hilang lagi.** Setiap pelukan mencatat `seenAt` oleh
  penerimanya, sehingga pengirim melihat "Dibuka pasanganmu", dan kabar yang tiba
  saat HP pasangannya tertutup tetap menunggu di antrean: titik merah di tab
  "Kita", angka di ikon aplikasi (badge peluncur), lalu langsung disambut begitu
  aplikasi dibuka lagi.
- **Menerima kabar sekarang terasa seperti acara.** Layar penuh hujan hati, getar,
  suara, nama pasangan, pesannya, dan satu tombol "Balas sekarang" yang membalas
  dalam satu ketukan — bukan toast tiga detik yang mudah dilewat.
- **Mengirim kabar terasa seperti melepas sesuatu.** Ledakan hati naik dari tombol
  dengan status "Terkirim · menunggu pasangan membuka" yang berubah hijau menjadi
  "Dibuka pasanganmu" begitu pasangan membukanya.
- **Empat chip sekali tekan** di layar Pasangan: 💪 Semangat, 🥺 Kangen, 🎉 Yeay,
  🤗 Peluk — plus hitungan "N hari ini" dan rantai hari dua arah, supaya mengirim
  lagi terasa wajar, bukan usaha.
- Komponen `ReactionToast` dihapus; perayaannya menggantikannya.

## Cara menguji sendiri

1. Buka aplikasinya di dua HP, masuk dengan kode ruang yang sama.
2. Di HP pertama: buka **Pasangan**, tekan **Aktifkan notifikasi**, pilih Izinkan
   pada dialog Chrome. Ulangi di HP kedua.
3. Tekan chip **💪 Semangat** di HP pertama → hati naik + status "Terkirim".
4. Di HP kedua (aplikasi sedang di latar) → notifikasi sistem muncul; begitu
   dibuka, hujan hati + tombol "Balas sekarang".
5. Kembali ke HP pertama → status berubah jadi "Dibuka pasanganmu", dan di layar
   Pasangan tertulis "Pelukan terakhirmu sudah dibuka pasangan."
6. Tutup aplikasi di HP kedua sepenuhnya, kirim **🤗 Peluk** dari HP pertama, lalu
   buka lagi: pelukan yang tertinggal tetap disambut.
7. Pengaturan → Notifikasi → "Jejak pengiriman terakhir" mencatat apakah tiap
   kabar benar-benar tampil atau tidak.

## Dibuktikan, bukan diasumsikan

Harness dua perangkat nyata di repo (`scripts/qa-two-devices.cjs`): dua Chrome
dengan profil terpisah, satu emulator Firestore, 13 fase, **109 PASS / 0 FAIL**.
Yang dibuktikan untuk versi ini antara lain: ledakan di layar pengirim; perayaan
layar penuh di perangkat penerima saat tab-nya benar-benar di latar; `seenAt`
tercatat di dokumen server; chip pengirim berubah menjadi "Dibuka pasanganmu";
notifikasi sistem sungguhan ada di antrean registration perangkat penerima;
balasan satu ketukan sampai kembali ke pengirim; dan pelukan yang dikirim ketika
aplikasi pasangan ditutup (halamannya benar-benar dibuang) tetap tampil begitu
aplikasi dibuka lagi. `scripts/qa-rules.cjs` tetap **60 PASS / 0 FAIL**, termasuk
aturan yang mengizinkan penerima menulis tanda baca di dokumen reaksi pasangannya.

## Yang masih belum bisa (dan tidak akan diklaim)

Membangunkan HP pasangan yang aplikasinya benar-benar ditutup membutuhkan pengirim
push dari server (Cloud Functions / Web Push). Proyek Firebase ini memakai paket
Spark tanpa server, jadi jalur itu tidak ada — aplikasi sekarang mengatakannya
terbuka-terangan di layar, bukan menjanjikan notifikasi yang tidak pernah datang.
