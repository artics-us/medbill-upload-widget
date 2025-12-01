# Google Sheets API Setup Guide

## Issue: "Google Sheets API has not been used in project before or it is disabled"

If you see this error, you need to enable the Google Sheets API in your Google Cloud Project.

## Steps to Enable Google Sheets API

### 1. Enable the API

Visit the Google Cloud Console and enable the Google Sheets API:

**Direct Link (replace PROJECT_ID with your actual project ID):**
```
https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=YOUR_PROJECT_ID
```

**Or follow these steps:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Library**
4. Search for "Google Sheets API"
5. Click on "Google Sheets API"
6. Click **Enable**

### 2. Wait for Propagation

After enabling the API, wait a few minutes for the changes to propagate to Google's systems.

### 3. Verify Service Account Permissions

Make sure your service account has the necessary permissions:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin** > **Service Accounts**
3. Find your service account (the email from `GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY`)
4. Ensure it has the **Editor** role or at least **Service Account User** role

### 4. Share the Spreadsheet

1. Open your Google Spreadsheet
2. Click the **Share** button
3. Add the service account email (from `client_email` in your service account key)
4. Give it **Editor** permissions
5. Click **Send**

### 5. Verify Environment Variables

Make sure you have these set in your `.env.local`:

```env
# Use the same service account key as GCS (or create a separate one)
GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}

# Get this from the spreadsheet URL: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id-here
```

**Note:** The code currently uses `GCP_SERVICE_ACCOUNT_KEY` as a fallback if `GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY` is not set. You can use the same service account for both GCS and Google Sheets.

### 6. Test the API

After enabling the API and setting up permissions, test with:

```bash
curl -X PUT "http://localhost:3000/api/case-progress" \
  -H "Content-Type: application/json" \
  -d '{
    "currentStep": "hospital",
    "stepData": {
      "hospitalName": "Test Hospital"
    }
  }'
```

If successful, you should see a response without the warning message.

## Troubleshooting

### Error: "API has not been used in project before"
- **Solution:** Enable the Google Sheets API (see step 1 above)

### Error: "The caller does not have permission" or "does not have permission"

This is the **most common error** after enabling the API. It means the service account doesn't have access to your spreadsheet.

**Solution:**
1. Find your service account email:
   - Check your `.env.local` file
   - Look for `GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY` or `GCP_SERVICE_ACCOUNT_KEY`
   - The `client_email` field contains the service account email (e.g., `your-service@project-id.iam.gserviceaccount.com`)

2. Share the spreadsheet with the service account:
   - Open your Google Spreadsheet
   - Click the **Share** button (top right)
   - Paste the service account email in the "Add people and groups" field
   - Select **Editor** from the permission dropdown
   - **Uncheck** "Notify people" (service accounts don't need notifications)
   - Click **Share**

3. Verify the spreadsheet ID:
   - Make sure `GOOGLE_SHEETS_SPREADSHEET_ID` in your `.env.local` matches the spreadsheet ID from the URL
   - The ID is the long string between `/d/` and `/edit` in the spreadsheet URL

**Important:** The service account email looks like: `xxxxx@xxxxx.iam.gserviceaccount.com` - make sure you're sharing with this exact email, not your personal Google account.

### Error: "Unable to parse range"
- **Solution:** Make sure the spreadsheet exists and the `GOOGLE_SHEETS_SPREADSHEET_ID` is correct

### Error: "Requested entity was not found"
- **Solution:** Verify the spreadsheet ID and that the service account has access to it

## Current Behavior

The API will still return `200 OK` even if Google Sheets save fails, but it will include a `warning` field in the response:

```json
{
  "success": true,
  "caseId": "...",
  "currentStep": "hospital",
  "message": "Step \"hospital\" saved successfully",
  "warning": "Google Sheets API is not enabled. Please enable it at: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=980854420489"
}
```

This allows the frontend to continue working even if Google Sheets is not configured, while still notifying about the issue.

