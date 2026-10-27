import { StyleSheet, Text } from 'react-native';
import { colors } from '@/lib/theme';
import { Card, Screen } from '@/components/ui';

export default function PrivacyScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Kebijakan Privasi</Text>
      <Card>
        <Text style={styles.body}>
          Tamyizku menyimpan email, nama, progres belajar, streak, lencana, dan status langganan di Supabase agar akun bisa dipakai di web dan ponsel. Audio pelajaran diminta sebagai tautan bertanda waktu singkat, bukan diunduh sebagai file publik.
        </Text>
        <Text style={styles.body}>
          Token notifikasi perangkat disimpan hanya jika Anda mengizinkan pengingat. Pembayaran web diproses oleh Midtrans atau Xendit. Di Android dan iOS, pembelian mengikuti toko aplikasi, bukan tautan QRIS.
        </Text>
        <Text style={styles.body}>
          Anda dapat menghapus akun dari Pengaturan. Penghapusan menghapus profil, progres, streak, dan langganan yang terhubung ke akun tersebut.
        </Text>
      </Card>
      <Text style={styles.title}>Ketentuan Layanan</Text>
      <Card>
        <Text style={styles.body}>
          Modul 1 tersedia gratis. Modul berikutnya memerlukan langganan Rp10.000 per 30 hari. Konten Al-Qur'an dan audio pelafalan dipakai untuk belajar, bukan untuk disebarluaskan ulang.
        </Text>
        <Text style={styles.body}>
          Langganan tidak dipindahtangankan. Jika pembayaran web berhasil, akses premium aktif setelah webhook. Pembelian di toko aplikasi mengikuti kebijakan pengembalian Google Play atau App Store.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: colors.primary },
  body: { color: colors.text, lineHeight: 22 },
});
