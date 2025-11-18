// src/app/api/ping/route.ts
import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGIN = process.env.BASE44_ORIGIN || '*';

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  return withCors(
    NextResponse.json(
      { ok: true, message: 'hello from Next.js API' },
      { status: 200 },
    ),
  );
}
