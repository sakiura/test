import { SectionList, Pressable, StyleSheet, Text, View } from 'react-native';
import { categories, spotById, totalByCategory } from './spots';
import type { SpotVisits } from './spotStore';

/** 図鑑: 種類ごとに、訪れた場所を一覧する */
export function SpotsScreen({ visits, onOpen }: { visits: SpotVisits; onOpen: (id: string) => void }) {
  const sections = categories.map((c) => {
    const ids = Object.keys(visits).filter((id) => spotById.get(id)?.c === c.id);
    ids.sort((a, b) => visits[b].at.localeCompare(visits[a].at));
    return { cat: c, data: ids };
  });
  return (
    <SectionList
      sections={sections}
      keyExtractor={(id) => id}
      renderSectionHeader={({ section: { cat, data } }) => (
        <Text style={styles.head}>
          {cat.emoji} {cat.label} {data.length}/{totalByCategory.get(cat.id) ?? 0}
        </Text>
      )}
      renderSectionFooter={({ section: { data } }) =>
        data.length === 0 ? <Text style={styles.empty}>まだ訪れていません。散歩に出かけよう！</Text> : null
      }
      renderItem={({ item: id }) => (
        <Pressable style={styles.row} onPress={() => onOpen(id)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{spotById.get(id)?.n}</Text>
            <Text style={styles.meta}>
              {new Date(visits[id].at).toLocaleDateString('ja-JP')}
              {visits[id].photos.length ? ` ・ 📷${visits[id].photos.length}` : ''}
              {visits[id].note ? ' ・ メモあり' : ''}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  head: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6, backgroundColor: '#fff' },
  empty: { color: '#777', paddingHorizontal: 16, paddingBottom: 8 },
  row: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ddd' },
  name: { fontSize: 15 },
  meta: { fontSize: 12, color: '#666', marginTop: 2 },
});
