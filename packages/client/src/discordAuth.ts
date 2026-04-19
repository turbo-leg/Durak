import { DiscordSDK } from '@discord/embedded-app-sdk';

const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID || '1493531312206647406';

export const isEmbedded = window.location.search.includes('frame_id') || document.referrer.includes('discord.com');

// Only instantiate the DiscordSDK if we are actually embedded in Discord
export const discordSdk = isEmbedded ? new DiscordSDK(clientId) : null;

export async function setupDiscordSdk() {
  if (!discordSdk) return null;
  await discordSdk.ready();

  // Authorize with Discord Client
  const { code } = await discordSdk.commands.authorize({
    client_id: clientId,
    response_type: "code",
    state: "",
    prompt: "none",
    scope: [
      "identify",
      "guilds",
    ],
  });

  // Exchange authorization code for an access token from the backend
  const response = await fetch('/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to exchange code: ${response.statusText}`);
  }

  const { access_token } = await response.json();

  // Authenticate with the Discord client payload
  const auth = await discordSdk.commands.authenticate({
    access_token,
  });

  if (auth == null) {
    throw new Error("Authenticate command failed");
  }

  return auth;
}

export type DiscordAuthInfo = NonNullable<Awaited<ReturnType<typeof setupDiscordSdk>>>;
