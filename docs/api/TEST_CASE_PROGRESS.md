# Case Progress API テストコード

## 🚀 クイックテスト

### 基本的なテスト（Hospital Step）

**重要**: `caseId`は必須です。テストでは UUID を生成して使用してください。

```bash
# caseIdを生成（例: UUID v4形式）
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")

curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalName\": \"Test Hospital\",
      \"hospitalId\": \"123\"
    }
  }"
```

### city を含むテスト

```bash
# caseIdを生成
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")

curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalName\": \"Test Hospital\",
      \"hospitalId\": \"123\",
      \"city\": \"Tokyo\"
    }
  }"
```

### UTM パラメータを含むテスト

```bash
# caseIdを生成
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")

curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalName\": \"Test Hospital\",
      \"hospitalId\": \"123\",
      \"city\": \"Tokyo\",
      \"utm_source\": \"google\",
      \"utm_campaign\": \"test2024\"
    }
  }"
```

## 📝 完全なテストフロー

### 1. 新規ケース作成（Hospital Step with UTM）

```bash
# caseIdを生成
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")

# リクエスト
curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalName\": \"St. Jude Medical Center\",
      \"hospitalId\": \"123\",
      \"city\": \"Tokyo\",
      \"utm_source\": \"google\",
      \"utm_campaign\": \"summer2024\"
    }
  }"

# 期待されるレスポンス
# {
#   "success": true,
#   "caseId": "generated-uuid-here",
#   "currentStep": "hospital",
#   "message": "Step \"hospital\" saved successfully"
# }
```

### 2. 既存ケース更新（Bill Type Step）

```bash
# リクエスト（上記で取得したcaseIdを使用）
curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "your-case-id-here",
    "currentStep": "billType",
    "stepData": {
      "billType": "Emergency Room"
    }
  }'
```

### 3. 既存ケース更新（Balance Step）

```bash
curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "your-case-id-here",
    "currentStep": "balance",
    "stepData": {
      "balanceAmount": 1500.75,
      "inCollections": false
    }
  }'
```

### 4. 既存ケース更新（Insurance Step）

```bash
curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "your-case-id-here",
    "currentStep": "insurance",
    "stepData": {
      "insuranceStatus": "Uninsured"
    }
  }'
```

### 5. 既存ケース更新（Contact Step）

```bash
curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "your-case-id-here",
    "currentStep": "contact",
    "stepData": {
      "email": "user@example.com",
      "phone": "555-123-4567",
      "agreedToTerms": true
    }
  }'
```

## 🧪 エラーテスト

### 必須フィールド不足テスト

```bash
# caseIdが不足
curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "currentStep": "hospital",
    "stepData": {
      "hospitalName": "Test Hospital"
    }
  }'

# 期待されるレスポンス: 400 Bad Request
# {
#   "error": "caseId is required and must be a string"
# }

# hospitalNameが不足
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")
curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalId\": \"123\"
    }
  }"

# 期待されるレスポンス: 400 Bad Request
# {
#   "error": "hospitalName is required and must be a string"
# }
```

### 無効なメールアドレステスト

```bash
curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "your-case-id-here",
    "currentStep": "contact",
    "stepData": {
      "email": "invalid-email",
      "agreedToTerms": true
    }
  }'

# 期待されるレスポンス: 400 Bad Request
# {
#   "error": "email must be a valid email address"
# }
```

## 🔄 完全なフローテスト（シェルスクリプト）

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"

echo "=== Step 1: Create new case with hospital step ==="
# Generate caseId
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")
echo "Generated Case ID: $CASE_ID"

RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalName\": \"Test Hospital\",
      \"hospitalId\": \"123\",
      \"city\": \"Tokyo\",
      \"utm_source\": \"google\",
      \"utm_campaign\": \"test2024\"
    }
  }")

echo "Response: $RESPONSE"
RESPONSE_CASE_ID=$(echo $RESPONSE | jq -r '.caseId')
echo "Response Case ID: $RESPONSE_CASE_ID"

if [ "$RESPONSE_CASE_ID" != "$CASE_ID" ]; then
  echo "Warning: Response caseId does not match sent caseId"
fi

if [ "$RESPONSE_CASE_ID" == "null" ] || [ -z "$RESPONSE_CASE_ID" ]; then
  echo "Error: Failed to create case"
  exit 1
fi

echo ""
echo "=== Step 2: Update with billType ==="
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"billType\",
    \"stepData\": {
      \"billType\": \"Emergency Room\"
    }
  }"

echo ""
echo "=== Step 3: Update with balance ==="
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"balance\",
    \"stepData\": {
      \"balanceAmount\": 1500.75,
      \"inCollections\": false
    }
  }"

echo ""
echo "=== Step 4: Update with insurance ==="
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"insurance\",
    \"stepData\": {
      \"insuranceStatus\": \"Uninsured\"
    }
  }"

echo ""
echo "=== Step 5: Update with contact ==="
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"contact\",
    \"stepData\": {
      \"email\": \"user@example.com\",
      \"phone\": \"555-123-4567\",
      \"agreedToTerms\": true
    }
  }"

echo ""
echo "=== Test completed ==="
```

## 📋 Node.js/TypeScript テスト例

```typescript
// test-case-progress.ts
async function testCaseProgress() {
  const BASE_URL = "http://localhost:3000";

  // Step 1: Create new case
  console.log("=== Step 1: Create new case ===");

  // Generate caseId
  const caseId = crypto.randomUUID();
  console.log("Generated Case ID:", caseId);

  const createResponse = await fetch(`${BASE_URL}/api/case-progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: caseId, // 必須: フロントエンドで生成
      currentStep: "hospital",
      stepData: {
        hospitalName: "Test Hospital",
        hospitalId: "123",
        city: "Tokyo",
        utm_source: "google",
        utm_campaign: "test2024",
      },
    }),
  });

  const createResult = await createResponse.json();
  console.log("Create response:", createResult);

  if (!createResult.success) {
    throw new Error("Failed to create case");
  }

  // caseIdは送信したものと同じものが返される
  if (createResult.caseId !== caseId) {
    console.warn("Warning: Response caseId does not match sent caseId");
  }

  console.log("Case ID:", caseId);

  // Step 2: Update with billType
  console.log("\n=== Step 2: Update with billType ===");
  const billTypeResponse = await fetch(`${BASE_URL}/api/case-progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId,
      currentStep: "billType",
      stepData: {
        billType: "Emergency Room",
      },
    }),
  });

  const billTypeResult = await billTypeResponse.json();
  console.log("BillType response:", billTypeResult);

  // Step 3: Update with balance
  console.log("\n=== Step 3: Update with balance ===");
  const balanceResponse = await fetch(`${BASE_URL}/api/case-progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId,
      currentStep: "balance",
      stepData: {
        balanceAmount: 1500.75,
        inCollections: false,
      },
    }),
  });

  const balanceResult = await balanceResponse.json();
  console.log("Balance response:", balanceResult);

  // Step 4: Update with insurance
  console.log("\n=== Step 4: Update with insurance ===");
  const insuranceResponse = await fetch(`${BASE_URL}/api/case-progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId,
      currentStep: "insurance",
      stepData: {
        insuranceStatus: "Uninsured",
      },
    }),
  });

  const insuranceResult = await insuranceResponse.json();
  console.log("Insurance response:", insuranceResult);

  // Step 5: Update with contact
  console.log("\n=== Step 5: Update with contact ===");
  const contactResponse = await fetch(`${BASE_URL}/api/case-progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId,
      currentStep: "contact",
      stepData: {
        email: "user@example.com",
        phone: "555-123-4567",
        agreedToTerms: true,
      },
    }),
  });

  const contactResult = await contactResponse.json();
  console.log("Contact response:", contactResult);

  console.log("\n=== All tests completed ===");
}

// 実行
testCaseProgress().catch(console.error);
```

## 🎯 重要なテストポイント

1. **新規ケース作成時**: `city`と`utm_source`、`utm_campaign`が正しく保存されるか
2. **既存ケース更新時**: UTM パラメータが無視されるか（既存の値が保持されるか）
3. **バリデーション**: 必須フィールドの検証が正しく動作するか
4. **エラーハンドリング**: エラー時に適切なメッセージが返されるか

## 📚 関連ドキュメント

- [Case Progress API Guide](./CASE_PROGRESS_API.md) - 詳細な API 仕様
- [CURL Examples](./CURL_EXAMPLES.md) - より多くの CURL 例
