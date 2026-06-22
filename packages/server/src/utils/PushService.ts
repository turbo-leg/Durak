import admin from 'firebase-admin';

let initialized = false;

function init(): boolean {
  if (initialized) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  try {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    initialized = true;
    return true;
  } catch (e) {
    console.error('[PushService] Failed to initialize Firebase Admin:', e);
    return false;
  }
}

export async function sendTurnNotification(
  deviceTokens: string[],
  username: string,
  roomId: string,
): Promise<void> {
  if (!deviceTokens.length) return;
  if (!init()) return;

  const message: admin.messaging.MulticastMessage = {
    tokens: deviceTokens,
    notification: {
      title: "It's your turn!",
      body: `${username}, time to play your cards in Durak.`,
    },
    data: { roomId },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    if (response.failureCount > 0) {
      response.responses.forEach((r, i) => {
        if (!r.success) {
          console.warn(`[PushService] Token ${deviceTokens[i]} failed:`, r.error?.message);
        }
      });
    }
  } catch (e) {
    console.error('[PushService] sendEachForMulticast error:', e);
  }
}
