import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { createCheckoutSession } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { paymentChannel, paymentsMode, webAppUrl } from '@/lib/billing';
import { MONTHLY_PRICE_IDR, colors, formatIdr } from '@/lib/theme';
import { Button, Card, Screen, notify } from '@/components/ui';

export default function PaywallScreen() {
  const { configured, refreshSubscription } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channel = paymentChannel();

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const result = await createCheckoutSession();
      if (result.simulated) {
        await refreshSubscription();
        notify('Mode demo: langganan 30 hari diaktifkan di perangkat ini.');
        return;
      }
      if (result.paymentUrl) {
        if (Platform.OS === 'web') window.open(result.paymentUrl, '_blank', 'noopener,noreferrer');
        else await WebBrowser.openBrowserAsync(result.paymentUrl);
        notify('Selesaikan pembayaran. Status premium berubah otomatis setelah webhook.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuka pembayaran');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      {loading ? <Text style={styles.overlay}>Menyiapkan pembayaran...</Text> : null}
      <Card>
        <Text style={styles.kicker}>Tamyizku Premium</Text>
        <Text style={styles.price}>{formatIdr(MONTHLY_PRICE_IDR)}<Text style={styles.per}> / bulan</Text></Text>
        <Text style={styles.body}>Semua modul, kuis, dan audio kata. Modul 1 tetap gratis.</Text>
        {channel === 'qris' ? (
          <Text style={styles.body}>QRIS, GoPay, OVO, dan transfer bank lewat Midtrans atau Xendit ({paymentsMode()}).</Text>
        ) : (
          <Text style={styles.body}>Di aplikasi Android dan iOS, langganan memakai pembelian dalam aplikasi Google Play atau App Store. QRIS tidak ditawarkan di build toko.</Text>
        )}
        {channel === 'qris' ? <Button label="Bayar via QRIS Rp10rb" loading={loading} onPress={pay} /> : null}
        {channel === 'store' && webAppUrl() ? (
          <Button label="Buka pembayaran web" tone="ghost" onPress={() => void WebBrowser.openBrowserAsync(webAppUrl())} />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Kebijakan privasi & ketentuan" tone="ghost" onPress={() => router.push('/privacy')} />
        {!configured ? (
          <Text style={styles.note}>Supabase belum dihubungkan, jadi tombol ini hanya mensimulasikan pembayaran di perangkat ini.</Text>
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.accent, fontWeight: '800', letterSpacing: 0.4 },
  price: { fontSize: 36, fontWeight: '800', color: colors.primary },
  per: { fontSize: 16, color: colors.muted },
  body: { color: colors.text, lineHeight: 22 },
  error: { color: colors.danger },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  overlay: { color: colors.primary, fontWeight: '700' },
});
