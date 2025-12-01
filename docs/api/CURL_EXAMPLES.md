# CURL Examples for /api/case-progress

## Base URL
```bash
BASE_URL="http://localhost:3000"  # For local development
# BASE_URL="https://your-production-domain.com"  # For production
```

## Test 1: Create New Case - Hospital Step

```bash
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "currentStep": "hospital",
    "stepData": {
      "hospitalName": "St. Jude Medical Center",
      "hospitalId": "123"
    }
  }'
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
curl -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "currentStep": "hospital",
    "stepData": {
      "hospitalId": "123"
    }
  }'
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
# Step 1: Create case and get caseId
RESPONSE=$(curl -s -X PUT "${BASE_URL}/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "currentStep": "hospital",
    "stepData": {
      "hospitalName": "St. Jude Medical Center",
      "hospitalId": "123"
    }
  }')

CASE_ID=$(echo $RESPONSE | jq -r '.caseId')
echo "Case ID: $CASE_ID"

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

