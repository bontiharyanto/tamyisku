import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, latinFont } from '@/lib/theme';
import { BottomSheet } from '@/components/BottomSheet';
import { Button, Field } from '@/components/ui';

export function DeleteAccountModal({
  visible,
  busy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: { confirmation: string; password: string }) => void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const ready = confirmation.trim() === 'HAPUS' || password.length >= 6;

  function close() {
    if (busy) return;
    setConfirmation('');
    setPassword('');
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={close} dismissOnBackdrop={false}>
      <Text style={styles.title}>Hapus Akun Saya</Text>
      <Text style={styles.warning}>Tindakan ini tidak dapat dibatalkan.</Text>
      <Text style={styles.body}>
        Seluruh statistik belajar, riwayat kuis, streak, dan data langganan Anda akan dihapus secara permanen.
      </Text>
      <Field
        label='Ketik HAPUS untuk mengonfirmasi'
        autoCapitalize="characters"
        value={confirmation}
        onChangeText={setConfirmation}
      />
      <Field
        label="Atau masukkan ulang kata sandi"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button
        label="Hapus akun permanen"
        tone="danger"
        loading={busy}
        disabled={!ready}
        onPress={() => onConfirm({ confirmation: confirmation.trim(), password })}
      />
      <Button label="Batal" tone="ghost" disabled={busy} onPress={close} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { ...latinFont, fontSize: 22, fontWeight: '800', color: colors.danger },
  warning: { ...latinFont, color: colors.danger, fontWeight: '800' },
  body: { ...latinFont, lineHeight: 22 },
});
