# Mixpanel トラッキング API フロントエンド実装ガイド

## 📋 概要

このドキュメントは、フロントエンドから Mixpanel トラッキング API を使用する方法を説明します。

バックエンド API（`/api/mixpanel/track`）を使用することで、ブラウザのアドブロッカーやプライバシー設定の影響を受けずに、確実にイベントをトラッキングできます。

## 🚀 クイックスタート

### 基本的な使用方法

```typescript
// イベント名のみ（最小限）
await fetch("/api/mixpanel/track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ event: "Page View" }),
});

// 匿名ID付き
await fetch("/api/mixpanel/track", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    event: "Hospital Submitted",
    distinct_id: "anonymous-user-123",
  }),
});
```

## 📦 trackEvent 関数の実装

### 推奨実装（TypeScript）

```typescript
// src/lib/analytics.ts または src/utils/analytics.ts

/**
 * Mixpanelイベントをトラッキングする
 *
 * @param eventName - イベント名（必須）
 * @param distinctId - ユーザー識別子（オプション、匿名ID可）
 * @param properties - 追加プロパティ（オプション、空オブジェクト推奨）
 */
export const trackEvent = async (
  eventName: string,
  distinctId?: string,
  properties: Record<string, unknown> = {}
): Promise<void> => {
  try {
    await fetch("/api/mixpanel/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: eventName,
        distinct_id: distinctId,
        properties: properties,
      }),
    });
    // Fire and Forget - レスポンスを待たない
  } catch (error) {
    // エラーはログに記録するが、ユーザー体験を妨げない
    console.error("Track event error:", error);
  }
};
```

### JavaScript 版

```javascript
// src/lib/analytics.js

export const trackEvent = async (eventName, distinctId, properties = {}) => {
  try {
    await fetch("/api/mixpanel/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: eventName,
        distinct_id: distinctId,
        properties: properties,
      }),
    });
  } catch (error) {
    console.error("Track event error:", error);
  }
};
```

## 📝 トラッキング対象イベント一覧

### Landing Page（ランディングページ）

| イベント名                     | トリガー               |
| ------------------------------ | ---------------------- |
| `Page View`                    | ページ表示時           |
| `CTA Clicked Hero`             | Hero CTA クリック      |
| `CTA Clicked Urgency`          | Urgency CTA クリック   |
| `CTA Clicked Pricing`          | Pricing CTA クリック   |
| `CTA Clicked HowItWorks Step1` | Step1 CTA クリック     |
| `CTA Clicked HowItWorks Step2` | Step2 CTA クリック     |
| `CTA Clicked HowItWorks Step3` | Step3 CTA クリック     |
| `CTA Clicked WhoItsFor`        | WhoItsFor CTA クリック |
| `CTA Clicked FinalCTA`         | Final CTA クリック     |

### Hospital Page（病院ページ）

| イベント名             | トリガー       |
| ---------------------- | -------------- |
| `Hospital Submitted`   | 病院名送信時   |
| `No Hospital Selected` | 病院なし選択時 |

### Bill Type Page（請求タイプページ）

| イベント名           | トリガー         |
| -------------------- | ---------------- |
| `Bill Type Selected` | 請求タイプ選択時 |

### Balance Page（残高ページ）

| イベント名          | トリガー   |
| ------------------- | ---------- |
| `Balance Submitted` | 残高送信時 |

### Insurance Page（保険ページ）

| イベント名                  | トリガー             |
| --------------------------- | -------------------- |
| `Insurance Status Selected` | 保険ステータス選択時 |

### Next Steps Page

| イベント名              | トリガー            |
| ----------------------- | ------------------- |
| `CTA Clicked NextSteps` | Continue クリック時 |

### Contact Page（連絡先ページ）

| イベント名               | トリガー             |
| ------------------------ | -------------------- |
| `Contact Form Submitted` | 連絡先フォーム送信時 |

### Upload Page（アップロードページ）

| イベント名         | トリガー           |
| ------------------ | ------------------ |
| `Upload Completed` | アップロード完了時 |

### Done Page（完了ページ）

| イベント名                      | トリガー                  |
| ------------------------------- | ------------------------- |
| `Schedule Consultation Clicked` | Calendly ボタンクリック時 |

## 💻 React/Next.js 実装例

### 例 1: ページビューのトラッキング

```typescript
// src/app/hospital/page.tsx または src/pages/hospital.tsx
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function HospitalPage() {
  useEffect(() => {
    // ページ表示時にトラッキング
    trackEvent("Page View");
  }, []);

  return <div>{/* ページコンテンツ */}</div>;
}
```

### 例 2: ボタンクリックのトラッキング

```typescript
// src/components/HeroCTA.tsx
import { trackEvent } from "@/lib/analytics";

export function HeroCTA() {
  const handleClick = () => {
    // CTAクリックをトラッキング
    trackEvent("CTA Clicked Hero");

    // その他の処理...
  };

  return <button onClick={handleClick}>Get Started</button>;
}
```

### 例 3: フォーム送信のトラッキング

```typescript
// src/components/HospitalForm.tsx
import { trackEvent } from "@/lib/analytics";

export function HospitalForm() {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // フォーム送信をトラッキング
    trackEvent("Hospital Submitted");

    // フォーム送信処理...
  };

  return <form onSubmit={handleSubmit}>{/* フォームフィールド */}</form>;
}
```

### 例 4: 匿名 ID を使用したトラッキング

```typescript
// src/app/upload/page.tsx
import { trackEvent } from "@/lib/analytics";
import { useSessionStorage } from "@/hooks/useSessionStorage"; // 例

export default function UploadPage() {
  const [anonymousId] = useSessionStorage(
    "anonymous_id",
    () => `anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  const handleUploadComplete = () => {
    trackEvent("Upload Completed", anonymousId);
  };

  return <div>{/* アップロードコンポーネント */}</div>;
}
```

### 例 5: Next.js App Router での使用

```typescript
// src/app/contact/page.tsx
"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function ContactPage() {
  useEffect(() => {
    trackEvent("Page View");
  }, []);

  const handleFormSubmit = () => {
    trackEvent("Contact Form Submitted");
  };

  return <div>{/* ページコンテンツ */}</div>;
}
```

### 例 6: カスタムフックの作成

```typescript
// src/hooks/useTracking.ts
import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";

export function useTracking() {
  const track = useCallback((eventName: string, distinctId?: string) => {
    trackEvent(eventName, distinctId);
  }, []);

  return { track };
}

// 使用例
function MyComponent() {
  const { track } = useTracking();

  const handleClick = () => {
    track("CTA Clicked Hero");
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

## ⚠️ HIPAA 準拠の注意事項

### ❌ 送信禁止データ（PII/PHI）

以下のデータは**絶対に送信しないでください**。バックエンドで自動的に除外されますが、フロントエンドから送信しないことが推奨されます：

- `email` - メールアドレス
- `phone` - 電話番号
- `hospitalName` - 病院名（具体的な名称）
- `hospitalId` - 病院 ID
- `balance` / `balanceAmount` - 請求金額
- `insuranceStatus` - 保険状況の詳細
- `billType` / `billToken` - 請求書タイプ/トークン
- `caseId` - ケース ID
- `name` / `firstName` / `lastName` - 氏名
- `address` / `zipCode` / `city` / `state` - 住所情報

### ✅ 送信可能データ

- **イベント名のみ**（推奨）
- 匿名の `distinct_id`
- タイムスタンプ（自動付与）
- PII/PHI を含まない安全なプロパティ

### 推奨パターン

```typescript
// ✅ 良い例：イベント名のみ
trackEvent("Hospital Submitted");

// ✅ 良い例：匿名IDのみ
trackEvent("Page View", "anonymous-user-123");

// ✅ 良い例：空のproperties
trackEvent("Contact Form Submitted", undefined, {});

// ❌ 悪い例：PIIを含む
trackEvent("Contact Form Submitted", undefined, {
  email: "user@example.com", // ❌ 禁止
  phone: "555-1234", // ❌ 禁止
  hospitalName: "St. Jude", // ❌ 禁止
});
```

## 🔧 エラーハンドリング

API は**Fire and Forget**パターンで実装されているため、エラーが発生してもユーザー体験に影響を与えません。

```typescript
// エラーハンドリングは既にtrackEvent関数内で実装済み
trackEvent("Page View"); // エラーが発生しても例外を投げない

// 明示的にエラーハンドリングしたい場合
try {
  await trackEvent("Page View");
} catch (error) {
  // 通常は到達しない（trackEvent内でcatch済み）
  console.error("Unexpected error:", error);
}
```

## 📊 リクエスト形式

### リクエストボディ

```typescript
{
  event: string;           // 必須: イベント名
  distinct_id?: string;    // オプション: ユーザー識別子（デフォルト: "anonymous"）
  properties?: object;     // オプション: 追加プロパティ（空オブジェクト推奨）
}
```

### レスポンス

```typescript
// 成功時 (200)
{
  success: true;
}

// エラー時 (400)
{
  error: "Event name required";
}
```

## 🎯 実装チェックリスト

- [ ] `trackEvent`関数を実装（`src/lib/analytics.ts`など）
- [ ] 各ページで`Page View`イベントをトラッキング
- [ ] 各 CTA ボタンでクリックイベントをトラッキング
- [ ] フォーム送信時に適切なイベントをトラッキング
- [ ] PII/PHI データを送信していないことを確認
- [ ] エラーハンドリングが適切に実装されていることを確認

## 🔍 デバッグ

### 開発環境での確認

ブラウザの開発者ツールの Network タブで、`/api/mixpanel/track`へのリクエストを確認できます：

1. 開発者ツールを開く（F12）
2. Network タブを選択
3. フィルターに`mixpanel`と入力
4. イベントをトリガー
5. リクエストの Payload を確認

### コンソールログ

```typescript
// デバッグ用のログを追加（開発環境のみ）
export const trackEvent = async (
  eventName: string,
  distinctId?: string,
  properties: Record<string, unknown> = {}
) => {
  if (process.env.NODE_ENV === "development") {
    console.log("Tracking event:", { eventName, distinctId, properties });
  }

  try {
    await fetch("/api/mixpanel/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: eventName,
        distinct_id: distinctId,
        properties: properties,
      }),
    });
  } catch (error) {
    console.error("Track event error:", error);
  }
};
```

## ❓ よくある質問

### Q: なぜバックエンド API を使うのですか？

A: ブラウザのアドブロッカーやプライバシー設定の影響を受けずに、確実にイベントをトラッキングするためです。

### Q: `distinct_id`は必須ですか？

A: いいえ、オプションです。指定しない場合は`"anonymous"`が使用されます。

### Q: `properties`は必須ですか？

A: いいえ、オプションです。HIPAA 準拠のため、空オブジェクト`{}`を推奨します。

### Q: エラーが発生した場合、ユーザーに影響はありますか？

A: いいえ、Fire and Forget パターンのため、エラーが発生してもユーザー体験に影響はありません。

### Q: 既存の Mixpanel SDK コードを置き換える必要がありますか？

A: はい、フロントエンドの Mixpanel SDK コードをこの API を使用するように変更してください。

### Q: 本番環境と開発環境で異なる動作をさせたい場合は？

A: 環境変数や設定ファイルを使用して、開発環境ではログを出力し、本番環境ではサイレントに実行するように実装できます。

## 📚 関連ドキュメント

- [CURL Examples](./CURL_EXAMPLES.md) - API の詳細なテスト例
- [API README](../README.md) - 全体的な API ドキュメント

## 🆘 サポート

実装に関する質問や問題がある場合は、バックエンドチームに連絡してください。
