import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

const KEY = 'spotVisits.v1';

export type SpotVisit = { at: string; note: string; photos: string[] };
/** 場所ID -> 訪問記録。写真はアプリ内のドキュメント領域に保存し、ファイル名だけ持つ。 */
export type SpotVisits = Record<string, SpotVisit>;

export async function loadSpotVisits(): Promise<SpotVisits> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

export async function saveSpotVisits(v: SpotVisits): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // 次の更新で再試行される
  }
}

const photoDir = () => new Directory(Paths.document, 'photos');

/** 撮影/選択した画像を永続領域にコピーし、保存したファイル名を返す */
export async function savePhoto(srcUri: string): Promise<string> {
  const dir = photoDir();
  dir.create({ idempotent: true, intermediates: true });
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await new File(srcUri).copy(new File(dir, name));
  return name;
}

export const photoUri = (name: string) => new File(photoDir(), name).uri;
