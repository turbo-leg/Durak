// Helpers for Google and Apple sign-in across the web build and native iOS (Capacitor).
//
// - Google: Google Identity Services (GIS). We render Google's official button which
//   returns an ID token ("credential") that the server verifies. Web only — Google
//   blocks OAuth inside embedded WebViews, so this is not wired for the native apps.
// - Apple: web uses "Sign in with Apple JS" (popup); native iOS uses the
//   @capacitor-community/apple-sign-in plugin. Both yield an identity token.
import { Capacitor } from '@capacitor/core';

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const APPLE_SERVICES_ID = import.meta.env.VITE_APPLE_SERVICES_ID as string | undefined;
const APPLE_REDIRECT_URI = import.meta.env.VITE_APPLE_REDIRECT_URI as string | undefined;

export const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

// Apple is available on the web (when a Services ID is configured) and natively on iOS.
export const isAppleAvailable = () => isNativeIOS() || !!APPLE_SERVICES_ID;
// Google sign-in is web-only (not inside the native WebView).
export const isGoogleAvailable = () => !!GOOGLE_CLIENT_ID && !Capacitor.isNativePlatform();

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    AppleID?: any;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const scriptPromises = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let p = scriptPromises.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.defer = true;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(el);
    });
    scriptPromises.set(src, p);
  }
  return p;
}

// ── Google ───────────────────────────────────────────────────────────────────

let googleInitialized = false;

// Initializes GIS and renders Google's official sign-in button into `container`.
// `onCredential` receives the Google ID token to send to /api/auth/google.
export async function renderGoogleButton(
  container: HTMLElement,
  onCredential: (credential: string) => void,
): Promise<void> {
  if (!GOOGLE_CLIENT_ID) return;
  await loadScript('https://accounts.google.com/gsi/client');
  if (!window.google?.accounts?.id) return;

  if (!googleInitialized) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp: { credential?: string }) => {
        if (resp.credential) onCredential(resp.credential);
      },
    });
    googleInitialized = true;
  }

  container.innerHTML = '';
  window.google.accounts.id.renderButton(container, {
    theme: 'outline',
    size: 'large',
    type: 'standard',
    text: 'continue_with',
    shape: 'rectangular',
    width: container.clientWidth || 320,
  });
}

// ── Apple ────────────────────────────────────────────────────────────────────

export interface AppleSignInResult {
  identityToken: string;
  fullName?: string;
}

async function appleSignInWeb(): Promise<AppleSignInResult> {
  if (!APPLE_SERVICES_ID) throw new Error('Apple sign-in is not configured');
  await loadScript(
    'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
  );
  window.AppleID.auth.init({
    clientId: APPLE_SERVICES_ID,
    scope: 'name email',
    redirectURI: APPLE_REDIRECT_URI || window.location.origin,
    usePopup: true,
  });
  const data = await window.AppleID.auth.signIn();
  const idToken = data?.authorization?.id_token;
  if (!idToken) throw new Error('Apple sign-in returned no token');
  const name = data?.user?.name;
  const fullName = name
    ? [name.firstName, name.lastName].filter(Boolean).join(' ').trim() || undefined
    : undefined;
  return { identityToken: idToken, fullName };
}

async function appleSignInNative(): Promise<AppleSignInResult> {
  const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
  const { response } = await SignInWithApple.authorize({
    clientId: APPLE_SERVICES_ID || '',
    redirectURI: APPLE_REDIRECT_URI || '',
    scopes: 'name email',
  });
  if (!response?.identityToken) throw new Error('Apple sign-in returned no token');
  const fullName =
    [response.givenName, response.familyName].filter(Boolean).join(' ').trim() || undefined;
  return { identityToken: response.identityToken, fullName };
}

export function signInWithApple(): Promise<AppleSignInResult> {
  return isNativeIOS() ? appleSignInNative() : appleSignInWeb();
}
