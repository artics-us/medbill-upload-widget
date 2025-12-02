// src/app/api/mixpanel/track/route.ts
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGIN = process.env.BASE44_ORIGIN || '*';
const MIXPANEL_TOKEN = process.env.MIXPANEL_TOKEN;

// List of PII/PHI fields that should never be sent to Mixpanel (HIPAA compliance)
const FORBIDDEN_PROPERTIES = [
  'email',
  'phone',
  'hospitalName',
  'hospitalId',
  'balance',
  'balanceAmount',
  'insuranceStatus',
  'billType',
  'billToken',
  'caseId',
  'name',
  'firstName',
  'lastName',
  'address',
  'zipCode',
  'city',
  'state',
];

/**
 * Remove PII/PHI from properties object to ensure HIPAA compliance
 */
function sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    // Skip forbidden properties
    if (FORBIDDEN_PROPERTIES.includes(key)) {
      console.warn(`Skipping forbidden property: ${key}`);
      continue;
    }

    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      sanitized[key] = sanitizeProperties(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, distinct_id, properties = {} } = body;

    // Validation: event name is required
    if (!event) {
      return withCors(
        NextResponse.json(
          { error: 'Event name required' },
          { status: 400 },
        ),
      );
    }

    // Check if MIXPANEL_TOKEN is set
    if (!MIXPANEL_TOKEN) {
      console.warn(
        'MIXPANEL_TOKEN is not set. Event will not be tracked.',
      );
      // Still return success to avoid breaking frontend flow
      return withCors(
        NextResponse.json({ success: true }, { status: 200 }),
      );
    }

    // Sanitize properties to remove PII/PHI (HIPAA compliance)
    const sanitizedProperties = sanitizeProperties(properties);

    // Prepare Mixpanel event data
    const mixpanelData = {
      data: [
        {
          event,
          properties: {
            token: MIXPANEL_TOKEN,
            distinct_id: distinct_id || 'anonymous',
            time: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
            ...sanitizedProperties,
          },
        },
      ],
    };

    // Send event to Mixpanel Data Ingestion API (Fire and Forget)
    fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/plain',
      },
      body: JSON.stringify(mixpanelData),
    }).catch((err) => {
      console.error('Mixpanel track error:', err);
    });

    // Return success immediately (Fire and Forget)
    return withCors(
      NextResponse.json({ success: true }, { status: 200 }),
    );
  } catch (e) {
    console.error('Unexpected error in /api/mixpanel/track:', e);
    return withCors(
      NextResponse.json(
        { error: 'Internal error in /api/mixpanel/track' },
        { status: 500 },
      ),
    );
  }
}

