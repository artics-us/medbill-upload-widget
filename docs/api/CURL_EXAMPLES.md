# CURL Examples for /api/case-progress

## Base URL

```bash
BASE_URL="http://localhost:3000"  # For local development
# BASE_URL="https://your-production-domain.com"  # For production
```

## Test 1: Create New Case - Hospital Step (Basic)

**重要**: `caseId`は必須です。テストでは UUID を生成して使用してください。

```bash
# caseIdを生成（例: UUID v4形式）
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")

curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalName\": \"St. Jude Medical Center\",
      \"hospitalId\": \"123\"
    }
  }"
```

**Expected Response:**

```json
{
  "success": true,
  "caseId": "your-case-id-here",
  "currentStep": "hospital",
  "message": "Step \"hospital\" saved successfully"
}
```

## Test 1-2: Create New Case - Hospital Step with City

```bash
# caseIdを生成
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")

curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalName\": \"St. Jude Medical Center\",
      \"hospitalId\": \"123\",
      \"city\": \"Tokyo\"
    }
  }"
```

**Expected Response:**

```json
{
  "success": true,
  "caseId": "generated-uuid-here",
  "currentStep": "hospital",
  "message": "Step \"hospital\" saved successfully"
}
```

**Note:** `city` will be saved to the `State` column in Google Sheets.

## Test 1-3: Create New Case - Hospital Step with UTM Parameters

```bash
# caseIdを生成
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")

curl -X PUT "${BASE_URL}/api/case-progress" \
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
```

**Expected Response:**

```json
{
  "success": true,
  "caseId": "generated-uuid-here",
  "currentStep": "hospital",
  "message": "Step \"hospital\" saved successfully"
}
```

**Note:**

- `city` will be saved to the `State` column
- `utm_source` will be saved to the `UTM Source` column
- `utm_campaign` will be saved to the `UTM Campaign` column
- UTM parameters are only saved when creating a new case (not when updating existing cases)

## Test 2: Update Existing Case - BillType Step

```bash
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "your-case-id-here",
    "currentStep": "billType",
    "stepData": {
      "billType": "Emergency Room"
    }
  }'
```

## Test 3: Update Existing Case - Balance Step

```bash
curl -X PUT "${BASE_URL}/api/case-progress" \
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

## Test 4: Update Existing Case - Insurance Step

```bash
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "your-case-id-here",
    "currentStep": "insurance",
    "stepData": {
      "insuranceStatus": "Uninsured"
    }
  }'
```

## Test 5: Update Existing Case - Contact Step

```bash
curl -X PUT "${BASE_URL}/api/case-progress" \
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

## Test 6: Resend Same Step (Idempotent Test)

This tests that you can resend the same step data multiple times:

```bash
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "your-case-id-here",
    "currentStep": "hospital",
    "stepData": {
      "hospitalName": "Updated Hospital Name",
      "hospitalId": "456"
    }
  }'
```

## Test 7: Validation Error Test

Test missing required field:

```bash
# caseIdが不足している場合
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "currentStep": "hospital",
    "stepData": {
      "hospitalName": "Test Hospital"
    }
  }'
```

**Expected Response:**

```json
{
  "error": "caseId is required and must be a string"
}
```

```bash
# hospitalNameが不足している場合
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalId\": \"123\"
    }
  }"
```

**Expected Response:**

```json
{
  "error": "hospitalName is required and must be a string"
}
```

## Test 8: Invalid Email Test

```bash
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "your-case-id-here",
    "currentStep": "contact",
    "stepData": {
      "email": "invalid-email",
      "agreedToTerms": true
    }
  }'
```

**Expected Response:**

```json
{
  "error": "email must be a valid email address"
}
```

## Complete Flow Example

Here's a complete flow simulating a user going through all steps:

```bash
# Step 1: Generate caseId and create case (with city and UTM parameters)
CASE_ID=$(uuidgen 2>/dev/null || echo "test-$(date +%s)-$(shuf -i 1000-9999 -n 1)")
echo "Generated Case ID: $CASE_ID"

RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/case-progress" \
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
  }")

echo "Response: $RESPONSE"
RESPONSE_CASE_ID=$(echo $RESPONSE | jq -r '.caseId')
echo "Response Case ID: $RESPONSE_CASE_ID"

# Step 2: Update with billType
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID\",
    \"currentStep\": \"billType\",
    \"stepData\": {
      \"billType\": \"Emergency Room\"
    }
  }"

# Step 3: Update with balance
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

# Step 4: Update with contact
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
```

## Using the Test Script

You can also use the provided test script:

```bash
# Make it executable
chmod +x scripts/test-case-progress.sh

# Run it
./scripts/test-case-progress.sh

# Or with a custom base URL
BASE_URL="https://your-domain.com" ./scripts/test-case-progress.sh
```

**Note:** The test script requires `jq` to be installed for JSON parsing. Install it with:

- macOS: `brew install jq`
- Linux: `sudo apt-get install jq` or `sudo yum install jq`

---

# CURL Examples for /api/mixpanel/track

## Base URL

```bash
BASE_URL="http://localhost:3000"  # For local development
# BASE_URL="https://medbill-upload-widget.vercel.app"  # For production
```

## Test 1: Track Page View Event (Minimal - Event Only)

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Page View"
  }'
```

**Expected Response:**

```json
{
  "success": true
}
```

## Test 2: Track Page View with Anonymous ID

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Page View",
    "distinct_id": "anonymous-user-123"
  }'
```

## Test 3: Track Landing Page CTA Events

```bash
# Hero CTA Clicked
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CTA Clicked Hero"
  }'

# Urgency CTA Clicked
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CTA Clicked Urgency"
  }'

# Pricing CTA Clicked
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CTA Clicked Pricing"
  }'
```

## Test 4: Track How It Works CTA Events

```bash
# Step 1 CTA
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CTA Clicked HowItWorks Step1"
  }'

# Step 2 CTA
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CTA Clicked HowItWorks Step2"
  }'

# Step 3 CTA
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CTA Clicked HowItWorks Step3"
  }'
```

## Test 5: Track Hospital Page Events

```bash
# Hospital Submitted
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Hospital Submitted"
  }'

# No Hospital Selected
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "No Hospital Selected"
  }'
```

## Test 6: Track Bill Type Selected

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Bill Type Selected"
  }'
```

## Test 7: Track Balance Submitted

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Balance Submitted"
  }'
```

## Test 8: Track Insurance Status Selected

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Insurance Status Selected"
  }'
```

## Test 9: Track Next Steps CTA

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "CTA Clicked NextSteps"
  }'
```

## Test 10: Track Contact Form Submitted

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Contact Form Submitted"
  }'
```

## Test 11: Track Upload Completed

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Upload Completed"
  }'
```

## Test 12: Track Schedule Consultation Clicked

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Schedule Consultation Clicked"
  }'
```

## Test 13: Validation Error - Missing Event

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "distinct_id": "user-123"
  }'
```

**Expected Response:**

```json
{
  "error": "Event name required"
}
```

## Test 14: Event with Empty Properties (Recommended)

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Page View",
    "distinct_id": "user-123",
    "properties": {}
  }'
```

## Test 15: HIPAA Compliance Test - PII Filtering

This test demonstrates that PII/PHI fields are automatically filtered out:

```bash
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "Contact Form Submitted",
    "properties": {
      "email": "user@example.com",
      "phone": "555-1234",
      "hospitalName": "St. Jude",
      "balance": 1500,
      "caseId": "12345",
      "safeProperty": "this-will-be-included"
    }
  }'
```

**Note:** Only `safeProperty` will be sent to Mixpanel. All PII/PHI fields (email, phone, hospitalName, balance, caseId) will be automatically filtered out.

## Complete User Journey Example

Here's a complete flow simulating a user going through the entire funnel:

```bash
# Landing Page - Page View
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "Page View"}'

# Landing Page - Hero CTA Clicked
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "CTA Clicked Hero"}'

# Hospital Page - Hospital Submitted
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "Hospital Submitted"}'

# Bill Type Page - Bill Type Selected
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "Bill Type Selected"}'

# Balance Page - Balance Submitted
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "Balance Submitted"}'

# Insurance Page - Insurance Status Selected
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "Insurance Status Selected"}'

# Next Steps - Continue Clicked
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "CTA Clicked NextSteps"}'

# Contact Page - Contact Form Submitted
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "Contact Form Submitted"}'

# Upload Page - Upload Completed
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "Upload Completed"}'

# Done Page - Schedule Consultation Clicked
curl -X POST "${BASE_URL}/api/mixpanel/track" \
  -H "Content-Type: application/json" \
  -d '{"event": "Schedule Consultation Clicked"}'
```

## Notes

- **API Endpoint**: `POST /api/mixpanel/track`
- **Request Format**: `{ "event": "string (required)", "distinct_id": "string (optional)", "properties": {} (optional) }`
- **Fire and Forget**: The API returns success immediately without waiting for Mixpanel response
- **HIPAA Compliance**:
  - PII/PHI fields are automatically filtered out (email, phone, hospitalName, hospitalId, balance, balanceAmount, insuranceStatus, billType, billToken, caseId, name, etc.)
  - Only event names and safe properties are tracked
  - All events are sent to Mixpanel Data Ingestion API directly
- **distinct_id**: Optional - defaults to "anonymous" if not provided
- **properties**: Optional - empty object `{}` is recommended to avoid accidentally sending PII
- The API does not require authentication, but make sure to set up rate limiting in production
