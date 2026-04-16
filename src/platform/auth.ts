/**
 * Platform auth abstraction
 *
 * Native: Apple Sign-In (iOS) / Google Sign-In (Android)
 * Toss 미니앱: 토스 로그인 SDK (향후 구현)
 *
 * 이 파일만 교체하면 미니앱 전환 가능
 */

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { supabase } from '../api/client';

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
  // Google OAuth via Supabase — opens browser-based flow
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'pitrun://auth/callback',
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;

  // The URL needs to be opened in an in-app browser
  // This will be handled by the AuthScreen component
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
