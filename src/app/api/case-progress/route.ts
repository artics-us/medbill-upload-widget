// src/app/api/case-progress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveCaseProgress } from '@/lib/sheets';

const ALLOWED_ORIGIN = process.env.BASE44_ORIGIN || '*';

// Type definitions for step data
type HospitalStepData = {
  hospitalName: string;
  hospitalId?: string | null;
  city?: string | null;
  utm_source?: string | null;
  utm_campaign?: string | null;
};

type BillTypeStepData = {
  billType: string;
};

type BalanceStepData = {
  balanceAmount: number;
  inCollections: boolean;
};

type InsuranceStepData = {
  insuranceStatus: string;
};

type ContactStepData = {
  email: string;
  phone?: string | null;
  agreedToTerms: boolean;
};

type StepData =
  | HospitalStepData
  | BillTypeStepData
  | BalanceStepData
  | InsuranceStepData
  | ContactStepData
  | Record<string, unknown>; // Fallback for unknown steps

type CaseProgressRequest = {
  caseId: string; // Required: must reference an existing case.
  currentStep: string;
  stepData: StepData;
};

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.headers.set('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/**
 * Validate step data based on currentStep
 */
function validateStepData(
  currentStep: string,
  stepData: StepData,
): { valid: boolean; error?: string } {
  switch (currentStep) {
    case 'hospital':
      if (!stepData || typeof stepData !== 'object') {
        return { valid: false, error: 'stepData must be an object' };
      }
      const hospitalData = stepData as HospitalStepData;
      if (!hospitalData.hospitalName || typeof hospitalData.hospitalName !== 'string') {
        return {
          valid: false,
          error: 'hospitalName is required and must be a string',
        };
      }
      break;

    case 'billType':
      if (!stepData || typeof stepData !== 'object') {
        return { valid: false, error: 'stepData must be an object' };
      }
      const billTypeData = stepData as BillTypeStepData;
      if (!billTypeData.billType || typeof billTypeData.billType !== 'string') {
        return {
          valid: false,
          error: 'billType is required and must be a string',
        };
      }
      break;

    case 'balance':
      if (!stepData || typeof stepData !== 'object') {
        return { valid: false, error: 'stepData must be an object' };
      }
      const balanceData = stepData as BalanceStepData;
      if (
        balanceData.balanceAmount === undefined ||
        typeof balanceData.balanceAmount !== 'number'
      ) {
        return {
          valid: false,
          error: 'balanceAmount is required and must be a number',
        };
      }
      if (
        balanceData.inCollections !== undefined &&
        typeof balanceData.inCollections !== 'boolean'
      ) {
        return {
          valid: false,
          error: 'inCollections must be a boolean if provided',
        };
      }
      break;

    case 'insurance':
      if (!stepData || typeof stepData !== 'object') {
        return { valid: false, error: 'stepData must be an object' };
      }
      const insuranceData = stepData as InsuranceStepData;
      if (
        !insuranceData.insuranceStatus ||
        typeof insuranceData.insuranceStatus !== 'string'
      ) {
        return {
          valid: false,
          error: 'insuranceStatus is required and must be a string',
        };
      }
      break;

    case 'contact':
      if (!stepData || typeof stepData !== 'object') {
        return { valid: false, error: 'stepData must be an object' };
      }
      const contactData = stepData as ContactStepData;
      if (!contactData.email || typeof contactData.email !== 'string') {
        return {
          valid: false,
          error: 'email is required and must be a string',
        };
      }
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contactData.email)) {
        return { valid: false, error: 'email must be a valid email address' };
      }
      if (
        contactData.agreedToTerms !== undefined &&
        typeof contactData.agreedToTerms !== 'boolean'
      ) {
        return {
          valid: false,
          error: 'agreedToTerms must be a boolean if provided',
        };
      }
      break;

    default:
      // For unknown steps, just check that stepData is an object
      if (!stepData || typeof stepData !== 'object') {
        return { valid: false, error: 'stepData must be an object' };
      }
  }

  return { valid: true };
}

/**
 * Shared handler for both POST and PUT requests
 * Idempotent endpoint for saving/updating case progress.
 * Users can resend the same step data multiple times (e.g., when going back and forth between pages).
 * caseId is required and must reference an existing case.
 */
async function handleCaseProgress(req: NextRequest) {
  try {
    const body: CaseProgressRequest = await req.json();

    // Validate request structure
    if (!body.caseId || typeof body.caseId !== 'string') {
      return withCors(
        NextResponse.json(
          { error: 'caseId is required and must be a string' },
          { status: 400 },
        ),
      );
    }

    if (!body.currentStep || typeof body.currentStep !== 'string') {
      return withCors(
        NextResponse.json(
          { error: 'currentStep is required and must be a string' },
          { status: 400 },
        ),
      );
    }

    if (!body.stepData || typeof body.stepData !== 'object') {
      return withCors(
        NextResponse.json(
          { error: 'stepData is required and must be an object' },
          { status: 400 },
        ),
      );
    }

    // Validate step-specific data
    const validation = validateStepData(body.currentStep, body.stepData);
    if (!validation.valid) {
      return withCors(
        NextResponse.json({ error: validation.error }, { status: 400 }),
      );
    }

    // Use provided caseId (must reference an existing case)
    const caseId = body.caseId;

    // For hospital step, get city from request if not provided in stepData
    let stepDataWithCity = { ...body.stepData };
    if (body.currentStep === 'hospital') {
      const hospitalData = stepDataWithCity as HospitalStepData;
      // If city is not provided in stepData, try to get it from request geo
      if (!hospitalData.city) {
        const geo = (req as unknown as { geo?: { city?: string } }).geo;
        if (geo?.city) {
          hospitalData.city = geo.city;
          stepDataWithCity = hospitalData;
        }
      }
    }

    // Save to Google Sheets
    // UTM parameters are extracted from stepData in saveCaseProgress function
    let sheetsWarning: string | null = null;
    try {
      await saveCaseProgress(caseId, body.currentStep, stepDataWithCity);
    } catch (sheetsError: unknown) {
      console.error('Error saving to Google Sheets:', sheetsError);

      // Check for specific error types and pass through helpful messages
      const err = sheetsError as { message?: string } | null;
      if (err?.message) {
        // Pass through helpful error messages (API not enabled, permission denied, etc.)
        sheetsWarning = err.message;
      } else {
        sheetsWarning = 'Failed to save to Google Sheets. Check server logs for details.';
      }
      // Continue even if Sheets save fails (non-critical)
      // The API will still return success, but include a warning
    }

    // Return success response with caseId
    const response: {
      success: boolean;
      caseId: string;
      currentStep: string;
      message: string;
      warning?: string;
    } = {
      success: true,
      caseId,
      currentStep: body.currentStep,
      message: `Step "${body.currentStep}" saved successfully`,
    };

    // Include warning if Google Sheets save failed
    if (sheetsWarning) {
      response.warning = sheetsWarning;
    }

    return withCors(NextResponse.json(response, { status: 200 }));
  } catch (err: unknown) {
    console.error('Unexpected error in /api/case-progress:', err);
    return withCors(
      NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : 'Internal error in /api/case-progress',
        },
        { status: 500 },
      ),
    );
  }
}

/**
 * POST /api/case-progress
 *
 * Alias for PUT endpoint to support legacy clients.
 * See PUT handler for documentation.
 */
export async function POST(req: NextRequest) {
  return handleCaseProgress(req);
}

/**
 * PUT /api/case-progress
 *
 * Idempotent endpoint for saving/updating case progress.
 * Users can resend the same step data multiple times (e.g., when going back and forth between pages).
 * caseId is required and must reference an existing case.
 */
export async function PUT(req: NextRequest) {
  return handleCaseProgress(req);
}

