import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useViewport } from '@/lib/viewport';
import { colors, latinFont } from '@/lib/theme';

export type GridColumn<T> = {
  key: string;
  label: string;
  minWidth: number;
  render: (row: T) => ReactNode;
};

export function DataGrid<T extends { id: string }>({
  rows,
  columns,
  emptyLabel = 'Belum ada data',
}: {
  rows: T[];
  columns: GridColumn<T>[];
  emptyLabel?: string;
}) {
  const { compact } = useViewport();
  const [hidden, setHidden] = useState<string[]>([]);
  const visible = columns.filter((column) => !hidden.includes(column.key));
  const tableWidth = visible.reduce((sum, column) => sum + column.minWidth, 0);

  function toggle(key: string) {
    setHidden((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toggles}>
        {columns.map((column) => {
          const on = !hidden.includes(column.key);
          return (
            <Pressable key={column.key} accessibilityRole="button" onPress={() => toggle(column.key)} style={[styles.toggle, on && styles.toggleOn]}>
              <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{column.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {compact ? <Text style={styles.hint}>Geser ke samping untuk melihat kolom lainnya.</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={{ minWidth: tableWidth }}>
          <View style={[styles.head, Platform.OS === 'web' ? styles.headSticky : null]}>
            {visible.map((column) => (
              <Text key={column.key} style={[styles.headText, { width: column.minWidth }]}>{column.label}</Text>
            ))}
          </View>
          {rows.length === 0 ? <Text style={styles.empty}>{emptyLabel}</Text> : null}
          {rows.map((row) => (
            <View key={row.id} style={styles.row}>
              {visible.map((column) => (
                <View key={column.key} style={[styles.cell, { width: column.minWidth }]}>{column.render(row)}</View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  toggles: { gap: 8, paddingVertical: 4 },
  toggle: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 12, minHeight: 36, justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { ...latinFont, color: colors.text, fontWeight: '700', fontSize: 13 },
  toggleTextOn: { color: colors.white },
  hint: { ...latinFont, color: colors.muted, fontSize: 13 },
  head: { flexDirection: 'row', backgroundColor: colors.primary, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  headSticky: { position: 'sticky', top: 0, zIndex: 2 } as unknown as ViewStyle,
  headText: { ...latinFont, color: colors.white, fontWeight: '700', fontSize: 13, paddingHorizontal: 12, paddingVertical: 12 },
  row: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.line },
  cell: { paddingHorizontal: 12, paddingVertical: 12, justifyContent: 'center' },
  empty: { ...latinFont, color: colors.muted, padding: 16 },
});
