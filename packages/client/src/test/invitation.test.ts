import { afterEach, describe, expect, it } from 'vitest';
import {
  clearInvitationFromUrl,
  invitationLink,
  invitedTableId,
  parseInvitation,
} from '../game/invitation';
import { seatStatus } from '../game/tableSnapshot';

afterEach(() => history.replaceState({}, '', '/'));

describe('invitation links', () => {
  it('builds a link that opens the table and round-trips through parsing', () => {
    history.replaceState({}, '', '/?code=oauth#x');
    const link = invitationLink('AbC_12-x');
    expect(new URL(link).searchParams.get('table')).toBe('AbC_12-x');
    expect(new URL(link).searchParams.has('code')).toBe(false);
    expect(parseInvitation(link)).toBe('AbC_12-x');
  });

  it('accepts bare codes and rejects anything that is not a room id', () => {
    expect(parseInvitation('  CaseSensitive123 ')).toBe('CaseSensitive123');
    expect(parseInvitation('https://example.com/?table=../../x')).toBeNull();
    expect(parseInvitation('not a code')).toBeNull();
    expect(parseInvitation('https://example.com/')).toBeNull();
  });

  it('reads and then clears the invitation from the page address', () => {
    history.replaceState({}, '', '/?table=Room42&keep=1');
    expect(invitedTableId()).toBe('Room42');
    clearInvitationFromUrl();
    expect(invitedTableId()).toBeNull();
    expect(location.search).toBe('?keep=1');
  });
});

describe('public seat status', () => {
  const seat = { id: 's', name: 'Ana', count: 4, active: false, escaped: false };
  it('shows readiness between games and cards during play', () => {
    expect(seatStatus({ ...seat, ready: true }, true)).toBe('Ready');
    expect(seatStatus({ ...seat, ready: false }, true)).toBe('Not ready');
    expect(seatStatus({ ...seat, bot: true }, true)).toBe('Bot');
    expect(seatStatus(seat, false)).toBe('4 cards');
    expect(seatStatus({ ...seat, escaped: true }, false)).toBe('Won');
    expect(seatStatus({ ...seat, connected: false }, false)).toBe('Reconnecting');
    expect(seatStatus({ ...seat, connected: false, standin: true }, false)).toBe('Bot playing');
  });
});
