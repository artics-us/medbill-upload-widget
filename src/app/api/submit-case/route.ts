// src/app/api/submit-case/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/gcs';

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const ALLOWED_ORIGIN = process.env.BASE44_ORIGIN || '*';

// Brevo config (all from environment variables)
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_REDIRECT_URL = process.env.BREVO_REDIRECT_URL;

const BREVO_INCLUDE_LIST_ID = process.env.BREVO_INCLUDE_LIST_ID
  ? Number(process.env.BREVO_INCLUDE_LIST_ID)
  : undefined;

const BREVO_EXCLUDE_LIST_ID = process.env.BREVO_EXCLUDE_LIST_ID
  ? Number(process.env.BREVO_EXCLUDE_LIST_ID)
  : undefined;

const BREVO_TEMPLATE_ID = process.env.BREVO_TEMPLATE_ID
  ? Number(process.env.BREVO_TEMPLATE_ID)
  : undefined;

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

export async function OPTIONS() {
  // CORS preflight
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  try {
    if (!BUCKET_NAME) {
      console.error('GCS_BUCKET_NAME is not set');
      return withCors(
        NextResponse.json(
          { error: 'Server misconfigured: GCS_BUCKET_NAME is not set.' },
          { status: 500 },
        ),
      );
    }

    const body = await req.json();

    const {
      caseId,
      billToken,
      hospital,
      billType,
      balance,
      inCollections,
      insuranceStatus,
      email,
      phone,
      extraAnswers,
    } = body;

    // Basic validation for required fields
    if (!caseId || !email) {
      return withCors(
        NextResponse.json(
          { error: 'caseId and email are required.' },
          { status: 400 },
        ),
      );
    }

    //
    // 1) Save case meta JSON to GCS
    //
    const payload = {
      caseId,
      billToken: billToken || null,
      patient: {
        email,
        phone: phone || null,
      },
      bill: {
        hospital: hospital || null,
        billType: billType || null,
        balance: balance ?? null,
        inCollections:
          typeof inCollections === 'boolean' ? inCollections : null,
        insuranceStatus: insuranceStatus || null,
      },
      extraAnswers: extraAnswers || null,
      meta: {
        createdAt: new Date().toISOString(),
        source: 'base44-flow',
      },
    };

    // Store under the same caseId directory as the uploaded file:
    // e.g. gs://<bucket>/bills/<caseId>/meta.json
    const objectPath = `bills/${caseId}/meta.json`;

    const file = storage.bucket(BUCKET_NAME).file(objectPath);

    await file.save(JSON.stringify(payload, null, 2), {
      contentType: 'application/json',
    });

    console.log('Saved case JSON to GCS:', `gs://${BUCKET_NAME}/${objectPath}`);

    //
    // 2) Trigger Brevo Double Opt-In (DOI) with the same shape as your curl
    //
    let doiStatus: 'skipped' | 'sent' | 'failed' = 'skipped';
    let doiError: string | null = null;

    const brevoConfigured =
      BREVO_API_KEY &&
      BREVO_REDIRECT_URL &&
      typeof BREVO_INCLUDE_LIST_ID === 'number' &&
      typeof BREVO_EXCLUDE_LIST_ID === 'number' &&
      typeof BREVO_TEMPLATE_ID === 'number';

    if (!brevoConfigured) {
      console.warn(
        'Brevo DOI not fully configured; skipping DOI call. Check BREVO_API_KEY, BREVO_REDIRECT_URL, BREVO_INCLUDE_LIST_ID, BREVO_EXCLUDE_LIST_ID, BREVO_TEMPLATE_ID.',
      );
      doiStatus = 'skipped';
    } else {
      try {
        const brevoRes = await fetch(
          'https://api.brevo.com/v3/contacts/doubleOptinConfirmation',
          {
            method: 'POST',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              'api-key': BREVO_API_KEY as string,
            },
            body: JSON.stringify({
              attributes: {
                CONSENT_STATUS: 'pending',
                CASE_ID: caseId,
              },
              includeListIds: [BREVO_INCLUDE_LIST_ID],
              excludeListIds: [BREVO_EXCLUDE_LIST_ID],
              email, // user-submitted email
              redirectionUrl: BREVO_REDIRECT_URL,
              templateId: BREVO_TEMPLATE_ID,
            }),
          },
        );

        if (!brevoRes.ok) {
          const txt = await brevoRes.text();
          console.error(
            'Brevo DOI API error:',
            brevoRes.status,
            brevoRes.statusText,
            txt,
          );
          doiStatus = 'failed';
          doiError = `Brevo DOI failed with status ${brevoRes.status}`;
        } else {
          doiStatus = 'sent';
        }
      } catch (err: unknown) {
        console.error('Error calling Brevo DOI API:', err);
        doiStatus = 'failed';
        doiError =
          err instanceof Error ? err.message : 'Unknown Brevo error';
      }
    }

    // For MVP: even if DOI fails, we still return 200 but include status
    return withCors(
      NextResponse.json(
        {
          ok: true,
          gcsPath: `gs://${BUCKET_NAME}/${objectPath}`,
          doubleOptIn: {
            status: doiStatus,
            error: doiError,
          },
        },
        { status: 200 },
      ),
    );
  } catch (err: unknown) {
    console.error('Error in /api/submit-case:', err);
    return withCors(
      NextResponse.json(
        { error: 'Internal error in /api/submit-case' },
        { status: 500 },
      ),
    );
  }
}
