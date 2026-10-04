import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { ViewShotRef } from 'react-native-view-shot';
import MapView, { Polygon, type Region } from 'react-native-maps';
import { AdBanner } from './src/AdBanner';
import { prefColor } from './src/color';
import { CELL_KM2, cellCorners, cellCenter, cellsAlong, keyOf, parseKey, suggestDetour, todayStr, DLAT, DLNG, type LatLng } from './src/grid';
import { byCode, findMunicipality, municipalities, type Municipality } from './src/geo';
import { useRemoveAds } from './src/purchases';
import { ShareCard, shareImage } from './src/ShareCard';
import { StatsScreen } from './src/StatsScreen';
import { loadCells, loadVisits, saveCells, saveVisits, type Cells, type Visits } from './src/visits';

const toLatLng = (ring: [number, number][]) => ring.map(([longitude, latitude]) => ({ latitude, longitude }));

/** これより広い範囲を表示しているときは区画ではなく市区町村で塗りを見せる */
const CELL_ZOOM_MAX_DELTA = 0.25;
const MAX_CELLS_DRAWN = 800;

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
  const [cells, setCells] = useState<Cells>({});
  const cellsRef = useRef<Cells>({});
  const lastPos = useRef<LatLng | null>(null);
  const [here, setHere] = useState<LatLng | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
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
    Promise.all([loadVisits(), loadCells()]).then(([v, c]) => {
      visitsRef.current = v;
      cellsRef.current = c;
      setCells(c);
      setVisits(v);
    });
  }, []);

  const onPosition = useCallback((loc: Location.LocationObject) => {
    const { longitude, latitude } = loc.coords;
    const pos = { lat: latitude, lng: longitude };
    const day = todayStr();
    let nextCells = cellsRef.current;
    for (const c of cellsAlong(lastPos.current, pos)) {
      const k = keyOf(c);
      if (!nextCells[k]) nextCells = { ...nextCells, [k]: day };
    }
    lastPos.current = pos;
    setHere(pos);
    if (nextCells !== cellsRef.current) {
      cellsRef.current = nextCells;
      setCells(nextCells);
      saveCells(nextCells);
    }
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
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 10_000 },
        onPosition,
      );
      if (cancelled) s.remove();
      else sub = s;
      const first = await Location.getCurrentPositionAsync({});
      map.current?.animateToRegion(
        { latitude: first.coords.latitude, longitude: first.coords.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 },
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

  const today = todayStr();
  const cellKeys = Object.keys(cells);
  const todayCount = cellKeys.reduce((n, k) => n + (cells[k] === today ? 1 : 0), 0);

  const detour = useMemo(
    () => (here ? suggestDetour(here, (k) => k in cells) : null),
    // 区画が増えるたびに探し直す
    [here, cells],
  );

  const showCells = !region || region.latitudeDelta <= CELL_ZOOM_MAX_DELTA;
  const visibleCells = useMemo(() => {
    if (!region || !showCells) return [];
    const [s, n] = [region.latitude - region.latitudeDelta / 2, region.latitude + region.latitudeDelta / 2];
    const [w, e] = [region.longitude - region.longitudeDelta / 2, region.longitude + region.longitudeDelta / 2];
    const [iy0, iy1, ix0, ix1] = [Math.floor(s / DLAT), Math.floor(n / DLAT), Math.floor(w / DLNG), Math.floor(e / DLNG)];
    const out: string[] = [];
    for (const k of Object.keys(cells)) {
      const { iy, ix } = parseKey(k);
      if (iy >= iy0 && iy <= iy1 && ix >= ix0 && ix <= ix1) out.push(k);
      if (out.length >= MAX_CELLS_DRAWN) break;
    }
    return out;
  }, [region, showCells, cells]);

  const goDetour = useCallback(() => {
    if (!detour) return;
    const c = cellCenter(detour.cell);
    map.current?.animateToRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  }, [detour]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.titleRow}>
        <Text style={styles.title}>
          {cellKeys.length} 区画 <Text style={styles.sub}>(今日 +{todayCount})</Text>
        </Text>
          <Pressable onPress={share} hitSlop={8}>
            <Text style={styles.link}>共有</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>
          約{(cellKeys.length * CELL_KM2).toFixed(1)}km² ・ {painted.length}/{municipalities.length} 市区町村{"\n"}
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
          onRegionChangeComplete={setRegion}
        >
          {showCells
            ? visibleCells.map((k) => (
                <Polygon
                  key={k}
                  coordinates={cellCorners(parseKey(k))}
                  fillColor={cells[k] === today ? 'rgba(255,120,0,0.55)' : 'rgba(255,170,0,0.35)'}
                  strokeColor="rgba(255,120,0,0.5)"
                  strokeWidth={0.5}
                />
              ))
            : painted.map((m) => <Painted key={m.c} m={m} />)}
        </MapView>
        {detour && (
          <Pressable style={styles.detour} onPress={goDetour}>
            <Text style={styles.detourTitle}>
              🚶 {detour.dir}へ約{detour.meters}m に、まだ塗っていない場所
            </Text>
            <Text style={styles.detourText}>{detour.theme}</Text>
          </Pressable>
        )}
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
      <ShareCard ref={card} visits={visits ?? {}} cellCount={cellKeys.length} />
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
  detour: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#fffe', borderRadius: 12, padding: 12 },
  detourTitle: { fontWeight: '700', fontSize: 14 },
  detourText: { color: '#555', fontSize: 13, marginTop: 2 },
  toast: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#000c', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  toastText: { color: '#fff', fontWeight: '600' },
});
