# Cara Memasang GrowTogether

GrowTogether adalah aplikasi web progresif (PWA). Satu aplikasi yang sama dipakai di HP maupun komputer, tidak perlu unduh dari Play Store/App Store.

> Penting: pemasangan PWA hanya bisa dari alamat **HTTPS** (mis. `https://growtogether.web.app`). Setelah aplikasi di-hosting, bagikan URL tersebut ke pasangan.

## Android (Chrome/Edge)

1. Buka URL aplikasi di Chrome.
2. Ketuk tombol **Pasang Aplikasi** di bagian atas, atau menu ⋮ → **Tambahkan ke layar utama / Instal aplikasi**.
3. Konfirmasi **Instal**. Ikon GrowTogether muncul di layar utama dan terbuka layar penuh tanpa address bar.

## iPhone/iPad (Safari)

1. Buka URL aplikasi di **Safari** (bukan browser lain).
2. Ketuk tombol **Bagikan** (kotak dengan panah ke atas).
3. Pilih **Tambah ke Layar Utama**, lalu **Tambah**.
4. Buka GrowTogether dari ikon di layar utama.

Tombol **Pasang di iOS** di aplikasi menampilkan panduan yang sama.

## PC/Laptop (Chrome/Edge/Brave)

1. Buka URL aplikasi.
2. Klik ikon **instal** di address bar, atau menu ⋮ → **Aplikasi** → **Instal situs ini**.
3. GrowTogether akan terbuka di jendela sendiri dan tersedia di Start Menu / Applications.

Firefox dan Safari desktop belum mendukung pemasangan PWA; aplikasi tetap bisa dipakai lewat tab biasa.

## Setelah terpasang

- Data tersimpan di perangkat (mode demo) atau tersinkron lewat akun Google (mode pasangan).
- Untuk sinkronisasi berdua: masuk dengan Google → **Pengaturan → Hubungkan Pasangan** → bagikan kode undangan ke pasangan → pasangan memasukkan kode tersebut.
- Aplikasi tetap bisa dibuka saat offline untuk data yang sudah pernah dimuat; perubahan disinkronkan saat kembali online.
- Pembaruan aplikasi berjalan otomatis saat ada versi baru dan koneksi internet.

## Untuk pengguna PC yang ingin menjalankan tanpa hosting

Hanya untuk pengujian/administrator, bukan untuk pengguna akhir:

```bash
npm install
npm run build
npm run preview
```

Buka `http://localhost:4173`. Login Google dari `localhost` biasanya sudah diizinkan Firebase, tetapi PWA tidak bisa dipasang dari `http://` selain `localhost`.

## Build yang disertakan

Arsip `GrowTogether-1.0.0-web.zip` berisi hasil build statis (`dist/`) dan panduan ini. Ekstrak lalu unggah isi foldernya ke hosting HTTPS apa pun (Firebase Hosting, Netlify, Vercel, Nginx), atau ikuti `README.md` untuk deploy ke Firebase Hosting dengan `npm run deploy:hosting`.
