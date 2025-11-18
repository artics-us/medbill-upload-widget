// src/app/api/upload-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { signBillToken } from '@/lib/token';
import { storage } from '@/lib/gcs'; // さっきの gcs.ts を使う

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
    const { fileName, mimeType, size } = await req.json();

    // 1) Payload validation
    if (!fileName || !mimeType || !size) {
      return withCors(
        NextResponse.json(
          {
            error:
              'Invalid payload: fileName, mimeType and size are all required.',
          },
          { status: 400 },
        ),
      );
    }

    // 2) Bucket name check
    if (!BUCKET_NAME) {
      console.error('GCS_BUCKET_NAME is not set');
      return withCors(
        NextResponse.json(
          {
            error:
              'Server misconfigured: GCS_BUCKET_NAME is not set on the server.',
          },
          { status: 500 },
        ),
      );
    }

    const billId = crypto.randomUUID();
    const objectPath = `bills/${billId}/${fileName}`;
    const bucketName = BUCKET_NAME;

    // 3) Generate signed URL
    let signedUrl: string;
    try {
      const [url] = await storage
        .bucket(bucketName)
        .file(objectPath)
        .getSignedUrl({
          version: 'v4',
          action: 'write',
          expires: Date.now() + 15 * 60 * 1000, // 15分
          contentType: mimeType,
        });

      signedUrl = url;
    } catch (err) {
      console.error('Error generating signed URL:', err);
      return withCors(
        NextResponse.json(
          {
            error:
              'Failed to generate signed URL. Check GCP credentials and bucket name.',
          },
          { status: 500 },
        ),
      );
    }

    const billToken = signBillToken(billId);
    const gcsPath = `gs://${bucketName}/${objectPath}`;

    return withCors(
      NextResponse.json(
        {
          billId,
          billToken,
          signedUrl,
          gcsPath,
        },
        { status: 200 },
      ),
    );
  } catch (e) {
    console.error('Unexpected error in /api/upload-url:', e);
    return withCors(
      NextResponse.json(
        { error: 'Internal error in /api/upload-url' },
        { status: 500 },
      ),
    );
  }
}
