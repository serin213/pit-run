// =============================================================
// PIT RUN — Live Activity APNs push (Supabase Edge Function, Deno)
// =============================================================
// 클라이언트가 boxbox/fullPush/final/finish 시각 전환(priority 10) 또는 일반 거리
// 갱신(priority 5) 시 호출한다. 이 함수가 토큰 조회 + APNs JWT 서명 + 전송을 담당.
//
// 로컬 GPS/오디오 트리거 소유권과 무관 — Lock Screen / Dynamic Island 렌더 신뢰성
// 보강 전용. APNs auth key(.p8)는 오직 서버 시크릿에만 존재한다.
//
// 필요한 시크릿 (supabase secrets set ...):
//   APNS_AUTH_KEY_P8  — .p8 파일 내용 전체 (-----BEGIN PRIVATE KEY----- 포함)
//   APNS_KEY_ID       — APNs Auth Key ID (10자)
//   APNS_TEAM_ID      — Apple Developer Team ID (10자)
//   APNS_BUNDLE_ID    — com.pitrun.apps
//   APNS_ENV          — production | sandbox (토큰 row.environment를 우선, 없으면 이 값)
//
// 참고:
//   https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
//   WWDC23 10185 — Update Live Activities with push notifications
//
// deno-lint-ignore-file no-explicit-any
// @ts-nocheck  (Deno 런타임 전용 — 앱 tsc 대상 아님; tsconfig에서 supabase/functions 제외)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APNS_BUNDLE_ID = Deno.env.get('APNS_BUNDLE_ID') ?? 'com.pitrun.apps';
const APNS_TOPIC = `${APNS_BUNDLE_ID}.push-type.liveactivity`;
const APNS_KEY_ID = Deno.env.get('APNS_KEY_ID') ?? '';
const APNS_TEAM_ID = Deno.env.get('APNS_TEAM_ID') ?? '';
const APNS_AUTH_KEY_P8 = Deno.env.get('APNS_AUTH_KEY_P8') ?? '';
const APNS_ENV_DEFAULT = (Deno.env.get('APNS_ENV') ?? 'production').toLowerCase();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── ES256 JWT (APNs provider token) — 50분 캐시 ──────────────────────────────
let cachedJwt: { token: string; createdAtMs: number } | null = null;
let cachedSigningKey: CryptoKey | null = null;

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlEncodeString(str: string): string {
  return base64UrlEncode(new TextEncoder().encode(str));
}

function pemToPkcs8Der(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return der;
}

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedSigningKey) return cachedSigningKey;
  const der = pemToPkcs8Der(APNS_AUTH_KEY_P8);
  cachedSigningKey = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  return cachedSigningKey;
}

async function getProviderJwt(): Promise<string> {
  const FIFTY_MIN_MS = 50 * 60 * 1000;
  if (cachedJwt && Date.now() - cachedJwt.createdAtMs < FIFTY_MIN_MS) {
    return cachedJwt.token;
  }
  const header = { alg: 'ES256', kid: APNS_KEY_ID };
  const iat = Math.floor(Date.now() / 1000);
  const payload = { iss: APNS_TEAM_ID, iat };
  const signingInput = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(payload))}`;
  const key = await getSigningKey();
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  // Web Crypto ECDSA는 IEEE P1363 (r||s) raw 서명을 반환 — JWT ES256 규격과 동일.
  const token = `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
  cachedJwt = { token, createdAtMs: Date.now() };
  return token;
}

function apnsHost(environment: string): string {
  return environment === 'sandbox'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';
}

// ── APNs liveactivity payload ────────────────────────────────────────────────
// content-state는 PitRunAttributes.ContentState와 정확히 1:1 (camelCase 유지).
function buildApnsPayload(input: {
  contentState: Record<string, unknown>;
  event: 'update' | 'end';
  timestampMs: number;
  staleDateMs?: number;
  relevanceScore?: number;
  dismissalDateMs?: number;
}): Record<string, unknown> {
  const aps: Record<string, unknown> = {
    timestamp: Math.floor(input.timestampMs / 1000),
    event: input.event,
    'content-state': input.contentState,
  };
  if (input.staleDateMs != null) aps['stale-date'] = Math.floor(input.staleDateMs / 1000);
  if (input.relevanceScore != null) aps['relevance-score'] = input.relevanceScore;
  if (input.dismissalDateMs != null) aps['dismissal-date'] = Math.floor(input.dismissalDateMs / 1000);
  return { aps };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!APNS_AUTH_KEY_P8 || !APNS_KEY_ID || !APNS_TEAM_ID) {
    return new Response(JSON.stringify({ error: 'APNs secrets not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const {
    activityId,
    contentState,
    priority = 5,
    event = 'update',
    staleDateMs,
    relevanceScore,
    dismissalDateMs,
  } = body ?? {};

  if (!activityId || (event === 'update' && !contentState)) {
    return new Response(JSON.stringify({ error: 'activityId and contentState required' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // 호출자 JWT로 토큰 조회 — RLS가 본인 row만 노출하므로 권한 위반 차단.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: row, error: dbError } = await supabase
    .from('live_activity_push_tokens')
    .select('push_token, environment, status')
    .eq('activity_id', activityId)
    .maybeSingle();

  if (dbError) {
    return new Response(JSON.stringify({ error: 'db error', detail: dbError.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (!row || row.status !== 'active') {
    return new Response(JSON.stringify({ error: 'no active token for activity' }), {
      status: 404,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const environment = (row.environment ?? APNS_ENV_DEFAULT) || 'production';
  const payload = buildApnsPayload({
    contentState: contentState ?? {},
    event,
    timestampMs: Date.now(),
    staleDateMs,
    relevanceScore,
    dismissalDateMs,
  });

  const jwt = await getProviderJwt();
  const url = `${apnsHost(environment)}/3/device/${row.push_token}`;
  // priority 10은 시각 전환(boxbox/fullPush/final/finish) 즉시 렌더, 5는 일반 cadence.
  const apnsPriority = priority === 10 ? '10' : '5';

  const apnsRes = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': APNS_TOPIC,
      'apns-push-type': 'liveactivity',
      'apns-priority': apnsPriority,
      // liveactivity는 apns-expiration 0(즉시 폐기) 대신 짧은 유효기간 권장.
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 60),
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const apnsText = await apnsRes.text();
  const ok = apnsRes.ok;
  return new Response(
    JSON.stringify({
      ok,
      apnsStatus: apnsRes.status,
      apnsId: apnsRes.headers.get('apns-id'),
      apnsBody: apnsText || null,
    }),
    {
      status: ok ? 200 : 502,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    },
  );
});
