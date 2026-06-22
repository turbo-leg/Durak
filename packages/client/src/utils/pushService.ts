import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const SERVER_BASE = import.meta.env.VITE_SERVER_URL ?? '';

export async function initPushNotifications(authToken: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const { receive } = await PushNotifications.requestPermissions();
  if (receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    await registerDeviceToken(token.value, authToken);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.warn('Push registration error:', err.error);
  });

  // Foreground: suppress OS banner — the player is already in the app
  PushNotifications.addListener('pushNotificationReceived', () => {});

  // Tap on notification while app was backgrounded
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const { roomId } = action.notification.data ?? {};
    if (roomId) {
      // GameContext picks up roomId from location state on next render
      window.history.pushState({ pushRoomId: roomId }, '', '/');
      window.dispatchEvent(new Event('pushRoomReturn'));
    }
  });
}

async function registerDeviceToken(token: string, authToken: string): Promise<void> {
  try {
    await fetch(`${SERVER_BASE}/api/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
    });
  } catch (e) {
    console.warn('Failed to register push token:', e);
  }
}

export async function unregisterDeviceToken(token: string, authToken: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await fetch(`${SERVER_BASE}/api/push/unregister`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch (e) {
    console.warn('Failed to unregister push token:', e);
  }
}
