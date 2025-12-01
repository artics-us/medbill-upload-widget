// src/app/api/contact/route.ts
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/gcs';

const BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const ALLOWED_ORIGIN = process.env.BASE44_ORIGIN || '*';

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
      hospital,
      billType,
      balance,
      inCollections,
      insuranceStatus,
      email,
      phone,
      extraAnswers,
    } = body;

    if (!email) {
      return withCors(
        NextResponse.json({ error: 'email is required.' }, { status: 400 }),
      );
    }

    const caseId = crypto.randomUUID();
    const payload = {
      caseId,
      contact: {
        hospital: hospital || null,
        billType: billType || null,
        balance: balance ?? null,
        inCollections:
          typeof inCollections === 'boolean' ? inCollections : null,
        insuranceStatus: insuranceStatus || null,
        email,
        phone: phone || null,
        extraAnswers: extraAnswers || null,
      },
      meta: {
        createdAt: new Date().toISOString(),
        source: 'contact-api',
      },
    };

    const objectPath = `bills/${caseId}/contact.json`;
    const file = storage.bucket(BUCKET_NAME).file(objectPath);

    await file.save(JSON.stringify(payload, null, 2), {
      contentType: 'application/json',
    });

    console.log(
      'Saved contact JSON to GCS:',
      `gs://${BUCKET_NAME}/${objectPath}`,
    );

    return withCors(
      NextResponse.json(
        {
          ok: true,
          caseId,
          gcsPath: `gs://${BUCKET_NAME}/${objectPath}`,
        },
        { status: 200 },
      ),
    );
  } catch (err) {
    console.error('Error in /api/contact:', err);
    return withCors(
      NextResponse.json(
        { error: 'Internal error in /api/contact' },
        { status: 500 },
      ),
    );
  }
}

