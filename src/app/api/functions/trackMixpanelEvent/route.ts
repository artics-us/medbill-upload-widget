// src/app/api/functions/trackMixpanelEvent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

const ALLOWED_ORIGIN = process.env.BASE44_ORIGIN || '*';
// Support both MIXPANEL_PROJECT_TOKEN (new) and MIXPANEL_TOKEN (existing)
const MIXPANEL_TOKEN =
  process.env.MIXPANEL_PROJECT_TOKEN || process.env.MIXPANEL_TOKEN;

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
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod'))
    return 'iOS';

  return undefined;
}

/**
 * Get geographic and device information from request
 *
 * Note: When called via Base44 proxy, req.geo might contain Base44 server's location
 * instead of the actual user's location. In such cases, the client should send
 * geographic information explicitly in the request body properties.
 */
function getRequestMetadata(req: NextRequest): {
  $country?: string;
  $region?: string;
  $city?: string;
  $os?: string;
} {
  const metadata: {
    $country?: string;
    $region?: string;
    $city?: string;
    $os?: string;
  } = {};

  // Get geographic information from Vercel's geo object
  // Note: req.geo is available in Vercel runtime but not in TypeScript types
  // When called via Base44 proxy, this might be Base44 server's location, not user's location
  // Note: Vercel's geo.country returns country code (e.g., "US", "JP"), but we use $country for country name
  // Frontend should send $country with full country name (e.g., "United States", "Japan")
  const geo = (req as unknown as {
    geo?: { country?: string; region?: string; city?: string };
  }).geo;
  if (geo) {
    // Vercel returns country code, but we'll use it as-is for now
    // Frontend should send full country name in $country property
    if (geo.country) {
      metadata.$country = geo.country; // This will be country code from Vercel
    }
    if (geo.region) {
      metadata.$region = geo.region;
    }
    if (geo.city) {
      metadata.$city = geo.city;
    }
  }

  // Extract OS from User-Agent
  // Note: When called via Base44 proxy, this might be Base44 server's User-Agent
  // The client should send User-Agent info explicitly if needed
  const userAgent = req.headers.get('user-agent');
  const os = extractOS(userAgent);
  if (os) {
    metadata.$os = os;
  }

  // Debug logging to help diagnose Base44 proxy issues
  if (process.env.NODE_ENV === 'development') {
    console.log('[Mixpanel] Request metadata:', {
      geo: geo || 'not available',
      userAgent: userAgent || 'not available',
      extractedOS: os || 'not available',
      xForwardedFor: req.headers.get('x-forwarded-for'),
      xRealIp: req.headers.get('x-real-ip'),
    });
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
    const { event, properties = {}, distinctId, type = 'track' } = body;

    // Validation: type must be one of the allowed values
    if (!['track', 'identify', 'set'].includes(type)) {
      return withCors(
        NextResponse.json(
          { error: 'Invalid type. Must be "track", "identify", or "set"' },
          { status: 400 },
        ),
      );
    }

    // Validation: event name is required for track type
    if (type === 'track' && !event) {
      return withCors(
        NextResponse.json(
          { error: 'Event name required for track type' },
          { status: 400 },
        ),
      );
    }

    // Validation: distinctId is required for identify and set types
    if ((type === 'identify' || type === 'set') && !distinctId) {
      return withCors(
        NextResponse.json(
          { error: 'distinctId required for identify and set types' },
          { status: 400 },
        ),
      );
    }

    // Check if MIXPANEL_TOKEN is set
    if (!MIXPANEL_TOKEN) {
      console.warn(
        'MIXPANEL_PROJECT_TOKEN or MIXPANEL_TOKEN is not set. Event will not be tracked.',
      );
      // Still return success to avoid breaking frontend flow
      return withCors(
        NextResponse.json({ success: true }, { status: 200 }),
      );
    }

    // Get geographic and device information from request
    const requestMetadata = getRequestMetadata(req);

    if (type === 'track') {
      // Track event
      // Priority: client properties > server metadata
      // This ensures client-sent properties (like $city) take precedence over server-detected ones
      const eventData = {
        event: event,
        properties: {
          token: MIXPANEL_TOKEN,
          distinct_id: distinctId || randomUUID(),
          time: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
          // Add server-detected geographic and device information first
          ...requestMetadata,
          // Add properties from client (these override server metadata if provided)
          ...properties,
        },
      };

      // Mixpanel Track API expects JSON array
      try {
        const response = await fetch('https://api.mixpanel.com/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([eventData]),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[Mixpanel] Track API error: ${response.status} ${response.statusText}`,
            errorText,
          );
          console.error('[Mixpanel] Failed event:', event);
        } else {
          await response.json();
          console.log(`[Mixpanel] Event tracked successfully: ${event}`);
        }
      } catch (err) {
        // Log error but don't fail the request
        console.error('[Mixpanel] Track error:', err);
        console.error('[Mixpanel] Failed event:', event);
      }
    } else if (type === 'identify' || type === 'set') {
      // Set user properties or identify user
      const engageData: {
        $token: string;
        $distinct_id: string;
        $set?: Record<string, unknown>;
        $identify?: string;
      } = {
        $token: MIXPANEL_TOKEN,
        $distinct_id: distinctId,
      };

      if (type === 'set') {
        // Set user properties
        engageData.$set = properties;
      } else {
        // Identify user
        engageData.$identify = distinctId;
      }

      // Mixpanel Engage API expects JSON array
      try {
        const response = await fetch('https://api.mixpanel.com/engage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([engageData]),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[Mixpanel] Engage API error: ${response.status} ${response.statusText}`,
            errorText,
          );
          console.error(
            `[Mixpanel] Failed ${type} operation for distinctId:`,
            distinctId,
          );
        } else {
          await response.json();
          console.log(
            `[Mixpanel] ${type} operation completed successfully for distinctId:`,
            distinctId,
          );
        }
      } catch (err) {
        // Log error but don't fail the request
        console.error(`[Mixpanel] ${type} error:`, err);
        console.error(
          `[Mixpanel] Failed ${type} operation for distinctId:`,
          distinctId,
        );
      }
    }

    // Always return success to client (Fire and Forget pattern)
    return withCors(
      NextResponse.json({ success: true }, { status: 200 }),
    );
  } catch (e) {
    console.error(
      'Unexpected error in /api/functions/trackMixpanelEvent:',
      e,
    );
    return withCors(
      NextResponse.json(
        { error: 'Internal error in /api/functions/trackMixpanelEvent' },
        { status: 500 },
      ),
    );
  }
}

