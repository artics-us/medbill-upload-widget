# Documentation

This directory contains all project documentation organized by category.

## 📁 Directory Structure

```
docs/
├── api/              # API documentation and examples
│   ├── CASE_PROGRESS_API.md   # Case Progress API実装ガイド
│   ├── MIXPANEL_TRACKING.md   # Mixpanelトラッキング実装ガイド
│   ├── BREVO_DOI_API.md       # Brevo Double Opt-In API実装ガイド
│   └── CURL_EXAMPLES.md
├── setup/            # Setup and configuration guides
│   └── GOOGLE_SHEETS_SETUP.md
└── README.md         # This file
```

## 📚 Documentation Index

### API Documentation

- **[Case Progress API Guide](./api/CASE_PROGRESS_API.md)** - フロントエンドエンジニア向けのCase Progress API実装ガイド ⭐
- **[Mixpanel Tracking Guide](./api/MIXPANEL_TRACKING.md)** - フロントエンドエンジニア向けのMixpanelトラッキング実装ガイド
- **[Brevo Double Opt-In API Guide](./api/BREVO_DOI_API.md)** - フロントエンドエンジニア向けのBrevo Double Opt-In API実装ガイド
- **[CURL Examples](./api/CURL_EXAMPLES.md)** - Complete curl examples for testing the `/api/case-progress` and `/api/mixpanel/track` endpoints

### Setup Guides

- **[Google Sheets Setup](./setup/GOOGLE_SHEETS_SETUP.md)** - Guide for setting up Google Sheets API integration

## 🧪 Testing

Test scripts are located in the `scripts/` directory:

- `scripts/test-case-progress.sh` - Automated test script for the case-progress API

## 📖 Quick Links

- [Main README](../README.md) - Project overview and getting started
- [Case Progress API Guide](./api/CASE_PROGRESS_API.md) - **フロントエンドエンジニア向け実装ガイド** ⭐
- [Mixpanel Tracking Guide](./api/MIXPANEL_TRACKING.md) - フロントエンドエンジニア向けのMixpanelトラッキング実装ガイド
- [Brevo Double Opt-In API Guide](./api/BREVO_DOI_API.md) - フロントエンドエンジニア向けのBrevo Double Opt-In API実装ガイド
- [API Examples](./api/CURL_EXAMPLES.md) - API testing examples (includes `/api/case-progress` and `/api/mixpanel/track`)
- [Google Sheets Setup](./setup/GOOGLE_SHEETS_SETUP.md) - Google Sheets integration guide

## 🔧 Environment Variables

### Required for Mixpanel Tracking

- `MIXPANEL_TOKEN` - Your Mixpanel project token (e.g., `e2be194a42420ec6ebc00a9cbf5aecd2`)

Set this in your `.env.local` file or in your deployment environment (Vercel, etc.).

### Optional for Mixpanel Tracking

- `MIXPANEL_ALLOW_PII` - Enable PII/PHI tracking (default: `false`)
  - Set to `true` to allow tracking of PII/PHI data (email, phone, hospitalName, etc.)
  - ⚠️ **Warning**: Ensure HIPAA compliance requirements are met before enabling in production

### Mixpanel Tracking API

The `/api/mixpanel/track` endpoint provides HIPAA-compliant event tracking:

- **Endpoint**: `POST /api/mixpanel/track`
- **Request**: `{ "event": "string (required)", "distinct_id": "string (optional)", "properties": {} (optional) }`
- **HIPAA Compliance**: By default, automatically filters out PII/PHI (email, phone, hospitalName, balance, etc.)
  - Can be disabled by setting `MIXPANEL_ALLOW_PII=true` (use with caution)
- **Fire and Forget**: Returns success immediately without waiting for Mixpanel response
