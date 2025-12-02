# Case Progress API フロントエンド実装ガイド

## 📋 概要

このドキュメントは、`/api/case-progress` API を使用してケースの進捗を保存する方法を説明します。

## 🚀 クイックスタート

### 基本的な使用方法

```typescript
// ホスピタル名を送信
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: "your-case-id",
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
  caseId: string; // 必須: ケースID
  currentStep: string; // 必須: 現在のステップ
  stepData: object; // 必須: ステップデータ
}
```

### クエリパラメータ（オプション）

以下のクエリパラメータを指定すると、Google Sheets の UTM カラムに保存されます：

- `utm_source`: UTM ソース（例: `google`, `facebook`）
- `utm_campaign`: UTM キャンペーン（例: `summer2024`, `promo2024`）

**注意**: UTM パラメータは新規ケース作成時のみ保存されます。既存ケースの更新時は無視されます。

## 📦 ステップ別の実装例

### 1. Hospital Step（病院ステップ）

```typescript
// 基本的な送信
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: "case-123",
    currentStep: "hospital",
    stepData: {
      hospitalName: "St. Jude Medical Center",
      hospitalId: "123",
    },
  }),
});

// cityを含む送信（推奨）
await fetch("/api/case-progress", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    caseId: "case-123",
    currentStep: "hospital",
    stepData: {
      hospitalName: "St. Jude Medical Center",
      hospitalId: "123",
      city: "Tokyo", // ← 追加: Google SheetsのStateカラムに保存されます
    },
  }),
});
```

**重要**: `city`を送信すると、Google Sheets の`State`カラムに保存されます。送信しない場合、サーバーサイドで Vercel の geo 情報から自動取得を試みます。

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

UTM パラメータを送信するには、クエリパラメータとして追加します：

```typescript
// UTMパラメータ付きで送信
const utmSource = "google";
const utmCampaign = "summer2024";

await fetch(
  `/api/case-progress?utm_source=${utmSource}&utm_campaign=${utmCampaign}`,
  {
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
  }
);
```

### URL から UTM パラメータを取得する例

```typescript
// 現在のURLからUTMパラメータを取得
const urlParams = new URLSearchParams(window.location.search);
const utmSource = urlParams.get("utm_source");
const utmCampaign = urlParams.get("utm_campaign");

// UTMパラメータがある場合のみクエリに追加
let apiUrl = "/api/case-progress";
const queryParams = new URLSearchParams();
if (utmSource) queryParams.append("utm_source", utmSource);
if (utmCampaign) queryParams.append("utm_campaign", utmCampaign);
if (queryParams.toString()) {
  apiUrl += `?${queryParams.toString()}`;
}

await fetch(apiUrl, {
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
```

## 💻 React/Next.js 実装例

### カスタムフックの作成

```typescript
// src/hooks/useCaseProgress.ts
import { useCallback } from "react";

export function useCaseProgress() {
  const saveProgress = useCallback(
    async (
      caseId: string,
      currentStep: string,
      stepData: Record<string, unknown>,
      utmParams?: { utm_source?: string; utm_campaign?: string }
    ) => {
      try {
        // UTMパラメータをクエリに追加
        let url = "/api/case-progress";
        if (utmParams) {
          const queryParams = new URLSearchParams();
          if (utmParams.utm_source) {
            queryParams.append("utm_source", utmParams.utm_source);
          }
          if (utmParams.utm_campaign) {
            queryParams.append("utm_campaign", utmParams.utm_campaign);
          }
          if (queryParams.toString()) {
            url += `?${queryParams.toString()}`;
          }
        }

        const response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId,
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

export function HospitalForm({ caseId }: { caseId: string }) {
  const [hospitalName, setHospitalName] = useState("");
  const [city, setCity] = useState("");
  const { saveProgress } = useCaseProgress();

  // URLからUTMパラメータを取得
  const getUTMParams = () => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    const utm_source = params.get("utm_source");
    const utm_campaign = params.get("utm_campaign");
    if (utm_source || utm_campaign) {
      return {
        utm_source: utm_source || undefined,
        utm_campaign: utm_campaign || undefined,
      };
    }
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await saveProgress(
        caseId,
        "hospital",
        {
          hospitalName,
          city, // cityを送信
        },
        getUTMParams() // UTMパラメータを送信
      );

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

- UTM パラメータは**新規ケース作成時のみ**保存されます
- 既存ケースの更新時は、UTM パラメータがあっても無視されます
- クエリパラメータとして送信する必要があります（リクエストボディには含めません）

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
