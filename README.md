# GrowTogether

Aplikasi habit dan growth tracker untuk dua orang. Pasangan menandai habit harian, menjalankan timer fokus, mencatat buku dan refleksi, membuat kesepakatan (hadiah dan sanksi ringan), lalu melihat pohon bersama tumbuh di taman 3D.

## Fitur Utama

- **Hari Ini** — habit harian per tanggal, cincin progres, streak bersama, grace day mingguan, reaksi "Semangatin".
- **Timer fokus** — timer Pomodoro, suara latar, sesi manual, pencatatan menit ke habit terkait.
- **Kita** — check-in malam, buku bersama, jurnal refleksi, roda hadiah/sanksi, toko dekorasi pulau.
- **Sanksi** — kesepakatan hadiah & sanksi dengan persetujuan pasangan, kartu maaf, jeda sanksi, simulasi pemicu.
- **Progres** — grafik waktu baca/belajar 7 hari, badge, streak, grace day.
- **Taman** — taman pertumbuhan 3D (WebGL) dengan fallback 2D aksesibel, suasana langit dan cuaca.
- **PWA** — bisa dipasang di layar utama, aset di-cache Workbox.

## Instalasi untuk Pengguna

**Langsung pakai:** https://rafiabdillah.github.io/GrowTogether/

GrowTogether dipasang sebagai PWA di Android, iOS, maupun desktop — satu aplikasi untuk mobile dan PC. Panduan langkah demi langkah ada di [INSTALL.md](INSTALL.md), dan juga di dalam aplikasi pada **Pengaturan → Instal Aplikasi**.

- **Android:** Chrome → menu ⋮ → Instal aplikasi.
- **iPhone/iPad:** Safari → Bagikan → Tambah ke Layar Utama.
- **PC/Laptop:** Chrome/Edge/Brave → ikon instal di address bar.

Unduhan build statis tersedia di [Releases](https://github.com/Rafiabdillah/GrowTogether/releases).

> Masuk tanpa akun memakai Firebase Anonymous. Aktifkan **Authentication → Sign-in method → Anonymous**; tanpa itu aplikasi menampilkan kartu "Sesi perangkat gagal dibuka". Mode demo tetap berjalan tanpa Firebase.

## Autentikasi dan Mode Demo

Aplikasi punya dua jalur masuk:

1. **Sesi anonim + kode ruang** — setiap pemasangan membuka sesi Firebase Anonymous (tanpa login apa pun), lalu pengguna mengetik namanya dan membuat ruang dengan **kode ruang**, atau bergabung memakai kode dari pasangan.
2. **Mode Demo** — menjelajahi seluruh UI dengan data contoh Rama & Shinta tanpa sesi Firebase. Data hanya disimpan di localStorage perangkat dan tidak menulis ke Firestore.

Keluar dari mode demo tersedia di **Pengaturan → Kelola Data → Akun**.

## Pairing Pasangan

- Saat membuat ruang, aplikasi membuat dokumen `couples/{coupleId}` dan mendaftarkan kode undangan di `inviteCodes/{code}`.
- Pasangan memasukkan kode tersebut di **Pengaturan → Hubungkan Pasangan** (atau onboarding). Anggota kedua mengisi `user2Id` pada ruang yang masih terbuka.
- Pencarian kode memakai koleksi `inviteCodes`, bukan daftar seluruh pengguna. Kode unik dan bisa dibagikan tanpa membuka data pengguna lain.
- Setelah terhubung, semua koleksi (`habits`, `logs`, `sessions`, `books`, `journals`, `reactions`, `agreements`, `checkins`) disinkronkan real-time melalui `onSnapshot` dan difilter berdasarkan `coupleId`.

## Menjalankan

Butuh Node.js 20 atau lebih baru (disarankan Node 22+).

```bash
npm install
npm run dev
```

Buka http://localhost:3000. Perintah lain:

- `npm run lint`: pengecekan tipe (`tsc --noEmit`)
- `npm run build`: build produksi ke `dist/`
- `npm run preview`: coba hasil build

## Konfigurasi Firebase

Konfigurasi proyek Firebase dibaca dari `firebase-applet-config.json` di root proyek (berisi `apiKey`, `projectId`, `firestoreDatabaseId`, dan field lain). Untuk memakai proyek sendiri:

1. Ganti isi `firebase-applet-config.json` dengan konfigurasi Web App dari Firebase Console, lalu sesuaikan `projectId` di `.firebaserc`.
2. Aktifkan **Authentication → Sign-in method → Anonymous**.
3. Tambahkan domain aplikasi (mis. `localhost` dan domain produksi) ke **Authentication → Settings → Authorized domains**.
4. Buat database Firestore, lalu deploy aturan keamanan:

```bash
npx --yes firebase-tools login
npm run deploy:rules
```

Atau salin isi `firestore.rules` ke tab Rules di Firebase Console lalu Publish.

5. Deploy aplikasi (hasil build `dist/`):

```bash
npm run deploy:hosting
```

`firebase.json` sudah mengatur rewrite SPA, cache aset statis, dan `no-cache` untuk service worker sehingga pembaruan PWA langsung terdeteksi.

Tanpa langkah 4, semua baca/tulis ke Firestore akan ditolak dan aplikasi hanya berjalan di mode demo lokal. Tanpa langkah 5, buka aplikasi lewat `npm run dev` atau host `dist/` di layanan HTTPS lain.

## Notifikasi push (aplikasi benar-benar tertutup)

Notifikasi biasa hanya bisa dibangkitkan oleh halaman yang masih hidup. HP yang
aplikasinya sudah ditutup hanya bisa dibangunkan oleh **server** yang menandatangani
permintaan dengan kunci privat VAPID, jadi jalur ini butuh Cloud Functions — dan
Cloud Functions butuh paket **Blaze** (bayar sesuai pemakaian; pemakaian harian
GrowTogether jauh di bawah batas gratis).

Sekali saja per proyek:

```bash
# 1. pasang Blaze: https://console.firebase.google.com/project/growtogether-rafiabdillah/usage (Upgrade plan)
# 2. buat kunci VAPID (jangan pernah commit kunci privatnya)
cd functions && npm install && node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Masukkan `publicKey` ke `.env` sebagai `VITE_VAPID_PUBLIC_KEY` (ikut dibundel ke
aplikasi — memang publik) dan simpan ketiganya di `functions/.secret.local` supaya
emulator bisa memakainya:

```
VAPID_PUBLIC_KEY=B...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:alamat-yang-bisa-dihubungi@example.com
```

Lalu pasang. Tiap secret dimasukkan lewat CLI (ia bertanya lalu menyimpan versi
barunya di Secret Manager, tidak pernah masuk ke repo):

```bash
npx --yes firebase-tools functions:secrets:set VAPID_PRIVATE_KEY --project growtogether-rafiabdillah
npx --yes firebase-tools functions:secrets:set VAPID_PUBLIC_KEY  --project growtogether-rafiabdillah
npx --yes firebase-tools functions:secrets:set VAPID_SUBJECT     --project growtogether-rafiabdillah
npx --yes firebase-tools deploy --only functions --project growtogether-rafiabdillah
npm run deploy:rules
```

Fungsi di `functions/index.js` membaca dokumen baru (pelukan, check-in & jurnal yang
dibagi, kesepakatan yang menunggu keputusan), lalu mengirim ke **setiap** alamat push
pasangan. Preferensi jenis kabar ikut tersimpan di dokumen `pushSubscriptions`
perangkat, jadi jenis yang dimatikan tidak dikirim walau aplikasinya tertutup.
Alamat yang sudah mati (balasan 404/410) dihapus oleh fungsi yang sama.

Buktikan tanpa menyentuh proyek produksi:

```bash
npm run test:push     # emulator firestore+auth+functions + layanan push tiruan
```

Tanpa langkah di atas aplikasi tetap berjalan: kabar masuk saat aplikasi terbuka,
dan kabar yang datang saat tertutup tetap disambut di antrean begitu dibuka lagi.

## Deploy ke GitHub Pages

Build untuk subpath `/GrowTogether/` lalu dorong isi `dist/` ke branch `gh-pages`:

```bash
VITE_BASE_PATH=/GrowTogether/ npm run build
# salin isi dist/ ke branch gh-pages (Pages: Deploy from a branch → gh-pages → /)
```

Sertakan file `.nojekyll` di root branch `gh-pages`.

## Checklist Siap Pakai

- [x] `npm run lint` dan `npm run build` lulus.
- [x] Aplikasi live di HTTPS: https://rafiabdillah.github.io/GrowTogether/
- [ ] `firestore.rules` sudah dipublikasikan ke proyek Firebase yang dipakai.
- [ ] Anonymous sign-in aktif dan domain hosting ada di Authorized domains.
- [ ] Dua perangkat berbeda berhasil membuat/menggabungkan ruang lewat kode dan saling melihat progres.
- [x] `firebase-applet-config.json` tidak berisi kredensial admin (hanya konfigurasi web publik).

## Keamanan Firestore

`firestore.rules` membatasi akses berdasarkan keanggotaan pasangan:

- `users` — hanya diri sendiri yang bisa dibaca/diubah; pasangan yang berbagi `coupleId` boleh membaca profil pasangannya. List pengguna ditolak.
- `couples` — anggota boleh membaca; pembuat (`user1Id`) membuat ruang; anggota kedua boleh mengisi `user2Id` selama ruang masih terbuka; field identitas tidak bisa diubah.
- `inviteCodes` — hanya bisa dibaca berdasarkan kode (tanpa list), dibuat pemilik kode, dan dihapus pemilik.
- `habits` — pemilik selalu bisa membaca habitnya; pasangan hanya bisa membaca habit dengan `isPrivate == false`.
- `logs` — baris milik sendiri selalu bisa dibaca; pasangan hanya membaca baris dengan `visibility == 'couple'`. Log habit privat ditulis dengan `visibility: 'private'`.
- `sessions` — sesi dengan `visibility == 'couple'` terlihat berdua; sesi dari habit privat tetap milik pembuatnya.
- `journals` dan `checkins` — entri dengan `isShared == true` terlihat berdua; selain itu hanya penulisnya.
- `books`, `reactions`, `agreements` — dibatasi ke anggota pasangan yang sama.
- Semua koleksi data hanya bisa ditulis oleh anggota pasangan; baris milik sendiri untuk operasi tulis tertentu.
- Mode demo tidak menyentuh Firestore sama sekali (`cloudSyncEnabled` dimatikan saat demo atau saat belum login).

Catatan migrasi: dokumen lama yang dibuat sebelum field `visibility`/`isShared` diterapkan dapat kehilangan visibilitas bagi pasangan (default aman: hanya pemilik). Tandai ulang atau buat ulang data tersebut bila aplikasi sudah pernah dipakai sebelum pembaruan ini.

## Struktur

- `src/context/AppContext.tsx`: seluruh state, persistensi localStorage, listener Firestore, dan aksi.
- `src/lib/firebase.ts`: inisialisasi Firebase Auth/Firestore dengan cache persisten multi-tab.
- `src/views/`: layar Hari Ini, Timer, Sanksi, Kita, Progres, Taman, Auth, Pairing.
- `src/components/`: modal, header, navigasi bawah, taman 3D (`three`).
- `src/hooks/useDialog.ts`: Escape, fokus, dan perangkap Tab untuk semua modal.
- `firestore.rules`: aturan akses berbasis keanggotaan pasangan.

## Aksesibilitas

Navigasi, Header, Hari Ini, Timer, Pengaturan, dan semua modal memakai kontrol native dengan nama aksesibel, target sentuh 44px, Escape untuk menutup modal, dan animasi yang mengikuti `prefers-reduced-motion`. Taman menyediakan mode 2D aksesibel sebagai alternatif WebGL.
