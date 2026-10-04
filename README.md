# ぬりつぶし日本

日本の市区町村を、実際にその場所へ行くと地図上で塗りつぶせるiOSアプリ (Expo / React Native)。
App Storeで配信し、下部バナー広告 (AdMob) で収益化する想定。

## 方針
日常の散歩・寄り道が主役。歩いた場所を約270m四方の区画として塗り、未訪問の近くの区画を「寄り道」として提案する。
市区町村の塗りつぶしは、地図を引いたときの全国ビュー/長期目標として併存。

## 場所のコレクション (公園・温泉・神社…)
- 場所の種類は `app/spots.config.json` に1件足して `npm run build:spots` を実行すれば増やせる (OpenStreetMapのタグで指定)
- データ取得: `cd app && npm run build:spots` (日本全域。時間がかかる) / 試作は `-- --bbox 南,西,北,東`。
  `assets/data/spots.json` は現在**サンプル3件のみ**。実データはOverpass APIに接続できる環境で上のコマンドを実行して生成する
- 場所に着くと図鑑に載り、写真とひとことメモを残せる (端末内保存。他の人への投稿はサーバーが必要なため未実装)
- 地図はOpenStreetMapタイル。OSM公式タイルサーバーは大量アクセスの商用アプリ向けではないため、公開前に `EXPO_PUBLIC_TILE_URL` でタイル配信事業者のURLに切り替えること。「© OpenStreetMap contributors」表記は必須

## 現状のMVP
- 約270m四方の区画を歩いて塗る (前回地点との間を補間して飛ばさない)。今日塗った区画は濃く表示
- 近くの未訪問区画を方角・距離つきで提案 (タップで地図が移動)
- 地図を引くと (緯度幅0.25度超) 市区町村の塗りに切り替わる
- 現在地 (フォアグラウンド) から市区町村を判定 (全国1902区画、端末内の点-in-ポリゴン判定、オフライン動作)
- 初めて訪れた市区町村を都道府県ごとの色で塗る / 訪問履歴は端末に保存
- 都道府県別の達成率画面 (「達成率」タブ)
- 共有ボタンで、都道府県別の達成状況カードをPNG画像にして共有
- 下部にAdMobバナー (現在はGoogleのテスト広告ID)
- 「広告を消す」課金 (RevenueCat経由)。`EXPO_PUBLIC_REVENUECAT_IOS_KEY` 未設定の間は課金UIは出ず、広告は表示されたまま

## 開発
```
cd app
npm install
npm run build:data   # 境界データ再生成 (assets/data/municipalities.json はコミット済み)
npx expo prebuild && npx expo run:ios   # AdMobがネイティブのためExpo Goでは動かない。開発ビルドが必要
```

## App Store公開までのTODO
1. `app.json` の `bundleIdentifier` を自分のIDに変更、Apple Developer Program登録 (年額)
2. AdMobでアプリ/広告ユニットを作成し、`app.json` の `iosAppId` と `EXPO_PUBLIC_ADMOB_IOS_BANNER` を本番IDに差し替え
3. 広告削除課金: App Store ConnectでIAP商品を作成 → RevenueCatでentitlement `remove_ads` を作って商品を紐付け、iOS公開APIキーを `EXPO_PUBLIC_REVENUECAT_IOS_KEY` に設定 (サンドボックスで要動作確認)
4. 同意: ATT (App Tracking Transparency) と、必要に応じUMPによる同意フォーム
5. プライバシーポリシーURL、App Storeのプライバシー栄養ラベル (位置情報・広告) の申告
6. アイコン/スクリーンショット、`eas build -p ios` → `eas submit`
7. 機能拡張案: バックグラウンド位置情報(移動中も自動で塗る)、訪問日の記録・履歴表示

## データ出典
市区町村境界: [国土数値情報 行政区域データ (N03)](https://nlftp.mlit.go.jp/ksj/) を
[smartnews-smri/japan-topography](https://github.com/smartnews-smri/japan-topography) が軽量化したものを利用。
アプリ内にクレジット表記を入れること。
