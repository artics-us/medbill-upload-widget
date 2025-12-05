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
const SHEET_NAME = 'Leads'; // Sheet name in the spreadsheet
const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || '';

/**
 * Convert column index (0-based) to Google Sheets column letter (A, B, ..., Z, AA, AB, ...)
 */
function columnIndexToLetter(index: number): string {
  let result = '';
  index++;
  while (index > 0) {
    index--;
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26);
  }
  return result;
}

/**
 * Mapping from data keys to Google Sheets column names
 * This allows flexible column positioning - columns can be in any order
 */
const DATA_COLUMN_MAP: Record<string, string> = {
  caseId: 'Case ID',
  email: 'Email',
  phone: 'Phone',
  hospitalName: 'Hospital name',
  billType: 'Bill type',
  balanceAmount: 'Balance amount',
  inCollections: 'In collections',
  insuranceStatus: 'Insurance status',
  gcsFileUrl: 'GCS file URL',
  currentStep: 'Last Done Page',
  city: 'State',
  utm_source: 'UTM Source',
  utm_campaign: 'UTM Campaign',
  lpInputTime: 'LP Input Time',
  // Note: Some fields like createdAt, updatedAt, status, etc.
  // don't have direct mappings in the new spreadsheet structure
  // They can be added to the mapping if needed
};

/**
 * Get headers from the spreadsheet and create a column name to index mapping
 */
async function getColumnMapping(): Promise<Record<string, number>> {
  if (!sheets || !SPREADSHEET_ID) {
    return {};
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!1:1`, // Get header row (row 1)
    });

    const headers = response.data.values?.[0] || [];
    const mapping: Record<string, number> = {};

    headers.forEach((header: string, index: number) => {
      if (header) {
        mapping[header] = index;
      }
    });

    return mapping;
  } catch (error) {
    console.error('Error getting column mapping:', error);
    return {};
  }
}

/**
 * Get headers from the spreadsheet (no longer creates headers - assumes they already exist)
 */
async function getHeaders(): Promise<string[]> {
  if (!sheets || !SPREADSHEET_ID) {
    return [];
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!1:1`, // Get header row (row 1)
    });

    return response.data.values?.[0] || [];
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };

    // Check if it's an API not enabled error
    if (err?.code === 403 && err?.message?.includes('has not been used')) {
      const projectId = err?.message?.match(/project (\d+)/)?.[1];
      const errorMessage = `Google Sheets API is not enabled. Please enable it at: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId || 'YOUR_PROJECT_ID'}`;
      console.error('Error getting headers:', errorMessage);
      throw new Error(errorMessage);
    }

    // Check if it's a permission error
    if (err?.code === 403 && (err?.message?.includes('does not have permission') || err?.message?.includes('caller does not have permission'))) {
      const parsedKey = keyJson ? JSON.parse(keyJson) : null;
      const serviceAccountEmail = parsedKey?.client_email || 'YOUR_SERVICE_ACCOUNT_EMAIL';
      const errorMessage = `Permission denied: The service account "${serviceAccountEmail}" does not have access to the spreadsheet. Please share the spreadsheet with this email address and give it Editor permissions.`;
      console.error('Error getting headers:', errorMessage);
      throw new Error(errorMessage);
    }

    console.error('Error getting headers:', error);
    throw error;
  }
}

/**
 * Find the row index for a given caseId
 * Uses the "Case ID" column dynamically (not hardcoded to column A)
 */
async function findCaseRow(caseId: string): Promise<number | null> {
  if (!sheets || !SPREADSHEET_ID) {
    return null;
  }

  try {
    const columnMap = await getColumnMapping();
    const caseIdColumnIndex = columnMap['Case ID'];

    if (caseIdColumnIndex === undefined) {
      console.error('Case ID column not found in spreadsheet');
      return null;
    }

    // Convert column index to letter
    const columnLetter = columnIndexToLetter(caseIdColumnIndex);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!${columnLetter}:${columnLetter}`, // Dynamic column based on Case ID position
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
 * Uses column mapping to place data in the correct columns
 */
async function appendRow(data: Record<string, unknown>): Promise<void> {
  if (!sheets || !SPREADSHEET_ID) {
    console.warn('Google Sheets not configured, skipping append');
    return;
  }

  try {
    const headers = await getHeaders();
    const columnMap = await getColumnMapping();

    if (headers.length === 0) {
      throw new Error('Spreadsheet headers not found. Please ensure the spreadsheet has headers.');
    }

    // Create a row array with the same length as headers, filled with empty strings
    const row = new Array(headers.length).fill('');

    // Map data to columns using the column mapping
    for (const [dataKey, columnName] of Object.entries(DATA_COLUMN_MAP)) {
      const columnIndex = columnMap[columnName];
      if (columnIndex !== undefined && data[dataKey] !== undefined && data[dataKey] !== null && data[dataKey] !== '') {
        let value = data[dataKey];
        // Special handling for inCollections: convert boolean to "yes"/"no"
        if (dataKey === 'inCollections' && typeof value === 'boolean') {
          value = value ? 'yes' : 'no';
        } else if (typeof value === 'boolean') {
          // Convert other booleans to TRUE/FALSE for Google Sheets
          value = value ? 'TRUE' : 'FALSE';
        }
        row[columnIndex] = String(value);
      }
    }

    // Calculate the last column letter based on headers length
    const lastColumn = columnIndexToLetter(headers.length - 1);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:${lastColumn}`,
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
 * Uses column mapping to update only the relevant columns
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
    const headers = await getHeaders();
    const columnMap = await getColumnMapping();

    if (headers.length === 0) {
      throw new Error('Spreadsheet headers not found. Please ensure the spreadsheet has headers.');
    }

    // Get current row data (get all columns to preserve existing values)
    const lastColumn = columnIndexToLetter(headers.length - 1);
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowNumber}:${lastColumn}${rowNumber}`,
    });

    const currentRow = response.data.values?.[0] || [];

    // Create a new row array with the same length as headers, filled with existing values
    const row = new Array(headers.length).fill('');
    for (let i = 0; i < currentRow.length && i < headers.length; i++) {
      row[i] = currentRow[i] || '';
    }

    // Update only the columns that have data in the mapping
    for (const [dataKey, columnName] of Object.entries(DATA_COLUMN_MAP)) {
      const columnIndex = columnMap[columnName];
      if (columnIndex !== undefined && data[dataKey] !== undefined && data[dataKey] !== null && data[dataKey] !== '') {
        let value = data[dataKey];
        // Special handling for inCollections: convert boolean to "yes"/"no"
        if (dataKey === 'inCollections' && typeof value === 'boolean') {
          value = value ? 'yes' : 'no';
        } else if (typeof value === 'boolean') {
          // Convert other booleans to TRUE/FALSE for Google Sheets
          value = value ? 'TRUE' : 'FALSE';
        }
        row[columnIndex] = String(value);
      }
    }

    // Update the row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A${rowNumber}:${lastColumn}${rowNumber}`,
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
        // Save city to State column if provided
        if (stepData.city) {
          dataToSave.city = stepData.city;
        }
        // Save UTM parameters only when creating new row (not when updating existing row)
        if (!existingRow) {
          if (stepData.utm_source) {
            dataToSave.utm_source = stepData.utm_source;
          }
          if (stepData.utm_campaign) {
            dataToSave.utm_campaign = stepData.utm_campaign;
          }
        }
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
        // Generate GCS file URL for the case directory
        if (GCS_BUCKET_NAME) {
          dataToSave.gcsFileUrl = `https://console.cloud.google.com/storage/browser/${GCS_BUCKET_NAME}/case/${caseId}`;
        }
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

    // Always update LP input time when data is saved (both new and existing rows)
    dataToSave.lpInputTime = new Date().toISOString();

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

