const ROOM_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** A shareable link that opens the table preview. The room code remains the fallback. */
export function invitationLink(roomId: string): string {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('table', roomId);
  return url.toString();
}

/** Accepts a pasted invitation link or a bare room code. */
export function parseInvitation(input: string): string | null {
  const text = input.trim();
  if (ROOM_ID.test(text)) return text;
  try {
    const table = new URL(text).searchParams.get('table');
    return table && ROOM_ID.test(table) ? table : null;
  } catch {
    return null;
  }
}

/** The table named by the current page's invitation link, if any. */
export function invitedTableId(): string | null {
  const table = new URLSearchParams(location.search).get('table');
  return table && ROOM_ID.test(table) ? table : null;
}

export function clearInvitationFromUrl() {
  const url = new URL(location.href);
  if (!url.searchParams.has('table')) return;
  url.searchParams.delete('table');
  history.replaceState({}, '', url.pathname + url.search + url.hash);
}
