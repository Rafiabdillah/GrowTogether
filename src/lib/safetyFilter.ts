/**
 * Batas Aman Sanksi & Kesepakatan (GrowTogether Safety Shield)
 * Memvalidasi teks kesepakatan agar tetap sehat, positif, dan menyenangkan.
 */

const BLOCKED_PATTERNS = [
  // Kekerasan fisik & penyiksaan diri
  /pukul|tampar|cubit|hajar|tendang|luka|darah|sakit fisik|lapar|tidak boleh makan|puasa paksa/i,
  // Penghinaan, merendahkan martabat
  /bodoh|tolol|goblok|jelek|hina|rendah|pecundang|tidak berguna|anjing|babi|bangsat/i,
  // Kontrol berlebihan / isolasi sosial
  /putuskan teman|jangan bicara sama siapa|jangan temui keluarga|sita ktp|kunci kamar|kurung/i,
  // Transfer uang / finansial
  /transfer uang|kirim uang|denda uang|bayar rp|bayar rupiah|gaji/i,
  // Bahaya seksual atau pelecehan tanpa persetujuan
  /telanjang|buka baju paksa|pelecehan/i,
];

export interface SafetyCheckResult {
  isSafe: boolean;
  message?: string;
}

export function validateAgreementSafety(text: string): SafetyCheckResult {
  const clean = text.trim();
  if (clean.length < 3) {
    return {
      isSafe: false,
      message: 'Tuliskan deskripsi kesepakatan yang lebih jelas.',
    };
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isSafe: false,
        message:
          'Kesepakatan harus ringan, sehat, dan menyenangkan bagi kedua pihak. Kata atau topik yang melibatkan kekerasan, penghinaan, kontrol berlebihan, atau transfer uang dilarang demi keamanan hubungan.',
      };
    }
  }

  return { isSafe: true };
}
