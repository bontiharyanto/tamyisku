import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { fetchOverview } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fetchSupportTickets, updateTicketStatus, type SupportTicket, type TicketStatus } from '@/lib/support';
import { roleLabel, type UserRole } from '@/lib/types';
import type { Overview } from '@/lib/types';
import { latinFont } from '@/lib/theme';
import { useViewport } from '@/lib/viewport';
import { StatCard } from '@/components/dashboard/shell';
import { Button, Field, Screen, SkeletonList, notify } from '@/components/ui';

const FILTERS: { id: 'all' | UserRole; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'user', label: 'Santri' },
  { id: 'tutor', label: 'Pengajar' },
  { id: 'admin', label: 'Admin' },
];

const STATUS: Record<TicketStatus, string> = {
  open: 'Masuk',
  in_progress: 'Diproses',
  resolved: 'Selesai',
};

export function AdminDashboard() {
  const { dataVersion } = useAuth();
  const router = useRouter();
  const catalog = useAdminUsers(dataVersion);
  const { compact } = useViewport();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [roleFilter, setRoleFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextOverview, nextTickets] = await Promise.all([fetchOverview(), fetchSupportTickets()]);
      setOverview(nextOverview);
      setTickets(nextTickets);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat dasbor admin');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openTickets = tickets.filter((ticket) => ticket.status !== 'resolved');
  const visibleUsers = catalog.users.filter((user) => roleFilter === 'all' || user.role === roleFilter);

  async function setStatus(id: string, status: TicketStatus) {
    try {
      await updateTicketStatus(id, status);
      await load();
      notify('Status tiket diperbarui');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memperbarui tiket', 'err');
    }
  }

  return (
    <Screen edges={['bottom']}>
      {loading || catalog.loading ? <SkeletonList count={4} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {overview ? (
        <View style={[styles.grid, compact ? styles.stack : null]}>
          <StatCard label="Pengguna terdaftar" value={String(overview.totalUsers)} />
          <StatCard label="Langganan aktif" value={String(overview.activeSubscribers)} />
          <StatCard label="Santri aktif hari ini" value={String(overview.dailyActiveLearners)} />
          <StatCard label="Tiket terbuka" value={String(openTickets.length)} />
        </View>
      ) : null}
      <Text style={styles.section}>Pengguna</Text>
      <Field label="Cari email atau nama" value={catalog.search} onChangeText={catalog.setSearch} autoCapitalize="none" />
      <Button label="Cari" tone="ghost" onPress={() => void catalog.load(catalog.search)} />
      <View style={styles.filters}>
        {FILTERS.map((filter) => (
          <Pressable key={filter.id} onPress={() => setRoleFilter(filter.id)} style={[styles.chip, roleFilter === filter.id && styles.chipOn]}>
            <Text style={[styles.chipText, roleFilter === filter.id && styles.chipTextOn]}>{filter.label}</Text>
          </Pressable>
        ))}
      </View>
      {visibleUsers.map((user) => (
        <View key={user.id} style={styles.card}>
          <Text style={styles.item}>{user.fullName || 'Tanpa nama'}</Text>
          <Text style={styles.meta}>{user.email} · {roleLabel(user.role)}</Text>
          <View style={styles.actions}>
            <Button label="Santri" tone={user.role === 'user' ? 'primary' : 'ghost'} loading={catalog.busyId === user.id} onPress={() => void catalog.assignRole(user, 'user')} />
            <Button label="Pengajar" tone={user.role === 'tutor' ? 'primary' : 'ghost'} loading={catalog.busyId === user.id} onPress={() => void catalog.assignRole(user, 'tutor')} />
            <Button label="Admin" tone={user.role === 'admin' ? 'primary' : 'ghost'} loading={catalog.busyId === user.id} onPress={() => void catalog.assignRole(user, 'admin')} />
          </View>
        </View>
      ))}
      <Text style={styles.section}>Tiket belum selesai</Text>
      {openTickets.length === 0 && !loading ? <Text style={styles.meta}>Tidak ada tiket terbuka.</Text> : null}
      {openTickets.slice(0, 6).map((ticket) => (
        <View key={ticket.id} style={styles.card}>
          <Text style={styles.item}>{ticket.subject}</Text>
          <Text style={styles.tag}>{STATUS[ticket.status]}</Text>
          <Text style={styles.meta}>{ticket.email}</Text>
          <View style={styles.actions}>
            <Button label="Diproses" tone="ghost" onPress={() => void setStatus(ticket.id, 'in_progress')} />
            <Button label="Selesai" onPress={() => void setStatus(ticket.id, 'resolved')} />
            <Button label="Semua tiket" tone="ghost" onPress={() => router.push('/admin/support')} />
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stack: { flexDirection: 'column' },
  section: { ...latinFont, fontSize: 18, fontWeight: '800', color: '#1C1915', marginTop: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E6E0D6', padding: 14, gap: 6 },
  item: { ...latinFont, fontWeight: '800', color: '#1C1915' },
  meta: { ...latinFont, color: '#5C564C' },
  error: { color: '#B71C1C' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#E6E0D6', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: '#0F5132', borderColor: '#0F5132' },
  chipText: { ...latinFont, fontWeight: '700', color: '#1C1915' },
  chipTextOn: { color: '#FDFBF7' },
  tag: { alignSelf: 'flex-start', backgroundColor: '#FFF8E1', color: '#6D4C00', fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
});
