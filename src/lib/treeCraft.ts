import type { HabitLog } from '../types/index';

export type TreePartId =
  | 'roots'
  | 'moss'
  | 'sprigs'
  | 'leafTufts'
  | 'blossoms'
  | 'fruits'
  | 'nest'
  | 'vines'
  | 'mushrooms'
  | 'fireflies'
  | 'birds'
  | 'crown';

export interface TreePart {
  id: TreePartId;
  /** Nama bagian pohon, dipakai layar dan pembaca layar. */
  label: string;
  /** Apa yang benar-benar bertambah di pohon, supaya tidak jadi klom kosong. */
  lihat: string;
  /** Jumlah misi tuntas yang dibutuhkan supaya bagian ini muncul. */
  misi: number;
}

/**
 * Urutan bagian pelengkap pohon. Tangga dibuat merapat di awal — misi pertama
 * langsung memberi akar — lalu melebar, sehingga pohon masih punya sesuatu yang
 * terbuka berminggu-minggu kemudian. Setelah bagian terakhir, pohon dinyatakan
 * lengkap dan jumlah misi tetap tampil sebagai catatan berdua.
 */
export const TREE_PARTS: TreePart[] = [
  { id: 'roots', label: 'Akar penyangga', lihat: 'empat akar memeluk tanah', misi: 1 },
  { id: 'moss', label: 'Lumut batang', lihat: 'lumut hijau di sisi batang', misi: 3 },
  { id: 'sprigs', label: 'Ranting samping', lihat: 'dua dahan muda ke kiri dan kanan', misi: 6 },
  { id: 'leafTufts', label: 'Semak daun muda', lihat: 'gumpalan daun di sepanjang batang', misi: 10 },
  { id: 'blossoms', label: 'Bunga krem', lihat: 'kelopak mekar mengelilingi tajuk', misi: 15 },
  { id: 'fruits', label: 'Buah menggantung', lihat: 'butir buah di bawah tajuk', misi: 21 },
  { id: 'nest', label: 'Sarang dua telur', lihat: 'sarang kecil bertengger di dahan', misi: 28 },
  { id: 'vines', label: 'Sulur menjuntai', lihat: 'liana panjang menggantung dari dahan', misi: 36 },
  { id: 'mushrooms', label: 'Jamur di tanah', lihat: 'payung jamur kecil di sekitar akar', misi: 45 },
  { id: 'fireflies', label: 'Kunang-kunang', lihat: 'cahaya kecil berputar mengelilingi pohon', misi: 55 },
  { id: 'birds', label: 'Sepasang burung', lihat: 'dua burung bertengger di puncak', misi: 70 },
  { id: 'crown', label: 'Mahkota cahaya', lihat: 'lingkar emas di atas tajuk', misi: 90 },
];

/**
 * Misi yang tuntas seumur ruangan, dan hanya yang boleh dilihat pasangan.
 *
 * Satu misi = satu habit milik satu orang pada satu hari. Kuncinya bukan ID
 * dokumen: baris log bisa datang dua kali (tembolok lokal lalu server), dan
 * kalau ID yang dipakai, misi yang sama akan terhitung dua kali sehingga dua
 * ponsel menampilkan pohon yang berbeda. Kebiasaan privat juga tidak pernah
 * ikut — pasangan tidak bisa melihatnya, jadi pohon kalian berdua tidak boleh
 * bertumbuh karenanya.
 */
export function coupleMissionsDone(logs: HabitLog[]): number {
  const missions = new Set<string>();
  for (const log of logs) {
    if (!log.completed || log.visibility === 'private') continue;
    missions.add(`${log.userId}|${log.habitId}|${log.date}`);
  }
  return missions.size;
}

export function openParts(missions: number): TreePart[] {
  return TREE_PARTS.filter((part) => missions >= part.misi);
}

/** Nama bagian, untuk label yang tidak boleh salah urutan. */
export function partLabel(id: TreePartId): string {
  const part = TREE_PARTS.find((candidate) => candidate.id === id);
  return part ? part.label : id;
}

export function openPartIds(missions: number): TreePartId[] {
  return openParts(missions).map((part) => part.id);
}

/** Bagian yang masih menunggu, atau null kalau pohon sudah lengkap. */
export function nextPart(missions: number): { part: TreePart; remaining: number } | null {
  const part = TREE_PARTS.find((candidate) => missions < candidate.misi);
  return part ? { part, remaining: part.misi - missions } : null;
}
