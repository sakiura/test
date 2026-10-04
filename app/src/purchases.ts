import { useCallback, useEffect, useState } from 'react';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

// RevenueCat (https://www.revenuecat.com) 経由でApp Store課金を扱う。
// ダッシュボードで entitlement "remove_ads" を作り、非消耗型/サブスク商品を紐付ける。
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ENTITLEMENT = 'remove_ads';

let configured = false;
function configure() {
  if (!API_KEY) return false;
  if (!configured) {
    Purchases.configure({ apiKey: API_KEY });
    configured = true;
  }
  return true;
}

/** 広告削除の購入状態。キー未設定(開発中)は「未購入・購入不可」として動く。 */
export function useRemoveAds() {
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [busy, setBusy] = useState(false);
  const available = !!API_KEY;

  useEffect(() => {
    if (!configure()) return;
    const apply = (info: { entitlements: { active: Record<string, unknown> } }) =>
      setAdsRemoved(ENTITLEMENT in info.entitlements.active);
    Purchases.getCustomerInfo().then(apply).catch(() => {});
    Purchases.getOfferings()
      .then((o) => setPkg(o.current?.availablePackages[0] ?? null))
      .catch(() => {});
    Purchases.addCustomerInfoUpdateListener(apply);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(apply);
    };
  }, []);

  const buy = useCallback(async () => {
    if (!pkg) return;
    setBusy(true);
    try {
      await Purchases.purchasePackage(pkg); // 結果はリスナー経由で反映
    } catch {
      // キャンセル含め何もしない
    } finally {
      setBusy(false);
    }
  }, [pkg]);

  const restore = useCallback(async () => {
    if (!available) return;
    setBusy(true);
    try {
      await Purchases.restorePurchases();
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }, [available]);

  return { adsRemoved, available, price: pkg?.product.priceString, canBuy: !!pkg, busy, buy, restore };
}
