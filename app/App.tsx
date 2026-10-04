import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { ViewShotRef } from 'react-native-view-shot';
import MapView, { Polygon } from 'react-native-maps';
import { AdBanner } from './src/AdBanner';
import { prefColor } from './src/color';
import { byCode, findMunicipality, municipalities, type Municipality } from './src/geo';
import { useRemoveAds } from './src/purchases';
import { ShareCard, shareImage } from './src/ShareCard';
import { StatsScreen } from './src/StatsScreen';
import { loadVisits, saveVisits, type Visits } from './src/visits';

const toLatLng = (ring: [number, number][]) => ring.map(([longitude, latitude]) => ({ latitude, longitude }));

const Painted = memo(function Painted({ m }: { m: Municipality }) {
  const { fill, stroke } = prefColor(m.p);
  return (
    <>
      {m.g.map((poly, i) => (
        <Polygon
          key={i}
          coordinates={toLatLng(poly[0])}
          holes={poly.slice(1).map(toLatLng)}
          fillColor={fill}
          strokeColor={stroke}
          strokeWidth={1}
        />
      ))}
    </>
  );
});

export default function App() {
  const [visits, setVisits] = useState<Visits | null>(null);
  const [current, setCurrent] = useState<Municipality | null>(null);
  const [denied, setDenied] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState<string | null>(null);
  const visitsRef = useRef<Visits>({});
  const map = useRef<MapView>(null);
  const card = useRef<ViewShotRef>(null);
  const [tab, setTab] = useState<'map' | 'stats'>('map');
  const iap = useRemoveAds();

  const share = useCallback(async () => {
    try {
      const uri = await card.current?.capture?.();
      if (uri) await shareImage(uri);
    } catch {
      Alert.alert('共有できませんでした');
    }
  }, []);

  useEffect(() => {
    loadVisits().then((v) => {
      visitsRef.current = v;
      setVisits(v);
    });
  }, []);

  const onPosition = useCallback((loc: Location.LocationObject) => {
    const { longitude, latitude } = loc.coords;
    const m = findMunicipality(longitude, latitude);
    setCurrent(m);
    if (!m || visitsRef.current[m.c]) return;
    const next = { ...visitsRef.current, [m.c]: new Date().toISOString() };
    visitsRef.current = next;
    setVisits(next);
    setJustUnlocked(m.p + m.n);
    saveVisits(next);
  }, []);

  useEffect(() => {
    if (visits === null) return;
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setDenied(true);
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 10_000 },
        onPosition,
      );
      if (cancelled) s.remove();
      else sub = s;
      const first = await Location.getCurrentPositionAsync({});
      map.current?.animateToRegion(
        { latitude: first.coords.latitude, longitude: first.coords.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 },
        0,
      );
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
    // 初回ロード完了後に一度だけ開始する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visits === null]);

  useEffect(() => {
    if (!justUnlocked) return;
    const t = setTimeout(() => setJustUnlocked(null), 4000);
    return () => clearTimeout(t);
  }, [justUnlocked]);

  const painted = useMemo(
    () => Object.keys(visits ?? {}).flatMap((c) => byCode.get(c) ?? []),
    [visits],
  );

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.titleRow}>
        <Text style={styles.title}>
          {painted.length} / {municipalities.length} 市区町村
        </Text>
          <Pressable onPress={share} hitSlop={8}>
            <Text style={styles.link}>共有</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>
          {denied ? '位置情報の許可が必要です (設定アプリから許可してください)' : current ? `現在地: ${current.p}${current.n}` : '現在地: 市区町村の外'}
        </Text>
      </View>
      <View style={styles.tabs}>
        {(['map', 'stats'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={tab === t && styles.tabOnText}>{t === 'map' ? '地図' : '達成率'}</Text>
          </Pressable>
        ))}
      </View>
      {tab === 'stats' && <StatsScreen visits={visits ?? {}} />}
      <View style={[styles.mapWrap, tab === 'stats' && { display: 'none' }]}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: 36.2, longitude: 138.25, latitudeDelta: 14, longitudeDelta: 14 }}
          showsUserLocation
        >
          {painted.map((m) => (
            <Painted key={m.c} m={m} />
          ))}
        </MapView>
        {justUnlocked && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>🎨 {justUnlocked} を塗りました！</Text>
          </View>
        )}
      </View>
      {iap.available && !iap.adsRemoved && (
        <View style={styles.iapRow}>
          <Pressable disabled={!iap.canBuy || iap.busy} onPress={iap.buy}>
            <Text style={styles.link}>広告を消す{iap.price ? ` (${iap.price})` : ''}</Text>
          </Pressable>
          <Pressable disabled={iap.busy} onPress={iap.restore}>
            <Text style={styles.sub}>購入を復元</Text>
          </Pressable>
        </View>
      )}
      {!iap.adsRemoved && <AdBanner />}
      <ShareCard ref={card} visits={visits ?? {}} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: '#0a64d8', fontSize: 15, fontWeight: '600' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#eee' },
  tabOn: { backgroundColor: '#111' },
  tabOnText: { color: '#fff' },
  iapRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 13, color: '#555', marginTop: 2 },
  mapWrap: { flex: 1 },
  toast: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#000c', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  toastText: { color: '#fff', fontWeight: '600' },
});
