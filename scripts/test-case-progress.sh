#!/bin/bash

# Test script for PUT /api/case-progress endpoint
# Usage: ./test-case-progress.sh

BASE_URL="${BASE_URL:-http://localhost:3000}"
ENDPOINT="${BASE_URL}/api/case-progress"

echo "Testing PUT /api/case-progress endpoint"
echo "========================================"
echo ""

# Test 1: Create new case - Hospital step (with caseId)
echo "Test 1: Create new case - Hospital step"
echo "----------------------------------------"
# Generate a test case ID
TEST_CASE_ID="test-$(date +%s)-$(shuf -i 1000-9999 -n 1)"
RESPONSE=$(curl -s -X PUT "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$TEST_CASE_ID\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalName\": \"St. Jude Medical Center\",
      \"hospitalId\": \"123\"
    }
  }")

CASE_ID_1=$(echo "$RESPONSE" | jq -r '.caseId')

echo "Response:"
echo "$RESPONSE" | jq '.'

echo ""
echo "Generated Case ID: $CASE_ID_1"
echo ""

# Test 2: Update existing case - BillType step
echo "Test 2: Update existing case - BillType step"
echo "--------------------------------------------"
curl -s -X PUT "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID_1\",
    \"currentStep\": \"billType\",
    \"stepData\": {
      \"billType\": \"Emergency Room\"
    }
  }" | jq '.'

echo ""

# Test 3: Update existing case - Balance step
echo "Test 3: Update existing case - Balance step"
echo "-------------------------------------------"
curl -s -X PUT "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID_1\",
    \"currentStep\": \"balance\",
    \"stepData\": {
      \"balanceAmount\": 1500.75,
      \"inCollections\": false
    }
  }" | jq '.'

echo ""

# Test 4: Update existing case - Insurance step
echo "Test 4: Update existing case - Insurance step"
echo "---------------------------------------------"
curl -s -X PUT "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID_1\",
    \"currentStep\": \"insurance\",
    \"stepData\": {
      \"insuranceStatus\": \"Uninsured\"
    }
  }" | jq '.'

echo ""

# Test 5: Update existing case - Contact step
echo "Test 5: Update existing case - Contact step"
echo "-------------------------------------------"
curl -s -X PUT "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID_1\",
    \"currentStep\": \"contact\",
    \"stepData\": {
      \"email\": \"user@example.com\",
      \"phone\": \"555-123-4567\",
      \"agreedToTerms\": true
    }
  }" | jq '.'

echo ""

# Test 6: Resend same step (idempotent test)
echo "Test 6: Resend same step (idempotent test)"
echo "------------------------------------------"
curl -s -X PUT "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"caseId\": \"$CASE_ID_1\",
    \"currentStep\": \"hospital\",
    \"stepData\": {
      \"hospitalName\": \"Updated Hospital Name\",
      \"hospitalId\": \"456\"
    }
  }" | jq '.'

echo ""

# Test 7: Validation error test
echo "Test 7: Validation error test (missing required field)"
echo "------------------------------------------------------"
curl -s -X PUT "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "currentStep": "hospital",
    "stepData": {
      "hospitalId": "123"
    }
  }' | jq '.'

echo ""
echo "========================================"
echo "All tests completed!"

