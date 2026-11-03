export function friendlyAccountError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Jendela Google ditutup. Coba lagi untuk melanjutkan.';
    case 'auth/popup-blocked':
      return 'Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'Browser ini tidak mendukung popup Google. Coba di Chrome atau Safari.';
    case 'auth/user-mismatch':
      return 'Akun Google yang dipilih berbeda dengan akun yang sedang masuk.';
    case 'auth/requires-recent-login':
      return 'Sesi sudah lama. Keluar lalu masuk kembali, kemudian ulangi hapus akun.';
    case 'auth/network-request-failed':
      return 'Koneksi ke Google gagal. Periksa jaringan lalu coba lagi.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
    default:
      return 'Aksi akun gagal diproses. Coba lagi beberapa saat lagi.';
  }
}
