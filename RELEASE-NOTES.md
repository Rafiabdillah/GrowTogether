# GrowTogether v1.2.0 — Notifikasi: pengingat harian dan kabar pasangan

Sebelum versi ini, pasangan harus membuka aplikasi duluan supaya tahu kabar baru.
Sekarang aplikasi yang menyampaikan: pelukan, kesepakatan yang menunggu jawaban,
cerita jurnal, kabar check-in, dan pengingat habit/check-in pada jam yang kamu pilih.

## Yang dibuat

- **Service worker sendiri** (`src/sw.ts`). Sebelumnya memakai `generateSW` yang
  tidak bisa dipasangi listener, sedang notifikasi butuh `notificationclick`,
  `push`, dan `periodicsync`. Build pindah ke `injectManifest`; isi cache offline
  tetap sama (27 file, fallback `index.html`, font disimpan setahun).
- **Enam jenis notifikasi** yang bisa dinyalakan/matiakan satu-satu di
  Pengaturan → Notifikasi, plus dua jam pengingat (check-in malam, habit yang belum
  selesai). Preferensi tersimpan di perangkat, jadi pasangan tidak diganggu sama.
- **Izin diminta otomatis** tepat setelah perangkat masuk ke ruang bersama, dan
  hanya sekali per perangkat. Di layar masuk atau mode demo tidak ada tanya-tanya.
- **Bentuk pesannya diperhatikan**: bahasa `id`, ikon aplikasi, badge monokrom
  (Chrome menampilkan badge sebagai siluet, jadi ikon berwarna jadi blok penuh),
  getar tiga ketuk untuk kabar penting, senyap untuk jurnal/check-in, dan
  `tag` supaya pengingat yang sama tidak menumpuk.
- **Tautan dalam**: menyentuh notifikasi membuka tab yang relevan (Hari Ini, Sanksi,
  Kita, atau Progres). Kalau aplikasinya sudah terbuka, tab-nya saja yang pindah,
  tidak dimuat ulang. Tombol **Balas pelukan** pada notifikasi langsung mengirim
  reaksi balik tanpa membuka aplikasi.
- Pengingat bisa jalan **walau aplikasi tertutup** lewat `TimestampTrigger`
  (Chrome). Browser tanpa dukungan itu tetap dapat pengingat selama aplikasi
  terbuka — diuji dan fallback-nya dipakai, bukan gagal diam-diam.

## Dua hal yang cuma kelihatan setelah diuji di browser asli

1. **Notifikasi senyap sebelumnya hilang tanpa pesan.** Aturan browser:
   `silent: true` tidak boleh dipakai bersama `vibrate`. Payload kita selalu
   menyertakan pola getar, jadi notifikasi jurnal dan kabar check-in **ditolak
   browser** dan errornya tertelan. Sekarang `vibrate` dilepas saat senyap, dan
   kegagalan pengiriman ditulis ke konsol.
2. **`client.focus()` bisa ditolak browser** (Windows headless menolaknya; di
   Android juga terjadi). Dulu penolakan itu membuat seluruh proses klik gagal.
   Sekarang menaikkan jendela dianggap hiasan: tab tetap berpindah walau focus
   ditolak.

## Bukti jalan (bukan hanya "kode sudah ditulis")

Dua rangkaian uji pada Chrome asli, semuanya hijau:

- Uji lokal (18 pemeriksaan): worker terdaftar, izin, tab Notifikasi muncul,
  saklar per jenis tersimpan, payload lengkap (`icon`, `badge`, `lang`,
  `timestamp`, `actions`), pembatalan pengingat, klik notifikasi membuka tab
  `couple`, dan notifikasi tertutup setelah diklik.
- Uji dua identitas pada emulator Firestore lokal: perangkat masuk anonim → masuk
  ruang → tab-nya disengaja di latar belakang (app memang diam saat sedang dibuka) →
  pasangan mengirim. Yang terbukti sampai di bar notifikasi:
  `Rama mengirim semangat` (dengan tombol balas), `Kesepakatan menunggu
  persetujuanmu` (`requireInteraction`, membuka tab Sanksi), `Cerita baru dari Rama`
  (senyap), `Rama sudah check-in` (senyap). Aksi **Balas pelukan** terbukti menulis
  reaksi balasan ke server: `❤️ / Balik peluk!` dari perangkat penerima.
- `npm run lint` (tsconfig aplikasi + tsconfig worker) bersih.

Catatan jujur: emulator memakai aturan longgar khusus untuk uji ini; aturan privasi
ruang tetap diuji terpisah terhadap `firestore.rules` asli (52 pemeriksaan v1.1.2).

## Fase 2 belum jalan

Notifikasi di versi ini dikirim dari perangkat itu sendiri. Supaya kabar pasangan
masuk walau HP-nya tidak sedang membuka aplikasi, perlu Cloud Functions + Web Push,
dan itu butuh proyek Firebase di-ubah ke paket **Blaze** (ada batas gratis bulanan,
tapi tagihan nol selama di dalam kuota). Project `growtogether-rafiabdillah` masih
di paket Spark, jadi kode `push` di worker sudah siap dan tinggal dipasang nanti.

## Yang perlu kamu lakukan

1. Tutup aplikasi di kedua HP, buka lagi supaya versi baru terpasang. Kalau lewat
   aplikasi yang dipasang, hapus data situs GrowTogether di setelan browser lebih dulu.
2. Buka Pengaturan → **Notifikasi** → pastikan statusnya "Izin sudah diberikan".
   Kalau pernah menolak, izinkan lewat Setelan situs Chrome.
3. Pasang sebagai aplikasi (Menu ⋮ → **Pasang aplikasi**) supaya pengingat tetap
   jalan saat aplikasi tertutup.
4. Kirim satu pelukan dari satu HP dan lihat bar notifikasi di HP lainnya.
