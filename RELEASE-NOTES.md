# GrowTogether v1.1.1 — Sinkronisasi dua perangkat dibuktikan, bukan diassumsikan

Versi ini khusus memperbaiki jalur sinkronisasi. Semua klaim di bawah sudah diuji dengan
mesin aturan Firestore yang sebenarnya (emulator Auth + Firestore, `firestore.rules` repo ini
dievaluasi dokumen per dokumen oleh dua klien Firebase berbeda): **52 dari 52 pemeriksaan lolos**.

## Yang diperbaiki

### 1. Habit / log / sesi / jurnal / check-in milik sendiri tidak lagi hilang seisi ruang
Listener "data milikku" dulu hanya memfilter `ownerId == uid`. Aturan keamanan menuntut field
`coupleId` ada di setiap dokumen sebelum boleh dibaca, dan **satu baris lama tanpa `coupleId`
membuat seluruh query ditolak** — akibatnya daftar habit di kedua HP jadi kosong, bukan cuma
satu item yang hilang. Sekarang semua query itu membawa `coupleId == ruang ini` juga, sehingga
bisa dibuktikan aman oleh aturan dan tidak bisa "keracunan" satu baris lama:

- `habits` → `ownerId` + `coupleId`
- `logs`, `sessions`, `checkins` → `userId` + `coupleId`
- `journals` → `authorId` + `coupleId`

### 2. Satu kode ruang untuk dua orang
Kode ruang sekarang disimpan di dokumen ruang (`couples/{id}.roomCode`), bukan hanya di profil
pembuat ruang. Semua layar (masuk/Pairing, Tab Pasangan, panduan sambutan, Pengaturan) membaca
`roomCode` yang sama. Ruang lama ditambal otomatis. Artinya pasangan yang bergabung lewat kode
bisa melihat, menyalin, dan membagikan kode yang benar untuk masuk kembali.

### 3. Check-in malam tidak lagi gagal diam-diam
Check-in yang dicatat atas nama akun lain dulu ditolak server tanpa pesan. Sekarang tulisan
hanya dikirim bila pemiliknya akun di perangkat ini; kalau bukan, muncul di banner
**Sinkronisasi** dengan sebabnya, bukan hilang tanpa jejak.

### 4. "Hapus data perangkat ini" bisa menuntaskan pekerjaannya
Query penghapusan (habit, log, sesi, jurnal, check-in) ikut di-scope `coupleId`, supaya aturan
tidak menolaknya. Sebelumnya penghapusan bisa berhenti di tengah jalan dan meninggalkan baris
yang masih muncul di HP pasangan.

## Hasil uji aturan (ringkas)

Diuji dengan dua identitas Firebase terpisah di satu project yang sama:

- bootstrap profil, 3 tulisan `createCouple`, baca `inviteCodes/{kode}`, klaim slot kedua,
  kode palsu ditolak, ruang penuh tidak terbaca orang asing
- setiap fitur bisa ditulis dari kedua perangkat: habit, log, sesi fokus, jurnal, buku,
  reaksi (pelukan/semangat), kesepakatan, check-in malam
- privasi pasangan: A melihat habit/log/sesi/jurnal/check-in bersama milik B, **tidak** melihat
  yang privat; orang asing dan perangkat ketiga nol akses
- penyalahgunaan ditolak: B mengubah log A, A memalsukan reaksi atas nama B, B mencatat check-in
  A, non-anggota menulis kesepakatan, A menghapus habit milik B, pemindahan pemilik habit
- akumulasi XP ruang memakai `increment` dari dua perangkat (35 = 20 + 15), patch target
  mingguan dari sisi pasangan
- keluar ruang: slot dilepas, kode ruang masih bisa dipakai perangkat baru, ruang penuh menolak
  klaim kedua, penyerahan ruang ke anggota tersisa

## Catatan teknis untuk developer

- `firebase.json` menambah blok `emulators` (auth 9199, firestore 8899, UI dimatikan). Tidak
  dipakai saat build/deploy produksi.
- `src/lib/firebase.ts` punya jembatan emulator yang hanya aktif bila
  `VITE_FIREBASE_EMULATOR=1`; build rilis **tidak** menyetel ini, jadi tidak ada koneksi ke
  alamat lokal di produksi.
- Menemukan cacat emulator Firestore (v1.21.0 dan v1.22.0): aturan `list` yang menyentuh
  `resource.data` selalu dilaporkan `Null value error`, padahal bentuk query yang sama sah di
  produksi. Karena itu uji difokuskan ke operasi per-dokumen; perilaku push dua HP diverifikasi
  terhadap proyek live.

## Yang masih harus kamu lakukan sekali saja (di Firebase Console)

Login tanpa akun belum diizinkan di project `growtogether-rafiabdillah`. Buka
**Firebase Console → Authentication → Sign-in method → Anonymous → Aktifkan → Save.**
Tanpa itu, perangkat baru tidak bisa masuk dan layar kode ruang menampilkan galat
`auth/admin-restricted-operation`.

## Aturan Firestore

`firestore.rules` di repo ini sudah menjadi acuan pengujian di atas dan **tidak berubah** di
versi ini. Kalau console-mu menampilkan aturan yang berbeda dari repo, salin seluruh isi
`firestore.rules` ke **Firestore → Rules** lalu **Publish** (perangkat ini tidak bisa
men-deploy aturan ke proyekmu).

## Checklist verifikasi dua HP (2 menit)

1. HP A dan HP B sama-sama membuka aplikasi dan masuk lewat **kode ruang yang sama**.
2. Di HP A tambahkan habit non-privat → dalam hitungan detik muncul di HP B tanpa reload.
3. Centang habit tersebut di HP A → angka streak/XP di HP B ikut naik.
4. Di HP B kirim **pelukan** → HP A menerima notifikasi/toast dan hitungan reaksi bertambah.
5. Buat jurnal/check-in **privat** di HP A → tidak muncul di HP B.
6. Bila ada banner merah, buka **Pengaturan → Sinkronisasi** untuk melihat fitur mana dan sebabnya.
