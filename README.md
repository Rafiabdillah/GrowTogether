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

GrowTogether dipasang sebagai PWA di Android, iOS, maupun desktop. Panduan langkah demi langkah ada di [INSTALL.md](INSTALL.md).

## Autentikasi dan Mode Demo

Aplikasi punya dua jalur masuk:

1. **Masuk dengan Google** — memakai Firebase Auth (popup). Setelah masuk, profil pengguna dibuat otomatis di koleksi `users`, lalu pengguna dapat membuat ruang pasangan atau bergabung memakai kode undangan.
2. **Mode Demo** — menjelajahi seluruh UI dengan data contoh Rama & Shinta tanpa login. Data hanya disimpan di localStorage perangkat dan tidak menulis ke Firestore.

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
2. Aktifkan **Authentication → Sign-in method → Google**.
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

## Checklist Siap Pakai

- [ ] `npm run lint` dan `npm run build` lulus.
- [ ] `firestore.rules` sudah dipublikasikan ke proyek Firebase yang dipakai.
- [ ] Google Sign-In aktif dan domain hosting ada di Authorized domains.
- [ ] Aplikasi disajikan lewat HTTPS (wajib untuk PWA dan popup login).
- [ ] Dua akun Google berbeda berhasil membuat/menggabungkan ruang dan saling melihat progres.
- [ ] `firebase-applet-config.json` tidak berisi kredensial admin (hanya konfigurasi web publik).

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
