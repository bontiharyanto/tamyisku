export type FaqCategory = 'Metode Tamyiz' | 'Langganan & Pembayaran' | 'Kendala Teknis';

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'tamyiz-what',
    category: 'Metode Tamyiz',
    question: 'Apa itu metode Tamyiz dan bagaimana cara belajarnya?',
    answer:
      'Tamyiz membedakan kata dalam ayat menurut peran bahasanya. Isim berwarna biru, Fi\'il merah, Huruf hijau, dan kosa kata Tamyiz berwarna emas. Buka modul, dengarkan kata, lalu kerjakan kuis sampai skor lulus.',
  },
  {
    id: 'tamyiz-colors',
    category: 'Metode Tamyiz',
    question: 'Apa arti warna pada kartu kata?',
    answer:
      'Biru untuk Isim (kata benda), merah untuk Fi\'il (kata kerja), hijau untuk Huruf (kata tugas), dan emas untuk kosa kata Tamyiz yang sering berulang.',
  },
  {
    id: 'pay-confirm',
    category: 'Langganan & Pembayaran',
    question: 'Bagaimana cara konfirmasi pembayaran Rp10rb/bulan?',
    answer:
      'Di web, bayar lewat QRIS. Setelah pembayaran berhasil, webhook mengaktifkan premium selama 30 hari. Jika status belum berubah, kirim tiket kategori Pembayaran beserta bukti transaksi.',
  },
  {
    id: 'pay-cancel',
    category: 'Langganan & Pembayaran',
    question: 'Apakah langganan bisa dibatalkan?',
    answer:
      'Langganan web tidak diperpanjang otomatis. Akses premium berakhir pada tanggal yang tertera di profil. Pembelian di Google Play atau App Store dibatalkan lewat pengaturan toko tersebut.',
  },
  {
    id: 'audio-missing',
    category: 'Kendala Teknis',
    question: 'Suara audio tidak keluar',
    answer:
      'Periksa volume perangkat dan izinkan pemutaran media. Jika kartu bertuliskan audio belum diunggah, pelafalan untuk kata itu memang belum tersedia. Muat ulang halaman saat sambungan stabil.',
  },
  {
    id: 'offline',
    category: 'Kendala Teknis',
    question: 'Aplikasi tidak bisa diakses saat offline',
    answer:
      'Modul, kosa kata, dan kuis yang sudah pernah dibuka tersimpan di perangkat. Buka dulu saat online. Audio baru dimuat lagi ketika sambungan kembali karena tautannya hanya berlaku beberapa menit.',
  },
];

export function filterFaq(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return FAQ_ITEMS;
  return FAQ_ITEMS.filter(
    (item) =>
      item.question.toLowerCase().includes(needle) ||
      item.answer.toLowerCase().includes(needle) ||
      item.category.toLowerCase().includes(needle),
  );
}
