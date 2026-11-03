export function friendlyAccountError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Masuk tanpa akun belum diaktifkan di project Firebase. Buka Authentication → Sign-in method → Aktifkan Anonymous.';
    case 'auth/invalid-api-key':
      return 'Konfigurasi Firebase aplikasi ini salah. Periksa firebase-applet-config.json.';
    case 'auth/web-storage-unsupported':
      return 'Browser menolak menyimpan sesi. Izinkan cookie/data situs ini lalu muat ulang.';
    case 'auth/network-request-failed':
      return 'Koneksi ke Firebase gagal. Periksa jaringan lalu coba lagi.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
    case 'auth/admin-restricted-operation':
      return 'Pengaturan Firebase saat ini menolak masuk tanpa akun. Aktifkan Anonymous di konsol Firebase.';
    case 'permission-denied':
    case 'firebase-permission-denied':
      return 'Akses ruang ditolak server. Pastikan kode ruangnya benar.';
    default:
      return err instanceof Error && err.message ? err.message : 'Aksi akun gagal diproses. Coba lagi beberapa saat lagi.';
  }
}
