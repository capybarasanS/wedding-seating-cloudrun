# Wedding Seating Cloud (Cloud Run + Firestore)

結婚式席次管理アプリです。PCはドラッグ&ドロップ、スマホはタップ中心で操作できます。

## 非エンジニア向け公開手順
- [WEB公開手順_非エンジニア向け.md](./WEB公開手順_非エンジニア向け.md)

## 機能
- Cloud Run 上でフロント + API を 1 コンテナで提供
- Firestore にプロジェクトデータを保存
- CSVインポート / CSVエクスポート
- レスポンシブUI（PC/スマホ最適化）

## ローカル実行
```bash
npm install
npm run dev
```
- フロント: `http://localhost:5173`
- API: `http://localhost:8080`

## Firestore設定
Cloud Run で `Firestore Native mode` を有効化してください。

サーバーはデフォルトで Firestore を使用します。
- Firestoreを使わずテストする場合: `USE_FIRESTORE=false`

## Cloud Run デプロイ
```bash
gcloud config set project YOUR_PROJECT_ID
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/wedding-seating
gcloud run deploy wedding-seating \
  --image gcr.io/YOUR_PROJECT_ID/wedding-seating \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```

## API
- `GET /api/health`
- `GET /api/projects/:projectId`
- `PUT /api/projects/:projectId`

`projectId` はURLクエリ `?p=...` として保持されます。URL共有で同じデータを共同編集できます。
