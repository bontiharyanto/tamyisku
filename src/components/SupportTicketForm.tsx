import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { pickSupportImage, submitSupportTicket, SUPPORT_CATEGORIES, type SupportCategory } from '@/lib/support';
import { colors } from '@/lib/theme';
import { Button, Card, Field, notify } from '@/components/ui';

export function SupportTicketForm({ onSent }: { onSent: () => void }) {
  const [category, setCategory] = useState<SupportCategory>('pembayaran');
  const [openList, setOpenList] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const label = SUPPORT_CATEGORIES.find((item) => item.id === category)?.label ?? 'Pembayaran';

  async function chooseImage() {
    try {
      const asset = await pickSupportImage();
      setImageUri(asset?.uri ?? null);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal memilih gambar', 'err');
    }
  }

  async function send() {
    setSending(true);
    try {
      await submitSupportTicket({ category, subject, description, imageUri });
      setSubject('');
      setDescription('');
      setImageUri(null);
      onSent();
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : 'Gagal mengirim tiket', 'err');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <Text style={styles.title}>Kirim tiket dukungan</Text>
      <Text style={styles.label}>Kategori Masalah</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpenList((value) => !value)} style={styles.select}>
        <Text style={styles.selectText}>{label}</Text>
      </Pressable>
      {openList ? (
        <View style={styles.menu}>
          {SUPPORT_CATEGORIES.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                setCategory(item.id);
                setOpenList(false);
              }}
              style={styles.option}
            >
              <Text style={styles.optionText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field label="Judul" value={subject} onChangeText={setSubject} />
      <Field label="Deskripsi kendala" multiline value={description} onChangeText={setDescription} style={styles.area} />
      <Button label={imageUri ? 'Bukti terpilih' : 'Unggah tangkapan layar (opsional)'} tone="ghost" onPress={() => void chooseImage()} />
      <Button label="Kirim tiket" loading={sending} onPress={() => void send()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  select: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12 },
  selectText: { color: colors.text, fontWeight: '700' },
  menu: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden' },
  option: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.white },
  optionText: { color: colors.text },
  area: { minHeight: 110, textAlignVertical: 'top' },
});
