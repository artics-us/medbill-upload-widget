// src/app/api/hospitals/route.ts
import { NextResponse } from 'next/server';
import hospitals from '@/data/hospitals-us.json';

type Hospital = {
  id: string;
  name: string;
  city: string;
  state: string;
};

// Safety: assert the imported JSON type
const HOSPITALS = hospitals as Hospital[];

// GET /api/hospitals?query=...
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawQuery = searchParams.get('query') || '';
  const q = rawQuery.trim().toLowerCase();

  // If query is too short, return empty list
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // Simple substring match on name/city/state
  const results = HOSPITALS.filter((h) => {
    const name = h.name.toLowerCase();
    const city = h.city.toLowerCase();
    const state = h.state.toLowerCase();

    return (
      name.includes(q) ||
      city.includes(q) ||
      state.includes(q)
    );
  }).slice(0, 7); // limit to 7 results

  // Return a minimal payload for the UI
  return NextResponse.json(
    results.map((h) => ({
      id: h.id,
      name: h.name,
      subtitle: `${h.city}, ${h.state}`,
    })),
  );
}
