# Wedding Seating Cloud Web公開手順（非エンジニア向け）

この資料は、Google Cloud をほぼ初めて使う人向けです。  
「とにかく公開する」ことを最優先に、迷いやすいポイントを含めて順番に書いています。

---

## 1. 事前に必要なもの
- Googleアカウント（GmailでOK）
- クレジットカード（Google Cloudの本人確認用。無料枠内なら請求0円で運用可能）
- 30〜60分程度の作業時間

---

## 2. まず理解しておく構成（やっていること）
このアプリは以下の2つで動きます。

1. **Cloud Run**: Webアプリ本体を公開する場所
2. **Firestore**: ユーザーデータ（席次、ゲスト情報）を保存するデータベース

つまり、Cloud Run が画面とAPIを提供し、Firestore がデータ保存先になります。

---

## 3. 初回セットアップ（画面操作）

### 3-1. Google Cloudプロジェクト作成
1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. 右上のプロジェクト選択から「新しいプロジェクト」
3. 任意の名前（例: `wedding-seating-app`）で作成

### 3-2. 課金を有効化
1. 左メニュー「お支払い」
2. 課金アカウントを紐付ける

### 3-3. 必要APIを有効化
Cloud Shell で以下を実行（後述の4章でCloud Shellを開きます）。

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com artifactregistry.googleapis.com
```

### 3-4. Firestoreを作成
1. 左メニュー「Firestore Database」
2. 「データベースの作成」
3. **Nativeモード** を選択
4. リージョンは Cloud Run と同じにする（例: `asia-northeast1`）

---

## 4. デプロイ（コピペで実行）

### 4-0. 先にGitHubへアップロード（推奨）
Cloud Run公開前に、まずGitHubへアップロードしておくと管理しやすいです。

1. GitHubで空リポジトリを作成（例: `wedding-seating-cloudrun`）
2. ターミナルでこのプロジェクトのルートに移動
3. 以下を実行（`YOUR_GITHUB_URL` はあなたのURLに置換）

```bash
git remote add origin YOUR_GITHUB_URL
git push -u origin main
```

これで「最新版コード」がGitHubに保存されます。

### 4-1. Cloud Shell を開く
Google Cloud Console 右上の `>_` アイコン（Cloud Shell）をクリック

### 4-2. ソースをアップロード
方法は2つあります。
- GitHubが使える場合: `git clone` して `wedding-seating-cloudrun` フォルダへ移動
- 使わない場合: このフォルダをZIPでCloud Shellにアップロード

移動コマンド（例）:
```bash
cd wedding-seating-cloudrun
```

### 4-3. プロジェクトIDを設定
```bash
gcloud config set project YOUR_PROJECT_ID
```

`YOUR_PROJECT_ID` は Cloud Console のプロジェクトID（英数字のID）に置き換えます。

### 4-4. コンテナをビルド
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/wedding-seating
```

### 4-5. Cloud Runへデプロイ
```bash
gcloud run deploy wedding-seating \
  --image gcr.io/YOUR_PROJECT_ID/wedding-seating \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```

完了すると URL が表示されます。これが公開URLです。

### 4-6. GitHubの内容を使って再デプロイする場合
コード更新後は、Cloud Shellで最新を取得して同じ手順を再実行します。

```bash
git pull
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/wedding-seating
gcloud run deploy wedding-seating \
  --image gcr.io/YOUR_PROJECT_ID/wedding-seating \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```

---

## 5. 動作確認（必ず実施）

公開URLを開いて、以下を確認してください。

1. 画面が表示される
2. ゲストを1名追加して「クラウド保存」を押す
3. ページを再読み込みして、追加したゲストが残っている
4. スマホでも同じURLを開き、操作できる

APIの疎通確認（ブラウザで開く）:
- `https://あなたのURL/api/health`

`{"ok":true,...}` が返ればサーバー自体は正常です。

---

## 6. PC/スマホの使い方の違い

- **PC**: ドラッグ&ドロップで席に配置
- **スマホ**: ゲストをタップして選択 → 席をタップして配置

スマホはドラッグしづらいので、タップ配置に最適化されています。

---

## 7. 共同利用のやり方

URLの `?p=xxxx` がプロジェクトIDです。  
このURLを共有すると、同じ席次データを見て編集できます。

- 例: `https://your-service-url/?p=mywedding2026`

---

## 8. よくあるトラブル

### 8-1. 保存できない
- Firestore が作成されていない
- Firestore のリージョンが未設定
- Cloud Run のサービスアカウント権限不足

### 8-2. デプロイで失敗する
- `YOUR_PROJECT_ID` の置換漏れ
- API未有効化
- 課金未設定

### 8-3. 画面は出るがデータが残らない
- `/api/health` がエラー
- Firestoreがまだ初期化されていない

---

## 9. 最低限の運用ルール（おすすめ）
- 本番URLは固定してブックマーク
- URLの `?p=` をプロジェクト単位で分ける（本番 / テスト）
- 重要イベント前日はCSV出力でバックアップ

---

## 10. もし私に次を依頼するなら
次の改善もすぐ対応できます。

1. ログイン機能（Googleログイン）
2. 招待状送付状況などの項目追加
3. 誤操作防止（削除確認、履歴復元）
4. 料金最適化（自動スケーリング調整）
