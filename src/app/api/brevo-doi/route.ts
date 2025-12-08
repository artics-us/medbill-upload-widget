// src/app/api/brevo-doi/route.ts

import { NextRequest, NextResponse } from 'next/server';

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
    const body = await req.json();
    const { email } = body;

    // Basic validation for required fields
    if (!email) {
      return withCors(
        NextResponse.json(
          { error: 'email is required.' },
          { status: 400 },
        ),
      );
    }

    // Check if Brevo is fully configured
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
      return withCors(
        NextResponse.json(
          {
            ok: false,
            status: 'skipped',
            error: 'Brevo DOI is not fully configured on the server.',
          },
          { status: 200 },
        ),
      );
    }

    // Trigger Brevo Double Opt-In (DOI)
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
        return withCors(
          NextResponse.json(
            {
              ok: false,
              status: 'failed',
              error: `Brevo DOI failed with status ${brevoRes.status}: ${txt}`,
            },
            { status: 200 },
          ),
        );
      }

      const brevoData = await brevoRes.json().catch(() => null);
      return withCors(
        NextResponse.json(
          {
            ok: true,
            status: 'sent',
            data: brevoData,
          },
          { status: 200 },
        ),
      );
    } catch (err: any) {
      console.error('Error calling Brevo DOI API:', err);
      return withCors(
        NextResponse.json(
          {
            ok: false,
            status: 'failed',
            error: err?.message || 'Unknown Brevo error',
          },
          { status: 200 },
        ),
      );
    }
  } catch (err: unknown) {
    console.error('Error in /api/brevo-doi:', err);
    return withCors(
      NextResponse.json(
        { error: 'Internal error in /api/brevo-doi' },
        { status: 500 },
      ),
    );
  }
}

