# GrowTogether v1.1.2 — Aturan Firestore ditulis ulang supaya query bisa jalan

Versi ini memperbaiki penyebab sebenarnya dari "habit tidak muncul di HP pasangan".
Akar masalahnya bukan kode aplikasi, melainkan **bentuk aturan keamanannya**, dan ini
baru terbukti setelah diuji langsung ke proyek live.

## Apa yang sebenarnya terjadi

Firestore menilai permintaan **query (list)** berbeda dari pembacaan satu dokumen:
query hanya boleh jalan kalau filter di query itu *sendiri* membuktikan kondisi aturan
benar untuk semua baris yang mungkin kembali. Kondisi `allow read` kita selama ini
bersandar pada `isCoupleMember()` yang memakai `get()`/`exists()` — dan hasil `get()`
tidak pernah bisa dibuktikan oleh sebuah filter. Akibatnya:

- setiap listener (habits, logs, sessions, journals, checkins, books, reactions,
  agreements) **ditolak server**, bahkan ketika hasilnya nol baris;
- `setDoc()` tetap tercatat "ok" di diagnostik karena Promise JS SDK resolve saat
  tulisan masuk **antrean lokal**, bukan saat server menerima — jadi gejalanya
  "katanya tersimpan, tapi tidak pernah sampai".

Bukti dari proyek live (klien anonim nyata, hanya baca):

| bentuk query | sebelum | sesudah |
|---|---|---|
| `habits` coupleId saja | ditolak | ditolak (harus ada filter privasi) |
| `habits` coupleId + `isPrivate == false` | ditolak | **lolos** |
| `habits` coupleId + `ownerId == me` | ditolak | **lolos** |
| `logs`/`sessions`/`journals`/`checkins` (semua bentuk aplikasi) | ditolak | **lolos** |
| `books`/`reactions`/`agreements` coupleId | ditolak | **lolos** |
| `books` tanpa filter (enumerasi) | ditolak | **ditolak** (tetap aman) |
| `users` di-list | ditolak | **ditolak** (tetap aman) |

## Perubahan aturan

Setiap koleksi dipisah menjadi `allow get` (ketat, boleh `get()`/`exists()`) dan
`allow list` (hanya field yang dibuktikan filter query). Kondisi `list` sekarang:

- `habits` → `ownerId == me` **atau** `isPrivate == false`
- `logs`, `sessions`, `checkins` → `userId == me` **atau** `visibility == 'couple'` / `isShared == true`
- `journals` → `authorId == me` **atau** `isShared == true`
- `books`, `reactions`, `agreements` → `coupleId` ada di baris (query wajib memfilter coupleId)

Tulis, ubah, dan hapus **tidak berubah** dan tetap diuji 52/52 di emulator.

## Konsekuensi keamanan dan penutupnya

Karena `list` tidak bisa membuktikan keanggotaan lewat `get()`, id ruang kini menjadi
*capability*: siapa pun yang tahu id-nya bisa melihat baris non-privat ruang itu. Maka
`coupleId` tidak boleh lagi bisa ditebak. Dulu `couple_<uid10>_<timestamp>` (uid tidak
rahasia, timestamp bisa ditebak); sekarang `couple_<uid10>_<28 karakter acak>` dari
`crypto.getRandomValues`. Ruang lama tetap jalan, hanya ruang baru yang dapat id acak.

## Perubahan aplikasi

- `watchServer()` sekarang menangkap **penolakan server** atas tulisan yang antre.
  Sebelumnya `waitForPendingWrites()` yang reject tidak punya `.catch`, jadi tulisan
  yang ditolak aturan hilang tanpa pesan sama sekali.
- Banner untuk penolakan baca sekarang menyebut aturan Firestore, bukan "gagal menyimpan".
- `createCouple()` memakai id ruang acak (lihat di atas).

## Status publikasi

- Aturan baru **sudah di-publish ke proyek `growtogether-rafiabdillah`** lewat
  `firebase deploy --only firestore:rules` (CLI-mu login sebagai rafiabdillah454@gmail.com).
  Tidak perlu menempel manual ke Console lagi; repo dan konsol kini sama.
- Build v1.1.2 naik ke GitHub Pages, tag `v1.1.2` + release dengan zip dan SHA256.

## Yang perlu kamu lakukan

1. Tutup aplikasi di kedua HP, buka lagi (atau hapus data site GrowTogether di
   setelan browser) supaya PWA mengambil versi baru.
2. Buat **ruang baru** dengan kode ruang baru (ruang lama tetap bisa dipakai, tapi
   id-nya yang lama dan bisa ditebak).
3. Tes: tambah habit non-privat di HP A → harus muncul di HP B dalam hitungan detik.
