import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import * as Linking from 'expo-linking';
import { FaqAccordion } from '@/components/FaqAccordion';
import { SupportTicketForm } from '@/components/SupportTicketForm';
import { Button, Field, Screen, notify } from '@/components/ui';
import { supportWhatsAppUrl } from '@/lib/support';
import { colors } from '@/lib/theme';

export default function HelpScreen() {
  const [query, setQuery] = useState('');

  async function openWhatsApp() {
    const url = supportWhatsAppUrl();
    if (!url) {
      notify('Nomor WhatsApp admin belum diatur.', 'err');
      return;
    }
    await Linking.openURL(url);
  }

  return (
    <Screen>
      <Text style={styles.title}>Pusat Bantuan</Text>
      <Text style={styles.lead}>Cari jawaban singkat, atau kirim tiket jika kendala masih ada.</Text>
      <Field label="Cari pertanyaan" value={query} onChangeText={setQuery} placeholder="Misalnya audio, pembayaran, offline" />
      <FaqAccordion query={query} />
      <Button label="Hubungi via WhatsApp Admin" tone="ghost" onPress={() => void openWhatsApp()} />
      <SupportTicketForm onSent={() => notify('Pesan Anda berhasil dikirim, tim kami akan merespons dalam 1x24 jam')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.primary },
  lead: { color: colors.muted, lineHeight: 22 },
});
