// src/app/api/hospitals/route.ts
import { NextResponse } from 'next/server';
import hospitals from '@/data/hospitals-us.json';

type Hospital = {
  id: string;
  name: string;
  city: string;
  state: string;
};

const HOSPITALS = hospitals as Hospital[];

const ALLOWED_ORIGIN = process.env.BASE44_ORIGIN || '*';

function withCors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return res;
}

// Preflight 用
export async function OPTIONS() {
  return withCors(NextResponse.json({}));
}

// GET /api/hospitals?query=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get('query') || '';
  const q = rawQuery.trim().toLowerCase();

  if (q.length < 2) {
    return withCors(NextResponse.json([]));
  }

  const results = HOSPITALS.filter((h) => {
    const name = h.name.toLowerCase();
    const city = h.city.toLowerCase();
    const state = h.state.toLowerCase();

    return (
      name.includes(q) ||
      city.includes(q) ||
      state.includes(q)
    );
  }).slice(0, 7);

  const payload = results.map((h) => ({
    id: h.id,
    name: h.name,
    subtitle: `${h.city}, ${h.state}`,
  }));

  return withCors(NextResponse.json(payload));
}
