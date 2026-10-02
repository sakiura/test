import { Platform, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// 本番では AdMob で発行した広告ユニットIDに差し替える (リリース前に必須)
const UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : Platform.select({ ios: process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER ?? TestIds.ADAPTIVE_BANNER })!;

export function AdBanner() {
  return (
    <View style={{ alignItems: 'center' }}>
      <BannerAd unitId={UNIT_ID} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
    </View>
  );
}
