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

/**
 * Extract OS information from User-Agent string
 */
function extractOS(userAgent: string | null): string | undefined {
  if (!userAgent) return undefined;

  const ua = userAgent.toLowerCase();

  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'iOS';

  return undefined;
}

/**
 * Get geographic and device information from request
 */
function getRequestMetadata(req: NextRequest): {
  $country_code?: string;
  $region?: string;
  $city?: string;
  $os?: string;
} {
  const metadata: {
    $country_code?: string;
    $region?: string;
    $city?: string;
    $os?: string;
  } = {};

  // Get geographic information from Vercel's geo object
  // Note: req.geo is available in Vercel runtime but not in TypeScript types
  const geo = (req as unknown as { geo?: { country?: string; region?: string; city?: string } })
    .geo;
  if (geo) {
    if (geo.country) {
      metadata.$country_code = geo.country;
    }
    if (geo.region) {
      metadata.$region = geo.region;
    }
    if (geo.city) {
      metadata.$city = geo.city;
    }
  }

  // Extract OS from User-Agent
  const userAgent = req.headers.get('user-agent');
  const os = extractOS(userAgent);
  if (os) {
    metadata.$os = os;
  }

  return metadata;
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

    // Get geographic and device information from request
    const requestMetadata = getRequestMetadata(req);

    // Prepare Mixpanel event data
    const eventData = {
      event,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: distinct_id || 'anonymous',
        time: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
        // Add geographic and device information
        ...requestMetadata,
        // Add sanitized properties from client (these can override metadata if needed)
        ...sanitizedProperties,
      },
    };

    // Mixpanel Data Ingestion API requires base64-encoded JSON
    // Format: data=[base64_encoded_json_array]
    const jsonString = JSON.stringify([eventData]);
    const base64Data = Buffer.from(jsonString).toString('base64');

    // Send event to Mixpanel Data Ingestion API
    // We await the fetch to ensure it completes, but errors won't affect the client response
    try {
      const response = await fetch('https://api.mixpanel.com/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'text/plain',
        },
        body: `data=${encodeURIComponent(base64Data)}`,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[Mixpanel] API error: ${response.status} ${response.statusText}`,
          errorText,
        );
        console.error('[Mixpanel] Failed event:', event);
        console.error('[Mixpanel] Request body:', `data=${base64Data.substring(0, 100)}...`);
        // Still return success to client
      } else {
        const result = await response.text();
        // Mixpanel returns "1" on success, "0" on failure
        if (result.trim() === '1') {
          console.log(`[Mixpanel] Event tracked successfully: ${event}`);
        } else {
          console.error(
            `[Mixpanel] Track failed. Response: "${result}"`,
            `Event: ${event}`,
            `Event data: ${JSON.stringify(eventData, null, 2)}`,
          );
          // Log the base64 data for debugging (first 100 chars only)
          console.error(
            `[Mixpanel] Base64 data (first 100 chars): ${base64Data.substring(0, 100)}...`,
          );
        }
      }
    } catch (err) {
      // Log error but don't fail the request
      console.error('[Mixpanel] Track error:', err);
      console.error('[Mixpanel] Failed event:', event);
      console.error(
        '[Mixpanel] Failed event data:',
        JSON.stringify(eventData, null, 2),
      );
    }

    // Always return success to client (Fire and Forget pattern)
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

