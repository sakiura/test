import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'visits.v1';

/** 市区町村コード -> 初訪問日時 (ISO) */
export type Visits = Record<string, string>;

export async function loadVisits(): Promise<Visits> {
  try {
    const s = await AsyncStorage.getItem(KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

export async function saveVisits(v: Visits): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // 保存失敗時は次回の更新で再試行される
  }
}
