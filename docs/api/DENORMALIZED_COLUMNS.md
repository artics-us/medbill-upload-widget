# Denormalized Columns（非正規化カラム）のベストプラクティス

## 概要

`cases` テーブルでは、`progress` JSONB を正本（Source of Truth）として保持しつつ、よく検索されるフィールドを抽出カラムとしても保存しています。これにより、高速な検索・フィルタリングが可能になります。

## 設計思想

### 1. 二重保存パターン（Denormalized Columns）

- **`progress` JSONB**: 完全なデータを保持（正本）
- **抽出カラム**: よく検索されるフィールドを個別カラムとして保存（パフォーマンス向上）

### 2. メリット

- ✅ **高速な検索**: インデックスを利用した高速なクエリが可能
- ✅ **運用ダッシュボード**: SQL で簡単にフィルタリング・集計が可能
- ✅ **データの完全性**: `progress` JSONB に完全なデータが保存されている
- ✅ **柔軟性**: 新しいステップが追加されても JSONB は拡張可能

### 3. デメリット

- ⚠️ **データの重複**: JSONB とカラムの両方に保存（ただし、同じトランザクション内で更新するため整合性は保証される）
- ⚠️ **同期の複雑さ**: 両方を更新する必要がある（ただし、API 内で自動的に処理される）

## 実装詳細

### 抽出されるカラム

| カラム名         | 抽出元ステップ | データ型   | 説明                 |
| ---------------- | -------------- | ---------- | -------------------- |
| `contact_email`  | `contact`      | `String?`  | 連絡先メールアドレス |
| `contact_phone`  | `contact`      | `String?`  | 連絡先電話番号       |
| `hospital_name`  | `hospital`     | `String?`  | 病院名               |
| `balance_amount` | `balance`      | `Decimal?` | 請求金額             |
| `in_collections` | `balance`      | `Boolean?` | 回収中フラグ         |

### 更新ロジック

1. **新しいステップデータが送信された場合**:

   - 該当するステップのデータから抽出カラムを更新
   - 他のステップの抽出カラムは既存の値を保持

2. **既存の値の保持**:

   - `contact` ステップが送信されても、`hospital_name` は既存の値を保持
   - 各ステップは独立して抽出カラムを更新

3. **`progress` JSONB との同期**:
   - 常に `progress` JSONB も更新される
   - 抽出カラムは `progress` JSONB のサブセット

## 使用例

### 高速な検索クエリ

```sql
-- メールアドレスで検索（インデックス利用）
SELECT * FROM cases WHERE contact_email = 'user@example.com';

-- 病院名で検索
SELECT * FROM cases WHERE hospital_name LIKE '%General%';

-- 請求金額でフィルタリング
SELECT * FROM cases WHERE balance_amount > 1000;

-- 回収中のケースを検索
SELECT * FROM cases WHERE in_collections = true;
```

### JSONB クエリとの比較

```sql
-- JSONB クエリ（遅い、インデックスが効きにくい）
SELECT * FROM cases
WHERE progress->>'contact'->>'email' = 'user@example.com';

-- 抽出カラムクエリ（高速、インデックス利用）
SELECT * FROM cases
WHERE contact_email = 'user@example.com';
```

## 既存データのバックフィル

既に `progress` JSONB にデータがあるが、抽出カラムが空の場合、以下の SQL でバックフィルできます：

```sql
-- contact_email のバックフィル
UPDATE cases
SET contact_email = progress->'contact'->>'email'
WHERE contact_email IS NULL
  AND progress->'contact'->>'email' IS NOT NULL;

-- contact_phone のバックフィル
UPDATE cases
SET contact_phone = progress->'contact'->>'phone'
WHERE contact_phone IS NULL
  AND progress->'contact'->>'phone' IS NOT NULL;

-- hospital_name のバックフィル
UPDATE cases
SET hospital_name = progress->'hospital'->>'hospitalName'
WHERE hospital_name IS NULL
  AND progress->'hospital'->>'hospitalName' IS NOT NULL;

-- balance_amount のバックフィル
UPDATE cases
SET balance_amount = (progress->'balance'->>'balanceAmount')::DECIMAL
WHERE balance_amount IS NULL
  AND progress->'balance'->>'balanceAmount' IS NOT NULL;

-- in_collections のバックフィル
UPDATE cases
SET in_collections = (progress->'balance'->>'inCollections')::BOOLEAN
WHERE in_collections IS NULL
  AND progress->'balance'->>'inCollections' IS NOT NULL;
```

## ベストプラクティス

### ✅ 推奨される使い方

1. **検索・フィルタリング**: 抽出カラムを使用
2. **完全なデータ取得**: `progress` JSONB を使用
3. **新しいステップ追加**: `progress` JSONB に保存し、必要に応じて抽出カラムを追加

### ❌ 避けるべき使い方

1. **抽出カラムのみに依存**: `progress` JSONB が正本であることを忘れない
2. **手動での抽出カラム更新**: API を通じて更新することで整合性を保つ
3. **抽出カラムの削除**: 既存のデータとの整合性が崩れる可能性がある

## 将来の拡張

新しいステップが追加された場合：

1. **`progress` JSONB**: 自動的に保存される（既存の実装で対応済み）
2. **抽出カラム**: 必要に応じてスキーマに追加し、API で抽出ロジックを追加

例：`insurance` ステップの `insuranceStatus` を抽出カラムにする場合：

```prisma
model Case {
  // ... existing fields
  insuranceStatus String? @map("insurance_status")
}
```

API の `switch` 文に以下を追加：

```typescript
case 'insurance': {
  const insuranceData = stepDataWithCity as InsuranceStepData;
  if (insuranceData.insuranceStatus) {
    updateData.insuranceStatus = insuranceData.insuranceStatus;
  }
  break;
}
```
