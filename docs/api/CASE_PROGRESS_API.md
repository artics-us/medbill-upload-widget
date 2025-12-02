# Case Progress API フロントエンド実装ガイド

## 📋 概要

このドキュメントは、`/api/case-progress` API を使用してケースの進捗を保存する方法を説明します。

## 🚀 クイックスタート

### 基本的な使用方法

```typescript
// caseIdを生成（新規ケースの場合）
const caseId = crypto.randomUUID(); // または window.crypto.randomUUID()

// ホスピタル名を送信
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: caseId, // 必須: フロントエンドで生成
    currentStep: "hospital",
    stepData: {
      hospitalName: "Hospital Name",
      hospitalId: "123",
    },
  }),
});
```

## 📝 API 仕様

### エンドポイント

```
PUT /api/case-progress
```

### リクエスト形式

```typescript
{
  caseId: string; // 必須: ケースID（フロントエンドで生成、UUID推奨）
  currentStep: string; // 必須: 現在のステップ
  stepData: object; // 必須: ステップデータ
}
```

**重要**: `caseId`は必須です。新規ケース作成時は、フロントエンド側で UUID を生成して送信してください。

```typescript
// caseIdの生成例
const caseId = crypto.randomUUID(); // ブラウザ環境
// または
const caseId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`; // フォールバック
```

### stepData の形式（Hospital Step の場合）

Hospital Step では、以下のフィールドを `stepData` に含めることができます：

- `hospitalName`: string（必須）- 病院名
- `hospitalId`: string | null（オプション）- 病院 ID
- `city`: string | null（オプション）- 都市名（Google Sheets の `State` カラムに保存）
- `utm_source`: string | null（オプション）- UTM ソース（Google Sheets の `UTM Source` カラムに保存）
- `utm_campaign`: string | null（オプション）- UTM キャンペーン（Google Sheets の `UTM Campaign` カラムに保存）

**注意**: UTM パラメータ（`utm_source`, `utm_campaign`）は `hospital` ステップの時のみ送信でき、新規ケース作成時のみ保存されます。既存ケースの更新時は無視されます。

## 📦 ステップ別の実装例

### 1. Hospital Step（病院ステップ）

```typescript
// caseIdを生成（新規ケースの場合）
const caseId = crypto.randomUUID();

// 基本的な送信
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: caseId, // 必須: フロントエンドで生成
    currentStep: "hospital",
    stepData: {
      hospitalName: "St. Jude Medical Center",
      hospitalId: "123",
    },
  }),
});

// caseIdを生成
const caseId = crypto.randomUUID();

// cityを含む送信（推奨）
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: caseId, // 必須: フロントエンドで生成
    currentStep: "hospital",
    stepData: {
      hospitalName: "St. Jude Medical Center",
      hospitalId: "123",
      city: "Tokyo", // ← 追加: Google SheetsのStateカラムに保存されます
    },
  }),
});

// city + UTMパラメータを含む送信（推奨）
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: caseId, // 必須: フロントエンドで生成
    currentStep: "hospital",
    stepData: {
      hospitalName: "St. Jude Medical Center",
      hospitalId: "123",
      city: "Tokyo", // ← Google SheetsのStateカラムに保存
      utm_source: "google", // ← Google SheetsのUTM Sourceカラムに保存
      utm_campaign: "summer2024", // ← Google SheetsのUTM Campaignカラムに保存
    },
  }),
});
```

**重要**:

- `city`を送信すると、Google Sheets の`State`カラムに保存されます。送信しない場合、サーバーサイドで Vercel の geo 情報から自動取得を試みます。
- `utm_source`と`utm_campaign`は`hospital`ステップの時のみ送信でき、新規ケース作成時のみ保存されます。

### 2. Bill Type Step（請求タイプステップ）

```typescript
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: "case-123",
    currentStep: "billType",
    stepData: {
      billType: "Emergency Room",
    },
  }),
});
```

### 3. Balance Step（残高ステップ）

```typescript
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: "case-123",
    currentStep: "balance",
    stepData: {
      balanceAmount: 1500.75,
      inCollections: false,
    },
  }),
});
```

### 4. Insurance Step（保険ステップ）

```typescript
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: "case-123",
    currentStep: "insurance",
    stepData: {
      insuranceStatus: "Uninsured",
    },
  }),
});
```

### 5. Contact Step（連絡先ステップ）

```typescript
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: "case-123",
    currentStep: "contact",
    stepData: {
      email: "user@example.com",
      phone: "555-123-4567",
      agreedToTerms: true,
    },
  }),
});
```

## 🎯 UTM パラメータの送信

UTM パラメータを送信するには、`hospital`ステップの`stepData`に含めます：

```typescript
// UTMパラメータ付きで送信
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: "case-123",
    currentStep: "hospital",
    stepData: {
      hospitalName: "Hospital Name",
      city: "Tokyo",
      utm_source: "google", // ← stepDataに含める
      utm_campaign: "summer2024", // ← stepDataに含める
    },
  }),
});
```

### URL から UTM パラメータを取得する例

```typescript
// 現在のURLからUTMパラメータを取得してstepDataに含める
const urlParams = new URLSearchParams(window.location.search);
const utmSource = urlParams.get("utm_source");
const utmCampaign = urlParams.get("utm_campaign");

const stepData: Record<string, unknown> = {
  hospitalName: "Hospital Name",
  city: "Tokyo",
};

// UTMパラメータがある場合のみstepDataに追加
if (utmSource) {
  stepData.utm_source = utmSource;
}
if (utmCampaign) {
  stepData.utm_campaign = utmCampaign;
}

await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: "case-123",
    currentStep: "hospital",
    stepData,
  }),
});
```

## 💻 React/Next.js 実装例

### カスタムフックの作成

```typescript
// src/hooks/useCaseProgress.ts
import { useCallback } from "react";

// caseIdを生成するヘルパー関数
function generateCaseId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  // フォールバック
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export function useCaseProgress() {
  const saveProgress = useCallback(
    async (
      caseId: string | null, // nullの場合は新規生成
      currentStep: string,
      stepData: Record<string, unknown>
    ) => {
      try {
        // caseIdが提供されていない場合は生成
        const finalCaseId = caseId || generateCaseId();

        const response = await fetch("/api/case-progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: finalCaseId,
            currentStep,
            stepData,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to save progress: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        console.error("Error saving case progress:", error);
        throw error;
      }
    },
    []
  );

  return { saveProgress };
}
```

### 使用例

```typescript
// src/components/HospitalForm.tsx
import { useState } from "react";
import { useCaseProgress } from "@/hooks/useCaseProgress";

export function HospitalForm({ caseId }: { caseId: string | null }) {
  const [hospitalName, setHospitalName] = useState("");
  const [city, setCity] = useState("");
  const { saveProgress } = useCaseProgress();

  // URLからUTMパラメータを取得してstepDataに含める
  const getStepData = () => {
    const stepData: Record<string, unknown> = {
      hospitalName,
      city, // cityを送信
    };

    // URLからUTMパラメータを取得
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const utm_source = params.get("utm_source");
      const utm_campaign = params.get("utm_campaign");
      if (utm_source) {
        stepData.utm_source = utm_source;
      }
      if (utm_campaign) {
        stepData.utm_campaign = utm_campaign;
      }
    }

    return stepData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await saveProgress(caseId, "hospital", getStepData());

      // 成功時の処理
      console.log("Hospital data saved successfully");
    } catch (error) {
      console.error("Failed to save hospital data:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={hospitalName}
        onChange={(e) => setHospitalName(e.target.value)}
        placeholder="Hospital Name"
        required
      />
      <input
        type="text"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="City (optional)"
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## 📊 Google Sheets への保存内容

### カラムマッピング

| データキー        | Google Sheets カラム名 |
| ----------------- | ---------------------- |
| `caseId`          | `Case ID`              |
| `hospitalName`    | `Hospital name`        |
| `city`            | `State`                |
| `currentStep`     | `Last Done Page`       |
| `utm_source`      | `UTM Source`           |
| `utm_campaign`    | `UTM Campaign`         |
| `email`           | `Email`                |
| `phone`           | `Phone`                |
| `billType`        | `Bill type`            |
| `balanceAmount`   | `Balance amount`       |
| `inCollections`   | `In collections`       |
| `insuranceStatus` | `Insurance status`     |

### 重要な変更点

1. **`Current step` → `Last Done Page`**: カラム名が変更されました
2. **`city` → `State`**: `city`を送信すると、`State`カラムに保存されます
3. **UTM パラメータ**: クエリパラメータから自動取得され、新規ケース作成時のみ保存されます

## ⚠️ 注意事項

### UTM パラメータについて

- UTM パラメータ（`utm_source`, `utm_campaign`）は`hospital`ステップの時のみ送信できます
- `stepData`の中に含めて送信します（クエリパラメータではありません）
- **新規ケース作成時のみ**保存されます
- 既存ケースの更新時は、UTM パラメータがあっても無視されます

### city パラメータについて

- `city`はオプショナルです
- 送信しない場合、サーバーサイドで Vercel の geo 情報から自動取得を試みます
- フロントエンドから明示的に送信することを推奨します（より正確なデータのため）

### エラーハンドリング

```typescript
try {
  const response = await fetch("/api/case-progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: "case-123",
      currentStep: "hospital",
      stepData: {
        hospitalName: "Hospital Name",
        city: "Tokyo",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("Error:", error.error);
    return;
  }

  const result = await response.json();
  console.log("Success:", result);

  // warningがある場合（Google Sheets保存失敗など）
  if (result.warning) {
    console.warn("Warning:", result.warning);
  }
} catch (error) {
  console.error("Network error:", error);
}
```

## 🔍 レスポンス形式

### 成功時 (200)

```json
{
  "success": true,
  "caseId": "case-123",
  "currentStep": "hospital",
  "message": "Step \"hospital\" saved successfully"
}
```

### エラー時 (400)

```json
{
  "error": "hospitalName is required and must be a string"
}
```

### 警告付き成功時 (200)

Google Sheets への保存に失敗した場合でも、API は成功を返しますが、警告が含まれます：

```json
{
  "success": true,
  "caseId": "case-123",
  "currentStep": "hospital",
  "message": "Step \"hospital\" saved successfully",
  "warning": "Failed to save to Google Sheets. Check server logs for details."
}
```

## 📚 関連ドキュメント

- [CURL Examples](./CURL_EXAMPLES.md) - API の詳細なテスト例
- [API README](../README.md) - 全体的な API ドキュメント

## 🆘 サポート

実装に関する質問や問題がある場合は、バックエンドチームに連絡してください。
