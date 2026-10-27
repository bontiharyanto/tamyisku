import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { filterFaq, type FaqCategory } from '@/lib/faq';
import { colors } from '@/lib/theme';

const ORDER: FaqCategory[] = ['Metode Tamyiz', 'Langganan & Pembayaran', 'Kendala Teknis'];

export function FaqAccordion({ query }: { query: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const items = useMemo(() => filterFaq(query), [query]);

  if (items.length === 0) {
    return <Text style={styles.empty}>Tidak ada pertanyaan yang cocok dengan pencarian itu.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {ORDER.map((category) => {
        const group = items.filter((item) => item.category === category);
        if (group.length === 0) return null;
        return (
          <View key={category} style={styles.group}>
            <Text style={styles.category}>{category}</Text>
            {group.map((item) => {
              const open = openId === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => setOpenId(open ? null : item.id)}
                  style={styles.item}
                >
                  <Text style={styles.question}>{open ? '−' : '+'} {item.question}</Text>
                  {open ? <Text style={styles.answer}>{item.answer}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  group: { gap: 8 },
  category: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  item: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  question: { color: colors.text, fontWeight: '800', lineHeight: 22 },
  answer: { color: colors.muted, lineHeight: 22 },
  empty: { color: colors.muted },
});
