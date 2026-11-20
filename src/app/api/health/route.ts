import { NextResponse } from 'next/server';
import { GROUP } from '@/lib/facebook';

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: 'novels-studio',
    group: { id: GROUP.id, name: GROUP.name, url: GROUP.url },
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    time: new Date().toISOString(),
  });
}
