import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchOverview } from '@/lib/api';
import { fetchOpenTicketCount } from '@/lib/support';
import { useAuth } from '@/lib/auth';
import type { Overview } from '@/lib/types';
import { colors, formatIdr } from '@/lib/theme';
import { Button, Card, Screen, SkeletonList } from '@/components/ui';

export default function AdminHome() {
  const { dataVersion } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [openTickets, setOpenTickets] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void fetchOverview()
      .then((next) => {
        setOverview(next);
        setError(null);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Gagal memuat'))
      .finally(() => setLoading(false));
    void fetchOpenTicketCount().then(setOpenTickets).catch(() => setOpenTickets(0));
  }, [dataVersion]);

  return (
    <Screen>
      <Text style={styles.lead}>Pengguna, langganan premium, modul selesai, dan estimasi pendapatan bulan ini.</Text>
      {loading ? <SkeletonList count={4} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? null : (
        <>
          <Card>
            <Text style={styles.value}>{overview?.totalUsers ?? '...'}</Text>
            <Text style={styles.label}>Total pengguna terdaftar</Text>
          </Card>
          <Card>
            <Text style={styles.value}>{overview?.activeSubscribers ?? '...'}</Text>
            <Text style={styles.label}>Pengguna premium aktif</Text>
          </Card>
          <Card>
            <Text style={styles.value}>{overview?.completedModules ?? '...'}</Text>
            <Text style={styles.label}>Modul selesai dikerjakan</Text>
          </Card>
          <Card>
            <Text style={styles.value}>{overview ? formatIdr(overview.monthlyRevenue) : '...'}</Text>
            <Text style={styles.label}>Estimasi pendapatan bulan ini</Text>
          </Card>
          <Card>
            <Text style={styles.value}>{openTickets}</Text>
            <Text style={styles.label}>Tiket dukungan masuk</Text>
            <Button label="Buka tiket" tone="ghost" onPress={() => router.push('/admin/support')} />
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted },
  error: { color: colors.danger },
  value: { fontSize: 28, fontWeight: '800', color: colors.primary },
  label: { color: colors.muted },
});
