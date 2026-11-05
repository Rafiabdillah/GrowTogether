# GrowTogether v1.2.7 — Pohon Kita bertambah bagian tiap misi yang tuntas

Sebelum versi ini, pohon kalian cuma tumbuh dari **streak**: hari tanpa bolong menaikkan
stage, dan sisanya hanya menyalakan lentera. Akibatnya pasangan yang rajin menyelesaikan
misi tapi belum panjang streaknya melihat pohon yang sama keringnya dengan yang jarang
buka aplikasi. Versi ini membuat usaha harian ikut bentuk: **setiap misi yang tuntas
menumbuhkan satu bagian baru pada pohon**, sampai pohonnya benar-benar lengkap.

## Cara tumbuhnya

Satu misi = satu habit × satu orang × satu hari. Habit privat tidak dihitung, jadi isi
yang kalian sepakat rahasiakan tidak pernah ikut muncul di pohon pasangan. Ambangnya
dibuat melebar (1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 70, 90 misi) supaya bagian pertama
cepat terlihat dan bagian terakhir tetap terasa seperti pencapaian bersama:

| Misi tuntas | Bagian yang tumbuh | Wujudnya |
| --- | --- | --- |
| 1 | Akar penyangga | empat akar memeluk tanah |
| 3 | Lumut batang | lumut hijau di sisi batang |
| 6 | Ranting samping | dua dahan muda ke kiri dan kanan |
| 10 | Semak daun muda | gumpalan daun di sepanjang batang |
| 15 | Bunga krem | kelopak mekar mengelilingi tajuk |
| 21 | Buah menggantung | butir buah di bawah tajuk |
| 28 | Sarang dua telur | sarang kecil bertengger di dahan |
| 36 | Sulur menjuntai | liana panjang menggantung dari dahan |
| 45 | Jamur di tanah | payung jamur kecil di sekitar akar |
| 55 | Kunang-kunang | cahaya kecil berputar mengelilingi pohon |
| 70 | Sepasang burung | dua burung bertengger di puncak |
| 90 | Mahkota cahaya | lingkar emas di atas tajuk |

Semua bagian dihitung, tidak diacak. Posisi tiap akar, kelopak, dan kunang-kunang
diturunkan dari rumus (distribusi sudut emas di kulit tajuk), jadi dua ponsel yang
membuka taman pada saat yang sama melihat pohon yang persis sama — bukan dua versi
pohon yang kebetulan mirip.

## Yang berubah

- **`src/lib/treeCraft.ts` (baru)** — daftar 12 bagian plus tiga fungsi murni:
  `coupleMissionsDone(logs)` menghitung misi tuntas dari log (ganda baris cache+server
  dihitung sekali, privat dibuang), `openPartIds(m)` dan `nextPart(m)` memutuskan mana
  yang sudah tumbuh dan apa yang menyusul. Karena semuanya fungsi murni atas data
  server, angka di layar tidak bisa berbeda antara dua perangkat.
- **`coupleMissions` ikut dihitung di AppContext** berdampingan dengan `combinedStreak`,
  dari kumpulan log yang sama, dengan saring privasi yang sama.
- **Pohon 3D (`src/components/ThreeGarden.tsx`)** — tiap bagian punya geometri sendiri
  dan menempel ke tajuk yang benar-benar dipakai stage saat ini, jadi bibit setinggi
  dengkul dan sakura pusaka sama-sama masuk akal. Jamur dan akar sekarang diukur dari
  lebar tanah (`groundR`): pot bonsai yang sempit tidak lagi kebanjiran jamur, dan
  tanah bonsai dinaikkan ke permukaan soil supaya tidak ada bagian yang melayang.
- **Mode 2D aksesibel (`src/components/Garden2DFallback.tsx`)** — bukan tempelan: 12
  bagian yang sama digambar sebagai SVG, masing-masing ber-`<title>` nama bagian, dan
  ringkasan untuk pembaca layar menyebut bagian apa saja yang sudah tumbuh, berapa misi
  yang tuntas, serta berapa misi lagi menuju bagian berikutnya.
- **Layar Hari Ini** — kartu Pohon Kita sekarang menampilkan legend jujur:
  `N misi tuntas berdua · X/12 bagian pohon tumbuh · <bagian berikutnya> menyusul
  setelah M misi lagi`, plus daftar nama bagian yang sudah terbuka.

## Yang diuji

Rantai penuh hijau sebelum rilis ini (build produksi + emulator Firestore, dua perangkat
Chrome nyata, bukan simulasi):

- `npm run lint` — 0 galat (TS + service worker).
- `npm run test:tree` — **30 PASS, 0 FAIL**: kurva ambang, satu ambang = tepat satu
  bagian, tidak ada bagian bocor sebelum ambangnya, misi ganda dari cache tidak dihitung
  dua kali, dan habit privat tidak menambah bagian.
- `npm run test:rules` — **86 PASS, 0 FAIL**.
- `npm run test:relay` — **22 PASS, 0 FAIL**.
- `npm run test:devices` — **128 PASS, 0 FAIL** (14 fase), termasuk lima cek baru pohon:
  daftar bagian 2D perangkat A = perangkat B, daftar itu = rumus yang dihitung ulang dari
  isi database, tulisan mode 3D = mode 2D, satu log privat yang tuntas benar-benar
  menambah misi di server **tanpa** menambah satu bagian pun, dan legend Hari Ini
  menyebut angka database + nama bagian berikutnya.

## Batasan yang perlu kalian tahu

- Bagian pohon hanya muncul di tema **Pulau** dan **Bonsai** (dua-duanya di 3D dan di
  mode 2D). Tema Galaxy dan Meja Belajar punya ceritanya sendiri dan tidak ikut tumbuh —
  angkanya tetap sama, hanya wujudnya tidak dipasang di sana.
- Ini hiasan bersama, bukan skor. Yang dihitung adalah habit yang benar-benar ditandai
  selesai; tidak ada bagian yang bisa "dibeli" atau dinaikkan lewat XP.
- Setelah 90 misi tuntas, pohon dinyatakan lengkap dan legend berubah menjadi
  "Pohon kalian sudah lengkap". Bagian tidak pernah hilang kalau streak putus — yang
  bertahan adalah jejak kerja kalian.
