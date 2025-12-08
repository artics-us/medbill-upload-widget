# Brevo Double Opt-In API フロントエンド実装ガイド

## 📋 概要

このドキュメントは、`/api/brevo-doi` API を使用してBrevoのDouble Opt-In（DOI）メールを送信する方法を説明します。

Double Opt-Inは、ユーザーがメールアドレスを登録した際に、確認メールを送信して本人確認を行うための仕組みです。ユーザーがメール内のリンクをクリックすることで、メールアドレスの有効性が確認されます。

## 🚀 クイックスタート

### 基本的な使用方法

```typescript
const response = await fetch("/api/brevo-doi", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "user@example.com",
  }),
});

const result = await response.json();
if (result.ok) {
  console.log("Double Opt-In email sent successfully");
} else {
  console.error("Failed to send DOI email:", result.error);
}
```

## 📝 API 仕様

### エンドポイント

```
POST /api/brevo-doi
```

### リクエスト形式

```typescript
{
  email: string; // 必須: メールアドレス
}
```

### レスポンス形式

#### 成功時 (200)

```json
{
  "ok": true,
  "status": "sent",
  "data": { ... } // Brevo APIからのレスポンス（存在する場合）
}
```

#### 設定不備時 (200)

サーバー側でBrevoの設定が不完全な場合：

```json
{
  "ok": false,
  "status": "skipped",
  "error": "Brevo DOI is not fully configured on the server."
}
```

#### 失敗時 (200)

Brevo APIの呼び出しに失敗した場合：

```json
{
  "ok": false,
  "status": "failed",
  "error": "Brevo DOI failed with status 400: ..."
}
```

#### エラー時 (400, 500)

リクエストのバリデーションエラーやサーバーエラー：

```json
{
  "error": "email is required."
}
```

または

```json
{
  "error": "Internal error in /api/brevo-doi"
}
```

## 💻 React/Next.js 実装例

### カスタムフックの作成

```typescript
// src/hooks/useBrevoDOI.ts
import { useCallback, useState } from "react";

type BrevoDOIStatus = "idle" | "loading" | "success" | "error" | "skipped";

type BrevoDOIResult = {
  ok: boolean;
  status: "sent" | "failed" | "skipped";
  error?: string;
  data?: unknown;
};

export function useBrevoDOI() {
  const [status, setStatus] = useState<BrevoDOIStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const sendDOI = useCallback(async (email: string): Promise<BrevoDOIResult> => {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/brevo-doi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const result: BrevoDOIResult = await response.json();

      if (!response.ok) {
        // HTTPエラー（400, 500など）
        setStatus("error");
        setError(result.error || "Failed to send DOI email");
        return result;
      }

      if (result.ok && result.status === "sent") {
        setStatus("success");
        return result;
      } else if (result.status === "skipped") {
        setStatus("skipped");
        setError(result.error || "Brevo DOI is not configured");
        return result;
      } else {
        setStatus("error");
        setError(result.error || "Failed to send DOI email");
        return result;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Network error";
      setStatus("error");
      setError(errorMessage);
      return {
        ok: false,
        status: "failed",
        error: errorMessage,
      };
    }
  }, []);

  return {
    sendDOI,
    status,
    error,
    isLoading: status === "loading",
    isSuccess: status === "success",
    isError: status === "error",
    isSkipped: status === "skipped",
  };
}
```

### 使用例

#### 基本的な使用例

```typescript
// src/components/ContactForm.tsx
import { useState } from "react";
import { useBrevoDOI } from "@/hooks/useBrevoDOI";

export function ContactForm() {
  const [email, setEmail] = useState("");
  const { sendDOI, isLoading, isSuccess, isError, error } = useBrevoDOI();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await sendDOI(email);

    if (result.ok && result.status === "sent") {
      // 成功時の処理
      alert("確認メールを送信しました。メールボックスを確認してください。");
    } else if (result.status === "skipped") {
      // 設定不備の場合（開発環境など）
      console.warn("Brevo DOI is not configured:", result.error);
      // 通常のフォーム送信処理を続行
    } else {
      // エラー時の処理
      alert(`エラーが発生しました: ${result.error}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        disabled={isLoading}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "送信中..." : "送信"}
      </button>
      {isSuccess && <p>確認メールを送信しました</p>}
      {isError && <p>エラー: {error}</p>}
    </form>
  );
}
```

#### ケース送信と組み合わせた使用例

```typescript
// src/components/SubmitCaseForm.tsx
import { useState } from "react";
import { useBrevoDOI } from "@/hooks/useBrevoDOI";

export function SubmitCaseForm() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const { sendDOI } = useBrevoDOI();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 1. ケース情報を送信
      const caseResponse = await fetch("/api/submit-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: "bill-123",
          email,
          phone,
          // ... その他のケース情報
        }),
      });

      if (!caseResponse.ok) {
        throw new Error("Failed to submit case");
      }

      // 2. Brevo DOIを送信（ケース送信成功後）
      const doiResult = await sendDOI(email);

      if (doiResult.ok && doiResult.status === "sent") {
        console.log("Case submitted and DOI email sent");
        // 成功画面に遷移
      } else if (doiResult.status === "skipped") {
        // DOIが設定されていない場合でも、ケース送信は成功しているので続行
        console.warn("Case submitted, but DOI email was skipped");
      } else {
        // DOI送信に失敗した場合でも、ケース送信は成功しているので続行
        console.error("Case submitted, but DOI email failed:", doiResult.error);
      }
    } catch (error) {
      console.error("Failed to submit case:", error);
      alert("エラーが発生しました");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone"
      />
      <button type="submit">送信</button>
    </form>
  );
}
```

#### 非同期処理を待たない使用例

```typescript
// DOI送信をバックグラウンドで実行し、結果を待たない
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // ケース送信
  await fetch("/api/submit-case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, /* ... */ }),
  });

  // DOI送信は非同期で実行（エラーハンドリングは最小限）
  sendDOI(email).catch((err) => {
    console.error("DOI email failed (non-blocking):", err);
  });

  // ユーザーには即座に成功画面を表示
  navigate("/success");
};
```

## ⚠️ 注意事項

### ステータスの意味

- **`sent`**: Brevo APIへの呼び出しが成功し、確認メールが送信されました
- **`skipped`**: サーバー側でBrevoの設定が不完全なため、DOI送信がスキップされました（開発環境などでよく発生）
- **`failed`**: Brevo APIへの呼び出しが失敗しました（メールアドレスの形式エラー、APIキーの問題など）

### エラーハンドリングの推奨事項

1. **`status: "skipped"`の場合**: 開発環境や設定不備の場合によく発生します。ユーザーには通常のフォーム送信が成功したことを伝え、DOIメールについては言及しないことを推奨します。

2. **`status: "failed"`の場合**: Brevo APIのエラーが発生しています。ログに記録し、必要に応じてユーザーに通知しますが、通常のフォーム送信処理は続行することを推奨します。

3. **HTTPエラー（400, 500）の場合**: リクエストのバリデーションエラーやサーバーエラーです。適切なエラーメッセージをユーザーに表示してください。

### メール送信のタイミング

- **推奨**: ケース送信やフォーム送信が成功した**後**にDOIメールを送信することを推奨します
- **理由**: メインの処理が成功していることを確認してから、補助的な機能（DOIメール）を実行することで、ユーザー体験を損なわないようにできます

### CORSについて

このAPIはCORSに対応しています。`BASE44_ORIGIN`環境変数で許可されたオリジンからのリクエストのみを受け付けます。

## 🔍 レスポンス例

### 成功時のレスポンス

```json
{
  "ok": true,
  "status": "sent",
  "data": null
}
```

### 設定不備時のレスポンス

```json
{
  "ok": false,
  "status": "skipped",
  "error": "Brevo DOI is not fully configured on the server."
}
```

### Brevo APIエラー時のレスポンス

```json
{
  "ok": false,
  "status": "failed",
  "error": "Brevo DOI failed with status 400: {\"code\":\"invalid_parameter\",\"message\":\"Email is invalid\"}"
}
```

### バリデーションエラー時のレスポンス

```json
{
  "error": "email is required."
}
```

## 🧪 テスト方法

### curlでのテスト

```bash
# 成功ケース
curl -X POST http://localhost:3000/api/brevo-doi \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# エラーケース（emailなし）
curl -X POST http://localhost:3000/api/brevo-doi \
  -H "Content-Type: application/json" \
  -d '{}'
```

### ブラウザでのテスト

```typescript
// ブラウザのコンソールで実行
fetch("/api/brevo-doi", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "test@example.com" }),
})
  .then((res) => res.json())
  .then((data) => console.log(data))
  .catch((err) => console.error(err));
```

## 📚 関連ドキュメント

- [Case Progress API Guide](./CASE_PROGRESS_API.md) - ケース進捗保存API
- [CURL Examples](./CURL_EXAMPLES.md) - API の詳細なテスト例
- [API README](../README.md) - 全体的な API ドキュメント

## 🆘 サポート

実装に関する質問や問題がある場合は、バックエンドチームに連絡してください。

## 🔧 サーバー側の設定

このAPIを使用するには、サーバー側で以下の環境変数が設定されている必要があります：

- `BREVO_API_KEY` - Brevo APIキー
- `BREVO_REDIRECT_URL` - 確認メール内のリダイレクトURL
- `BREVO_INCLUDE_LIST_ID` - 含めるリストID
- `BREVO_EXCLUDE_LIST_ID` - 除外するリストID
- `BREVO_TEMPLATE_ID` - 使用するメールテンプレートID
- `BASE44_ORIGIN` - CORS許可オリジン（オプション、デフォルト: `*`）

これらの設定が不完全な場合、APIは`status: "skipped"`を返します。

