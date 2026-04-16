/**
 * Platform auth abstraction
 *
 * Native: Apple Sign-In (iOS) / Google Sign-In (Android)
 * Toss 미니앱: 토스 로그인 SDK (향후 구현)
 *
 * 이 파일만 교체하면 미니앱 전환 가능
 */

import { Linking, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from '../api/client';

// ─── Deep link listener for OAuth callback ──────────────────────────────────

/**
 * 앱 시작 시 1회 호출. Google OAuth redirect URL에서 돌아올 때
 * Supabase 세션을 자동으로 설정해준다.
 */
export function setupDeepLinkListener() {
  const handleUrl = async (event: { url: string }) => {
    const url = event.url;
    if (!url.startsWith('pitrun://auth/callback')) return;

    // Extract tokens from fragment (#access_token=...&refresh_token=...)
    const fragment = url.split('#')[1];
    if (!fragment) return;

    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }
  };

  // Listen for incoming links
  const subscription = Linking.addEventListener('url', handleUrl);

  // Handle cold start (app was closed, opened via URL)
  Linking.getInitialURL().then((url) => {
    if (url) handleUrl({ url });
  });

  return subscription;
}

// ─── Apple Sign-In (iOS) ────────────────────────────────────────────────────

async function signInWithApple() {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('Apple Sign-In: no identity token');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });

  if (error) throw error;
  return data;
}

// ─── Google Sign-In (Android / iOS fallback) ────────────────────────────────

async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'pitrun://auth/callback',
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;

  // Open the auth URL in system browser
  if (data.url) {
    await Linking.openURL(data.url);
  }

  return data;
}

// ─── Public interface ───────────────────────────────────────────────────────

export async function signIn(provider: 'apple' | 'google') {
  if (provider === 'apple') {
    return signInWithApple();
  }
  return signInWithGoogle();
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function onAuthStateChange(
  callback: (event: string, session: unknown) => void,
) {
  return supabase.auth.onAuthStateChange(callback);
}

/** iOS에서 Apple Sign-In 가능 여부 */
export function isAppleAuthAvailable(): boolean {
  return Platform.OS === 'ios';
}
