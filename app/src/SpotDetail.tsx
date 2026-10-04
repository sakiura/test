import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { categoryOf, spotById } from './spots';
import { photoUri, savePhoto, type SpotVisit } from './spotStore';

type Props = {
  spotId: string | null;
  visit: SpotVisit | undefined;
  onChange: (id: string, v: SpotVisit) => void;
  onClose: () => void;
};

/** 訪れた場所の詳細: 写真とメモを残す (端末内に保存) */
export function SpotDetail({ spotId, visit, onChange, onClose }: Props) {
  const spot = spotId ? spotById.get(spotId) : undefined;
  const [note, setNote] = useState('');
  useEffect(() => setNote(visit?.note ?? ''), [spotId, visit?.note]);
  if (!spot || !visit) return null;
  const cat = categoryOf(spot.c);

  const add = async (source: 'camera' | 'library') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return Alert.alert('許可が必要です', '設定アプリからカメラ/写真へのアクセスを許可してください。');
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
      const res =
        source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets[0]) return;
      const name = await savePhoto(res.assets[0].uri);
      onChange(spot.id, { ...visit, note, photos: [...visit.photos, name] });
    } catch {
      Alert.alert('写真を保存できませんでした');
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>
            {cat?.emoji} {spot.n}
          </Text>
          <Text style={styles.sub}>{new Date(visit.at).toLocaleDateString('ja-JP')} に訪問</Text>
          <TextInput
            style={styles.input}
            placeholder="ひとことメモ"
            value={note}
            onChangeText={setNote}
            onBlur={() => onChange(spot.id, { ...visit, note })}
            multiline
          />
          <View style={styles.row}>
            <Pressable onPress={() => add('camera')}>
              <Text style={styles.link}>📷 撮影</Text>
            </Pressable>
            <Pressable onPress={() => add('library')}>
              <Text style={styles.link}>🖼 写真を選ぶ</Text>
            </Pressable>
          </View>
          <View style={styles.photos}>
            {visit.photos.map((p) => (
              <Image key={p} source={{ uri: photoUri(p) }} style={styles.photo} />
            ))}
          </View>
        </ScrollView>
        <Pressable
          style={styles.close}
          onPress={() => {
            onChange(spot.id, { ...visit, note });
            onClose();
          }}
        >
          <Text style={styles.closeText}>閉じる</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  sub: { color: '#555' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, minHeight: 64, fontSize: 15 },
  row: { flexDirection: 'row', gap: 24 },
  link: { color: '#0a64d8', fontSize: 16, fontWeight: '600' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: 104, height: 104, borderRadius: 8, backgroundColor: '#eee' },
  close: { margin: 16, padding: 14, borderRadius: 10, backgroundColor: '#111', alignItems: 'center' },
  closeText: { color: '#fff', fontWeight: '700' },
});
