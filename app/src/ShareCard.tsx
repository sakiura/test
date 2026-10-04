import * as Sharing from 'expo-sharing';
import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { prefColor } from './color';
import { percent, prefStats } from './stats';
import type { Visits } from './visits';

/** 画面外に置いて画像化する共有用カード */
export const ShareCard = forwardRef<ViewShotRef, { visits: Visits }>(function ShareCard({ visits }, ref) {
  const stats = prefStats(visits);
  const visited = stats.reduce((n, s) => n + s.visited, 0);
  const total = stats.reduce((n, s) => n + s.total, 0);
  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }} style={styles.card}>
      <Text style={styles.title}>ぬりつぶし日本</Text>
      <Text style={styles.big}>
        {visited} / {total}
      </Text>
      <Text style={styles.sub}>市区町村を制覇 ({percent(visited, total)}%)</Text>
      <View style={styles.grid}>
        {stats.map((s) => {
          const p = s.visited / s.total;
          return (
            <View
              key={s.code}
              style={[styles.cell, { backgroundColor: p > 0 ? prefColor(s.name).fill : '#2a2a2a' }]}
            >
              <Text style={styles.cellText}>{s.name.replace(/[都道府県]$/, '')}</Text>
              <Text style={styles.cellText}>{Math.round(p * 100)}%</Text>
            </View>
          );
        })}
      </View>
    </ViewShot>
  );
});

export async function shareImage(uri: string) {
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'ぬりつぶし日本の記録を共有' });
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: -10000, width: 360, padding: 20, backgroundColor: '#111' },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  big: { color: '#fff', fontSize: 44, fontWeight: '800', marginTop: 8 },
  sub: { color: '#bbb', fontSize: 14, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  cell: { width: 62, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  cellText: { color: '#fff', fontSize: 10 },
});
