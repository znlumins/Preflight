import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createAuthSession, getAuthOrigin, linkAnonymousPlansToUser, upsertGoogleUser } from '@/lib/auth';
import { peekSessionId } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const origin = getAuthOrigin(request);

  if (error) {
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error)}`, origin),
    );
  }

  const jar = await cookies();
  const savedState = jar.get('preflight_oauth_state')?.value;
  jar.delete('preflight_oauth_state');

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/?auth_error=invalid_state', origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL('/?auth_error=google_credentials_missing', origin),
    );
  }

  const redirectUri = `${origin}/api/auth/google/callback`;

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('[Google OAuth] Token exchange failed:', errText);
    return NextResponse.redirect(new URL('/?auth_error=token_exchange_failed', origin));
  }

  const tokens = await tokenRes.json();
  const accessToken = tokens.access_token;

  if (!accessToken) {
    return NextResponse.redirect(new URL('/?auth_error=no_access_token', origin));
  }

  // Fetch Google user profile
  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userinfoRes.ok) {
    console.error('[Google OAuth] Failed to fetch userinfo');
    return NextResponse.redirect(new URL('/?auth_error=userinfo_failed', origin));
  }

  const profile = (await userinfoRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email) {
    return NextResponse.redirect(new URL('/?auth_error=profile_incomplete', origin));
  }

  try {
    // Upsert user in database
    const user = await upsertGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      avatarUrl: profile.picture || null,
    });

    // Automatically migrate / link anonymous plans created with current session cookie
    const sessionId = await peekSessionId();
    if (sessionId) {
      await linkAnonymousPlansToUser(sessionId, user.id);
    }

    // Create login session and set cookie
    await createAuthSession(user.id);

    return NextResponse.redirect(new URL('/?auth_success=1', origin));
  } catch (dbErr) {
    console.error('[Google OAuth] Database error:', dbErr);
    return NextResponse.redirect(new URL('/?auth_error=database_error', origin));
  }
}
