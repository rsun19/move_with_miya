import { NextRequest, NextResponse } from 'next/server';

const USER_SERVICE = 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing code or state' },
      { status: 400 },
    );
  }

  const url = new URL(`${USER_SERVICE}/auth/google/callback`);
  url.searchParams.set('code', code);
  url.searchParams.set('state', state);

  const response = await fetch(url.toString(), {
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
    redirect: 'manual',
  });

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
