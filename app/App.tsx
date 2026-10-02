import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView, { Polygon } from 'react-native-maps';
import { AdBanner } from './src/AdBanner';
import { prefColor } from './src/color';
import { byCode, findMunicipality, municipalities, type Municipality } from './src/geo';
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
        <Text style={styles.title}>
          {painted.length} / {municipalities.length} 市区町村
        </Text>
        <Text style={styles.sub}>
          {denied ? '位置情報の許可が必要です (設定アプリから許可してください)' : current ? `現在地: ${current.p}${current.n}` : '現在地: 市区町村の外'}
        </Text>
      </View>
      <View style={styles.mapWrap}>
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
      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingVertical: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 13, color: '#555', marginTop: 2 },
  mapWrap: { flex: 1 },
  toast: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#000c', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  toastText: { color: '#fff', fontWeight: '600' },
});
