// src/app/api/case-progress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
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
  email?: string;
  phone: string;
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
  submissionId?: string; // Optional: if not provided, server will generate one
  caseId: string; // Required: UUID of the case
  currentStep: string; // Step key (e.g., 'hospital', 'billType', etc.)
  stepData: StepData; // Step-specific data payload
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
      // email is optional, but if provided, must be a valid email address
      if (contactData.email !== undefined) {
        if (typeof contactData.email !== 'string') {
          return {
            valid: false,
            error: 'email must be a string if provided',
          };
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (contactData.email && !emailRegex.test(contactData.email)) {
          return { valid: false, error: 'email must be a valid email address' };
        }
      }
      // phone is required
      if (!contactData.phone || typeof contactData.phone !== 'string') {
        return {
          valid: false,
          error: 'phone is required and must be a string',
        };
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
 * Generate UUID v4
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (Node.js 19+, browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Shared handler for both POST and PUT requests
 * Idempotent endpoint for saving/updating case progress to DB (source of truth).
 * Google Sheets sync is best-effort and does not affect API success.
 */
async function handleCaseProgress(req: NextRequest) {
  try {
    const body: CaseProgressRequest = await req.json();

    // Validate request structure
    if (!body.caseId || typeof body.caseId !== 'string') {
      return withCors(
        NextResponse.json(
          { success: false, error: 'caseId is required and must be a string' },
          { status: 400 },
        ),
      );
    }

    if (!body.currentStep || typeof body.currentStep !== 'string') {
      return withCors(
        NextResponse.json(
          { success: false, error: 'currentStep is required and must be a string' },
          { status: 400 },
        ),
      );
    }

    if (!body.stepData || typeof body.stepData !== 'object') {
      return withCors(
        NextResponse.json(
          { success: false, error: 'stepData is required and must be an object' },
          { status: 400 },
        ),
      );
    }

    // Validate step-specific data (basic shape check for unknown steps)
    const validation = validateStepData(body.currentStep, body.stepData);
    if (!validation.valid) {
      return withCors(
        NextResponse.json(
          { success: false, error: validation.error },
          { status: 400 },
        ),
      );
    }

    const caseId = body.caseId;
    const currentStep = body.currentStep;

    // Generate submissionId if not provided
    const submissionId = body.submissionId || generateUUID();

    // For hospital step, get city from request if not provided in stepData
    let stepDataWithCity = { ...body.stepData };
    if (body.currentStep === 'hospital') {
      const hospitalData = stepDataWithCity as HospitalStepData;
      if (!hospitalData.city) {
        const geo = (req as unknown as { geo?: { city?: string } }).geo;
        if (geo?.city) {
          hospitalData.city = geo.city;
          stepDataWithCity = hospitalData;
        }
      }
    }

    // Extract metadata for observability
    const userAgent = req.headers.get('user-agent') || undefined;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') || undefined;

    // DB Transaction: Insert event and upsert case
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Insert CaseProgressEvent (idempotent via submissionId unique constraint)
        try {
          await tx.caseProgressEvent.create({
            data: {
              submissionId,
              caseId,
              stepKey: currentStep,
              stepVersion: 1,
              payload: stepDataWithCity as Prisma.InputJsonValue,
              source: 'base44',
              userAgent,
              ip: ip ? ip : undefined,
            },
          });
        } catch (eventError: unknown) {
          // Handle unique constraint violation (P2002) - idempotency
          if (
            eventError instanceof Prisma.PrismaClientKnownRequestError &&
            eventError.code === 'P2002'
          ) {
            // submissionId already exists - this is OK, treat as success
            console.log(
              `Idempotent submission detected: submissionId=${submissionId} already exists`,
            );
          } else {
            // Re-throw other errors
            throw eventError;
          }
        }

        // 2. Upsert Case (update currentStep, merge progress JSONB, and extract denormalized columns)
        const existingCase = await tx.case.findUnique({
          where: { caseId },
          select: {
            progress: true,
            contactEmail: true,
            contactPhone: true,
            hospitalName: true,
            balanceAmount: true,
            inCollections: true,
          },
        });

        const existingProgress =
          existingCase?.progress && typeof existingCase.progress === 'object'
            ? (existingCase.progress as Record<string, unknown>)
            : {};

        // Merge new step data into existing progress
        const updatedProgress = {
          ...existingProgress,
          [currentStep]: stepDataWithCity,
        };

        // Extract denormalized columns from stepData for fast filtering/search
        // Strategy: Keep existing values, but update when current step provides new data
        // This allows denormalized columns to be populated from progress JSONB for fast queries
        const updateData: {
          currentStep: string;
          progress: Prisma.InputJsonValue;
          contactEmail?: string | null;
          contactPhone?: string | null;
          hospitalName?: string | null;
          balanceAmount?: Prisma.Decimal | null;
          inCollections?: boolean | null;
        } = {
          currentStep,
          progress: updatedProgress as Prisma.InputJsonValue,
        };

        // Extract fields based on current step
        // Only update denormalized columns if the current step provides relevant data
        switch (currentStep) {
          case 'contact': {
            const contactData = stepDataWithCity as ContactStepData;
            // email is optional, set it if provided
            if (contactData.email !== undefined) {
              updateData.contactEmail = contactData.email || null;
            }
            // phone is required and validated, so always set it
            updateData.contactPhone = contactData.phone;
            break;
          }
          case 'hospital': {
            const hospitalData = stepDataWithCity as HospitalStepData;
            if (hospitalData.hospitalName) {
              updateData.hospitalName = hospitalData.hospitalName;
            }
            break;
          }
          case 'balance': {
            const balanceData = stepDataWithCity as BalanceStepData;
            if (balanceData.balanceAmount !== undefined) {
              updateData.balanceAmount = new Prisma.Decimal(balanceData.balanceAmount);
            }
            if (balanceData.inCollections !== undefined) {
              updateData.inCollections = balanceData.inCollections;
            }
            break;
          }
          // For other steps, don't update denormalized columns (keep existing values)
        }

        // For create: use extracted values or existing values from progress JSONB
        const createData: {
          caseId: string;
          currentStep: string;
          progress: Prisma.InputJsonValue;
          contactEmail?: string | null;
          contactPhone?: string | null;
          hospitalName?: string | null;
          balanceAmount?: Prisma.Decimal | null;
          inCollections?: boolean | null;
        } = {
          caseId,
          currentStep,
          progress: updatedProgress as Prisma.InputJsonValue,
        };

        // For create, try to extract from current step data, otherwise leave undefined
        if (updateData.contactEmail !== undefined) createData.contactEmail = updateData.contactEmail;
        if (updateData.contactPhone !== undefined) createData.contactPhone = updateData.contactPhone;
        if (updateData.hospitalName !== undefined) createData.hospitalName = updateData.hospitalName;
        if (updateData.balanceAmount !== undefined) createData.balanceAmount = updateData.balanceAmount;
        if (updateData.inCollections !== undefined) createData.inCollections = updateData.inCollections;

        await tx.case.upsert({
          where: { caseId },
          create: createData,
          update: updateData, // Prisma will only update fields that are defined (not undefined)
        });
      });
    } catch (dbError: unknown) {
      console.error('Database error in /api/case-progress:', dbError);

      // Determine if error is retryable
      const isRetryable =
        dbError instanceof Prisma.PrismaClientKnownRequestError &&
        (dbError.code === 'P1001' || // Connection error
          dbError.code === 'P1008' || // Operation timed out
          dbError.code === 'P1017'); // Server closed connection

      return withCors(
        NextResponse.json(
          {
            success: false,
            error:
              dbError instanceof Error
                ? dbError.message
                : 'Database error in /api/case-progress',
            retryable: isRetryable,
          },
          { status: isRetryable ? 503 : 500 },
        ),
      );
    }

    // DB save succeeded - now attempt Sheets sync (best-effort)
    let sheetsWarning: string | null = null;
    try {
      await saveCaseProgress(caseId, currentStep, stepDataWithCity);
    } catch (sheetsError: unknown) {
      console.error('Error saving to Google Sheets (non-critical):', sheetsError);
      const err = sheetsError as { message?: string } | null;
      sheetsWarning = err?.message || 'Failed to save to Google Sheets. Check server logs for details.';
      // Continue - Sheets failure does not affect API success
    }

    // Return success response (DB save succeeded)
    const response: {
      success: boolean;
      caseId: string;
      currentStep: string;
      submissionId: string;
      warning?: string;
    } = {
      success: true,
      caseId,
      currentStep,
      submissionId,
    };

    // Include warning if Google Sheets sync failed (but API still succeeded)
    if (sheetsWarning) {
      response.warning = sheetsWarning;
    }

    return withCors(NextResponse.json(response, { status: 200 }));
  } catch (err: unknown) {
    console.error('Unexpected error in /api/case-progress:', err);
    return withCors(
      NextResponse.json(
        {
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Internal error in /api/case-progress',
          retryable: false,
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

