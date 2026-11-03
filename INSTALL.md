# Cara Memasang GrowTogether

GrowTogether adalah aplikasi web progresif (PWA). Satu aplikasi yang sama dipakai di HP maupun komputer, tidak perlu unduh dari Play Store/App Store.

**URL resmi:** https://rafiabdillah.github.io/GrowTogether/

> Pemasangan PWA hanya bisa dari alamat **HTTPS**. Jika kamu meng-hosting sendiri, ganti URL di atas dengan alamat HTTPS milikmu.

> **Masuk tanpa akun:** GrowTogether tidak lagi memakai login Google. Setiap pemasangan mendapat sesi anonim dari Firebase, dan ruang bersama dibuka dengan **kode ruang**. Supaya sesi anonim bisa dibuat, aktifkan **Authentication → Sign-in method → Anonymous** pada project Firebase (`growtogether-rafiabdillah`). Tanpa langkah ini aplikasi menampilkan kartu "Sesi perangkat gagal dibuka"; Mode demo tetap bisa dipakai.

## Android (Chrome/Edge)

1. Buka URL aplikasi di Chrome.
2. Ketuk tombol **Pasang Aplikasi** di bagian atas, atau menu ⋮ → **Tambahkan ke layar utama / Instal aplikasi**.
3. Konfirmasi **Instal**. Ikon GrowTogether muncul di layar utama dan terbuka layar penuh tanpa address bar.

Panduan yang sama juga tersedia di dalam aplikasi: **Pengaturan → Instal Aplikasi**.

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

- Data tersimpan di perangkat (mode demo) atau tersinkron lewat kode ruang (mode pasangan).
- Untuk sinkronisasi berdua: isi **nama kamu** di layar "Masuk dengan Kode Ruang" → tekan **Buat Ruang Baru** → bagikan kodenya ke pasangan → pasangan memasukkan kode itu di kolom "Kode ruang pasangan".
- **Simpan kode ruangmu.** Tanpa akun, kode itu satu-satunya jalan masuk ke ruang yang sama, dan data ruang terikat ke ID perangkat (bisa dilihat di layar yang sama).
- Aplikasi tetap bisa dibuka saat offline untuk data yang sudah pernah dimuat; perubahan disinkronkan saat kembali online.
- Pembaruan aplikasi berjalan otomatis saat ada versi baru dan koneksi internet.

## Untuk pengguna PC yang ingin menjalankan tanpa hosting

Hanya untuk pengujian/administrator, bukan untuk pengguna akhir:

```bash
npm install
npm run build
npm run preview
```

Buka `http://localhost:4173`. Sesi anonim Firebase dibuat otomatis selama provider Anonymous sudah diaktifkan, tetapi PWA tidak bisa dipasang dari `http://` selain `localhost`.

## Build yang disertakan

Arsip `GrowTogether-1.1.0-web.zip` berisi hasil build statis (`dist/`) dan panduan ini. Ekstrak lalu unggah isi foldernya ke **root** hosting HTTPS apa pun (Firebase Hosting, Netlify, Vercel, Nginx), atau ikuti `README.md` untuk deploy ke Firebase Hosting dengan `npm run deploy:hosting`.

Build zip memakai base path `/`, jadi paling mudah di-hosting di root domain/subdomain. Untuk hosting di subfolder (seperti GitHub Pages `/GrowTogether/`), build ulang dengan:

```bash
VITE_BASE_PATH=/GrowTogether/ npm run build
```
