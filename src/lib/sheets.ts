// src/lib/sheets.ts
import { google } from 'googleapis';

/**
 * Google Sheets API integration
 *
 * Environment variables required:
 * - GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY: Service account JSON key (same format as GCP_SERVICE_ACCOUNT_KEY)
 * - GOOGLE_SHEETS_SPREADSHEET_ID: The ID of the Google Spreadsheet to write to
 *
 * The service account email must have edit access to the spreadsheet.
 */

// const keyJson = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY;
const keyJson = process.env.GCP_SERVICE_ACCOUNT_KEY;

if (!keyJson) {
  console.warn(
    'GOOGLE_SHEETS_SERVICE_ACCOUNT_KEY is not set. Google Sheets integration will be disabled.',
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let auth: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sheets: any = null;

if (keyJson) {
  try {
    const parsedKey = JSON.parse(keyJson);
    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: parsedKey.client_email,
        private_key: parsedKey.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
  } catch (e) {
    console.error('Failed to initialize Google Sheets client:', e);
  }
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

/**
 * Get or create the header row in the spreadsheet
 */
async function ensureHeaders() {
  if (!sheets || !SPREADSHEET_ID) {
    return;
  }

  try {
    // Check if headers exist
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A1:Z1',
    });

    const existingHeaders = response.data.values?.[0] || [];

    // Define expected headers
    const expectedHeaders = [
      'Case ID',
      'Created At',
      'Updated At',
      'Current Step',
      'Hospital Name',
      'Hospital ID',
      'Bill Type',
      'Balance Amount',
      'In Collections',
      'Insurance Status',
      'Email',
      'Phone',
      'Agreed To Terms',
      'Status',
      // Upload-related columns
      'Has Upload',
      'Upload Count',
      'Last Upload At',
      'Last Case Token',
    ];

    // If headers don't exist or are different, create/update them
    if (existingHeaders.length === 0 || existingHeaders[0] !== 'Case ID') {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Sheet1!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [expectedHeaders],
        },
      });
    }
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };

    // Check if it's an API not enabled error
    if (err?.code === 403 && err?.message?.includes('has not been used')) {
      const projectId = err?.message?.match(/project (\d+)/)?.[1];
      const errorMessage = `Google Sheets API is not enabled. Please enable it at: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId || 'YOUR_PROJECT_ID'}`;
      console.error('Error ensuring headers:', errorMessage);
      throw new Error(errorMessage);
    }

    // Check if it's a permission error
    if (err?.code === 403 && (err?.message?.includes('does not have permission') || err?.message?.includes('caller does not have permission'))) {
      const parsedKey = keyJson ? JSON.parse(keyJson) : null;
      const serviceAccountEmail = parsedKey?.client_email || 'YOUR_SERVICE_ACCOUNT_EMAIL';
      const errorMessage = `Permission denied: The service account "${serviceAccountEmail}" does not have access to the spreadsheet. Please share the spreadsheet with this email address and give it Editor permissions.`;
      console.error('Error ensuring headers:', errorMessage);
      throw new Error(errorMessage);
    }

    console.error('Error ensuring headers:', error);
    throw error;
  }
}

/**
 * Find the row index for a given caseId
 */
async function findCaseRow(caseId: string): Promise<number | null> {
  if (!sheets || !SPREADSHEET_ID) {
    return null;
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:A', // Column A contains Case IDs
    });

    const rows = response.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      // Skip header row (index 0), start from index 1
      if (rows[i][0] === caseId) {
        return i + 1; // Return 1-based row number
      }
    }
    return null;
  } catch (error) {
    console.error('Error finding case row:', error);
    return null;
  }
}

/**
 * Append a new row to the spreadsheet
 */
async function appendRow(data: Record<string, unknown>): Promise<void> {
  if (!sheets || !SPREADSHEET_ID) {
    console.warn('Google Sheets not configured, skipping append');
    return;
  }

  try {
    await ensureHeaders();

    const row = [
      data.caseId || '',
      data.createdAt || new Date().toISOString(),
      data.updatedAt || new Date().toISOString(),
      data.currentStep || '',
      data.hospitalName || '',
      data.hospitalId || '',
      data.billType || '',
      data.balanceAmount || '',
      data.inCollections || '',
      data.insuranceStatus || '',
      data.email || '',
      data.phone || '',
      data.agreedToTerms || '',
      data.status || 'in_progress',
      // Upload-related columns
      data.hasUpload ?? '',
      data.uploadCount ?? '',
      data.lastUploadAt ?? '',
      data.lastCaseToken ?? '',
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:Z',
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };

    // Check if it's an API not enabled error
    if (err?.code === 403 && err?.message?.includes('has not been used')) {
      const projectId = err?.message?.match(/project (\d+)/)?.[1];
      const errorMessage = `Google Sheets API is not enabled. Please enable it at: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId || 'YOUR_PROJECT_ID'}`;
      console.error('Error appending row to Google Sheets:', errorMessage);
      throw new Error(errorMessage);
    }

    // Check if it's a permission error
    if (err?.code === 403 && (err?.message?.includes('does not have permission') || err?.message?.includes('caller does not have permission'))) {
      const parsedKey = keyJson ? JSON.parse(keyJson) : null;
      const serviceAccountEmail = parsedKey?.client_email || 'YOUR_SERVICE_ACCOUNT_EMAIL';
      const errorMessage = `Permission denied: The service account "${serviceAccountEmail}" does not have access to the spreadsheet. Please share the spreadsheet with this email address and give it Editor permissions.`;
      console.error('Error appending row to Google Sheets:', errorMessage);
      throw new Error(errorMessage);
    }

    console.error('Error appending row to Google Sheets:', error);
    throw error;
  }
}

/**
 * Update an existing row in the spreadsheet
 */
async function updateRow(
  rowNumber: number,
  data: Record<string, unknown>,
): Promise<void> {
  if (!sheets || !SPREADSHEET_ID) {
    console.warn('Google Sheets not configured, skipping update');
    return;
  }

  try {
    // Get current row data
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Sheet1!A${rowNumber}:R${rowNumber}`,
    });

    const currentRow = response.data.values?.[0] || [];
    const headers = [
      'caseId',
      'createdAt',
      'updatedAt',
      'currentStep',
      'hospitalName',
      'hospitalId',
      'billType',
      'balanceAmount',
      'inCollections',
      'insuranceStatus',
      'email',
      'phone',
      'agreedToTerms',
      'status',
      // Upload-related columns
      'hasUpload',
      'uploadCount',
      'lastUploadAt',
      'lastCaseToken',
    ];

    // Merge existing data with new data
    const mergedData: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      mergedData[header] = currentRow[index] || '';
    });

    // Update with new data (preserve existing values if not provided)
    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
        mergedData[key] = data[key];
      }
    });

    // Always update updatedAt
    mergedData.updatedAt = new Date().toISOString();

    // Build the row array
    const row = headers.map((header) => {
      const value = mergedData[header];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
      }
      return String(value);
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Sheet1!A${rowNumber}:R${rowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };

    // Check if it's an API not enabled error
    if (err?.code === 403 && err?.message?.includes('has not been used')) {
      const projectId = err?.message?.match(/project (\d+)/)?.[1];
      const errorMessage = `Google Sheets API is not enabled. Please enable it at: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId || 'YOUR_PROJECT_ID'}`;
      console.error('Error updating row in Google Sheets:', errorMessage);
      throw new Error(errorMessage);
    }

    // Check if it's a permission error
    if (err?.code === 403 && (err?.message?.includes('does not have permission') || err?.message?.includes('caller does not have permission'))) {
      const parsedKey = keyJson ? JSON.parse(keyJson) : null;
      const serviceAccountEmail = parsedKey?.client_email || 'YOUR_SERVICE_ACCOUNT_EMAIL';
      const errorMessage = `Permission denied: The service account "${serviceAccountEmail}" does not have access to the spreadsheet. Please share the spreadsheet with this email address and give it Editor permissions.`;
      console.error('Error updating row in Google Sheets:', errorMessage);
      throw new Error(errorMessage);
    }

    console.error('Error updating row in Google Sheets:', error);
    throw error;
  }
}

/**
 * Save or update case progress in Google Sheets
 */
export async function saveCaseProgress(
  caseId: string,
  currentStep: string,
  stepData: Record<string, unknown>,
): Promise<void> {
  if (!sheets || !SPREADSHEET_ID) {
    console.warn('Google Sheets not configured, skipping save');
    return;
  }

  try {
    await ensureHeaders();

    // Find if case already exists
    const existingRow = await findCaseRow(caseId);

    // Prepare data object based on step type
    const dataToSave: Record<string, unknown> = {
      caseId,
      currentStep,
    };

    // Map stepData to spreadsheet columns based on currentStep
    switch (currentStep) {
      case 'hospital':
        dataToSave.hospitalName = stepData.hospitalName || '';
        dataToSave.hospitalId = stepData.hospitalId || '';
        break;

      case 'billType':
        dataToSave.billType = stepData.billType || '';
        break;

      case 'balance':
        dataToSave.balanceAmount = stepData.balanceAmount || '';
        dataToSave.inCollections = stepData.inCollections || false;
        break;

      case 'insurance':
        dataToSave.insuranceStatus = stepData.insuranceStatus || '';
        break;

      case 'contact':
        dataToSave.email = stepData.email || '';
        dataToSave.phone = stepData.phone || '';
        dataToSave.agreedToTerms = stepData.agreedToTerms || false;
        break;

      // New step: upload status
      case 'upload': {
        // Allow flexible stepData shape; fall back to sensible defaults
        const anyStep = stepData as Record<string, unknown>;
        dataToSave.hasUpload =
          (anyStep.hasUpload as boolean | undefined) ?? true;
        dataToSave.uploadCount =
          (anyStep.uploadCount as number | undefined) ?? '';
        dataToSave.lastUploadAt =
          (anyStep.lastUploadAt as string | undefined) ||
          new Date().toISOString();
        // caseToken can come as lastCaseToken or caseToken
        dataToSave.lastCaseToken =
          (anyStep.lastCaseToken as string | undefined) ||
          (anyStep.caseToken as string | undefined) ||
          '';
        break;
      }

      default:
        // For unknown steps, try to map common fields
        if (stepData.email) dataToSave.email = stepData.email;
        if (stepData.phone) dataToSave.phone = stepData.phone;
        if (stepData.hospitalName) dataToSave.hospitalName = stepData.hospitalName;
        if (stepData.billType) dataToSave.billType = stepData.billType;
        if (stepData.balanceAmount !== undefined)
          dataToSave.balanceAmount = stepData.balanceAmount;
        if (stepData.inCollections !== undefined)
          dataToSave.inCollections = stepData.inCollections;
        if (stepData.insuranceStatus)
          dataToSave.insuranceStatus = stepData.insuranceStatus;
        if (stepData.agreedToTerms !== undefined)
          dataToSave.agreedToTerms = stepData.agreedToTerms;
    }

    if (existingRow) {
      // Update existing row
      await updateRow(existingRow, dataToSave);
      console.log(
        `Updated case ${caseId} at row ${existingRow} in Google Sheets`,
      );
    } else {
      // Append new row
      dataToSave.createdAt = new Date().toISOString();
      await appendRow(dataToSave);
      console.log(`Appended new case ${caseId} to Google Sheets`);
    }
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };

    // Check if it's an API not enabled error
    if (err?.code === 403 && err?.message?.includes('has not been used')) {
      const projectId = err?.message?.match(/project (\d+)/)?.[1];
      const errorMessage = `Google Sheets API is not enabled. Please enable it at: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId || 'YOUR_PROJECT_ID'}`;
      console.error('Error saving case progress to Google Sheets:', errorMessage);
      throw new Error(errorMessage);
    }

    // Check if it's a permission error
    if (err?.code === 403 && (err?.message?.includes('does not have permission') || err?.message?.includes('caller does not have permission'))) {
      const parsedKey = keyJson ? JSON.parse(keyJson) : null;
      const serviceAccountEmail = parsedKey?.client_email || 'YOUR_SERVICE_ACCOUNT_EMAIL';
      const errorMessage = `Permission denied: The service account "${serviceAccountEmail}" does not have access to the spreadsheet. Please share the spreadsheet with this email address and give it Editor permissions.`;
      console.error('Error saving case progress to Google Sheets:', errorMessage);
      throw new Error(errorMessage);
    }

    console.error('Error saving case progress to Google Sheets:', error);
    throw error;
  }
}

