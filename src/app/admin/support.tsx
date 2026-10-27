import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button, Card, Screen, SkeletonList, notify } from '@/components/ui';
import { fetchSupportTickets, SUPPORT_CATEGORIES, updateTicketStatus, type SupportTicket, type TicketStatus } from '@/lib/support';
import { colors } from '@/lib/theme';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Masuk',
  in_progress: 'Diproses',
  resolved: 'Selesai',
};

export default function AdminSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTickets(await fetchSupportTickets());
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memuat tiket', 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function setStatus(id: string, status: TicketStatus) {
    try {
      await updateTicketStatus(id, status);
      await load();
      notify('Status tiket diperbarui');
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memperbarui', 'err');
    }
  }

  return (
    <Screen>
      <Text style={styles.lead}>Tiket yang masih terbuka tampil sebagai badge di menu Dukungan.</Text>
      {loading ? <SkeletonList /> : null}
      {!loading && tickets.length === 0 ? <Text style={styles.lead}>Belum ada tiket.</Text> : null}
      {tickets.map((ticket) => (
        <Card key={ticket.id}>
          <Text style={styles.subject}>{ticket.subject}</Text>
          <Text style={styles.meta}>
            {SUPPORT_CATEGORIES.find((item) => item.id === ticket.category)?.label} · {STATUS_LABEL[ticket.status]} · {ticket.email}
          </Text>
          <Text style={styles.body}>{ticket.description}</Text>
          {ticket.attachmentUrl ? <Text style={styles.meta}>Bukti: {ticket.attachmentUrl}</Text> : null}
          <Button label="Tandai diproses" tone="ghost" onPress={() => void setStatus(ticket.id, 'in_progress')} />
          <Button label="Tandai selesai" onPress={() => void setStatus(ticket.id, 'resolved')} />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { color: colors.muted, lineHeight: 20 },
  subject: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { color: colors.muted },
  body: { color: colors.text, lineHeight: 22 },
});
