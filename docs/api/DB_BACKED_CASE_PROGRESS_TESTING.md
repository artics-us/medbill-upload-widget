# DB-Backed Case Progress API テスト手順

## 概要

`/api/case-progress` は Neon Postgres DB を正本（Source of Truth）として使用し、Google Sheets はベストエフォート同期として動作します。

## 前提条件

- Neon Postgres DB が接続済み
- Prisma migration が実行済み（`npx prisma migrate dev --name init`）
- 環境変数 `DATABASE_URL` が設定済み

## 1. 基本的な動作確認

### 1.1 API 呼び出しテスト

```bash
curl -X PUT http://localhost:3000/api/case-progress \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "550e8400-e29b-41d4-a716-446655440000",
    "currentStep": "hospital",
    "stepData": {
      "hospitalName": "Test Hospital",
      "city": "Tokyo"
    }
  }'
```

**期待されるレスポンス:**

```json
{
  "success": true,
  "caseId": "550e8400-e29b-41d4-a716-446655440000",
  "currentStep": "hospital",
  "submissionId": "生成されたUUID"
}
```

### 1.2 DB 確認 SQL

```sql
-- 最新のイベントを確認
SELECT * FROM case_progress_events
ORDER BY received_at DESC
LIMIT 20;

-- ケースの現在状態を確認
SELECT case_id, current_step, progress, updated_at
FROM cases
ORDER BY updated_at DESC
LIMIT 10;

-- 特定のケースの全イベントを確認
SELECT submission_id, step_key, payload, received_at
FROM case_progress_events
WHERE case_id = '550e8400-e29b-41d4-a716-446655440000'
ORDER BY received_at ASC;
```

## 2. 冪等性テスト

### 2.1 同じ submissionId で 2 回送信

```bash
SUBMISSION_ID="test-submission-$(date +%s)"

# 1回目
curl -X PUT http://localhost:3000/api/case-progress \
  -H "Content-Type: application/json" \
  -d "{
    \"submissionId\": \"$SUBMISSION_ID\",
    \"caseId\": \"550e8400-e29b-41d4-a716-446655440000\",
    \"currentStep\": \"billType\",
    \"stepData\": { \"billType\": \"emergency\" }
  }"

# 2回目（同じ submissionId）
curl -X PUT http://localhost:3000/api/case-progress \
  -H "Content-Type: application/json" \
  -d "{
    \"submissionId\": \"$SUBMISSION_ID\",
    \"caseId\": \"550e8400-e29b-41d4-a716-446655440000\",
    \"currentStep\": \"billType\",
    \"stepData\": { \"billType\": \"emergency\" }
  }"
```

**確認:**

```sql
-- submissionId で検索（1件のみ存在することを確認）
SELECT COUNT(*) FROM case_progress_events
WHERE submission_id = 'test-submission-...';
-- 結果: 1
```

### 2.2 異なる submissionId で同じステップを送信

異なる `submissionId` を使用すると、複数のイベントが作成されることを確認します。

## 3. JSONB progress マージテスト

### 3.1 複数ステップの保存

```bash
CASE_ID="550e8400-e29b-41d4-a716-446655440000"

# Step 1: hospital
curl -X PUT http://localhost:3000/api/case-progress \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": { \"hospitalName\": \"Hospital A\" }
  }"

# Step 2: balance
curl -X PUT http://localhost:3000/api/case-progress \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"balance\",
    \"stepData\": { \"balanceAmount\": 1000, \"inCollections\": false }
  }"
```

**確認:**

```sql
-- progress JSONB に両方のステップが含まれていることを確認
SELECT progress FROM cases WHERE case_id = '550e8400-e29b-41d4-a716-446655440000';
-- 期待: {"hospital": {...}, "balance": {...}}
```

## 4. Outbox パターンテスト

**重要**: Outbox パターンは**フロントエンド（クライアント側）**で動作します。
Base44 側のフロントエンドで `initializeOutboxFlush()` を呼び出す必要があります。

### 4.0 Base44 側での初期化確認

Base44 側のフロントエンドコードで以下が実装されていることを確認:

```typescript
import { initializeOutboxFlush } from "@/lib/base44-case-progress";

// React の場合
useEffect(() => {
  initializeOutboxFlush();
}, []);

// または vanilla JS の場合
// アプリ初期化時に一度だけ呼び出す
initializeOutboxFlush();
```

### 4.1 オフライン → オンラインでの再送

1. **Base44 側で `initializeOutboxFlush()` が呼び出されていることを確認**
2. **ブラウザの開発者ツールでネットワークをオフラインに設定**
3. **Base44 側で `saveCaseProgress()` を呼び出す**
4. **localStorage を確認:**
   ```javascript
   // ブラウザコンソールで実行
   JSON.parse(localStorage.getItem("base44_case_progress_outbox"));
   ```
5. **ネットワークをオンラインに戻す**
6. **`online` イベントで自動的に `flushOutbox()` が実行されることを確認**
   - または手動で実行:
   ```javascript
   import { flushOutbox } from "@/lib/base44-case-progress";
   await flushOutbox();
   ```
7. **DB で保存されたことを確認**

### 4.2 ページロード時の自動フラッシュ

1. **Base44 側で `initializeOutboxFlush()` が呼び出されていることを確認**
2. **オフライン状態で複数の `saveCaseProgress()` を呼び出す**
3. **ページをリロード**
4. **ページロード時に自動的に `flushOutbox()` が実行されることを確認**
5. **オンライン復帰時に自動的にフラッシュされることを確認**

## 5. エラーハンドリングテスト

### 5.1 無効なリクエスト

```bash
# caseId なし
curl -X PUT http://localhost:3000/api/case-progress \
  -H "Content-Type: application/json" \
  -d '{"currentStep": "hospital", "stepData": {}}'
# 期待: 400 Bad Request, success: false

# 無効なステップデータ
curl -X PUT http://localhost:3000/api/case-progress \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "550e8400-e29b-41d4-a716-446655440000",
    "currentStep": "hospital",
    "stepData": {}
  }'
# 期待: 400 Bad Request, success: false
```

### 5.2 DB 接続エラー（リトライ可能）

`DATABASE_URL` を一時的に無効にして、`retryable: true` と `503` ステータスが返ることを確認します。

## 6. Sheets 同期のベストエフォート確認

### 6.1 Sheets 設定を無効にしてテスト

1. **`GOOGLE_SHEETS_SPREADSHEET_ID` を一時的に削除または無効化**
2. **API を呼び出す**
3. **レスポンスに `warning` が含まれるが `success: true` であることを確認**
4. **DB には保存されていることを確認**

## 7. パフォーマンス確認

### 7.1 大量リクエスト

```bash
# 100件のリクエストを並列送信
for i in {1..100}; do
  curl -X PUT http://localhost:3000/api/case-progress \
    -H "Content-Type: application/json" \
    -d "{
      \"caseId\": \"550e8400-e29b-41d4-a716-446655440000\",
      \"currentStep\": \"hospital\",
      \"stepData\": { \"hospitalName\": \"Hospital $i\" }
    }" &
done
wait
```

**確認:**

- すべてのリクエストが成功する
- DB に 100 件のイベントが作成される（submissionId が異なる場合）

## 8. 受け入れ基準チェックリスト

- [ ] 同じ `submissionId` を 2 回送っても `case_progress_events` の行が 2 つ増えない
- [ ] API が `success:true` を返したら、DB には必ず記録がある
- [ ] `currentStep` は任意文字列でも保存できる（未知 step は object 形状チェックだけで OK）
- [ ] Sheets 失敗は API 成功に影響しない（DB 成功が最優先）
- [ ] Outbox により一時的なネットワーク障害でも最終的に保存される

## トラブルシューティング

### DB 接続エラー

```bash
# Prisma Client を再生成
npx prisma generate

# Migration 状態を確認
npx prisma migrate status
```

### Outbox が動作しない

- localStorage が有効か確認
- ブラウザコンソールでエラーを確認
- `getOutboxStatus()` で状態を確認

### Sheets 同期が失敗する

- 環境変数 `GOOGLE_SHEETS_SPREADSHEET_ID` と `GCP_SERVICE_ACCOUNT_KEY` を確認
- サービスアカウントにスプレッドシートへのアクセス権限があるか確認
- API 成功は維持されるため、警告ログのみで問題なし
