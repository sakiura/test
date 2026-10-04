import { FlatList, StyleSheet, Text, View } from 'react-native';
import { prefColor } from './color';
import { percent, prefStats } from './stats';
import type { Visits } from './visits';

export function StatsScreen({ visits }: { visits: Visits }) {
  const stats = prefStats(visits);
  const done = stats.filter((s) => s.visited === s.total).length;
  return (
    <FlatList
      data={stats}
      keyExtractor={(s) => s.code}
      ListHeaderComponent={<Text style={styles.head}>制覇した都道府県: {done} / {stats.length}</Text>}
      renderItem={({ item: s }) => {
        const p = percent(s.visited, s.total);
        return (
          <View style={styles.row}>
            <Text style={styles.name}>{s.name}</Text>
            <View style={styles.bar}>
              <View style={[styles.fill, { width: `${p}%`, backgroundColor: prefColor(s.name).stroke }]} />
            </View>
            <Text style={styles.num}>
              {s.visited}/{s.total} ({p}%)
            </Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  head: { fontSize: 16, fontWeight: '700', padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  name: { width: 72, fontSize: 14 },
  bar: { flex: 1, height: 10, borderRadius: 5, backgroundColor: '#e5e5e5', overflow: 'hidden' },
  fill: { height: '100%' },
  num: { width: 96, textAlign: 'right', fontSize: 12, color: '#444' },
});
