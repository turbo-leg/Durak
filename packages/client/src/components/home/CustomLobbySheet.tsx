import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomAvailable } from 'colyseus.js';
import { useGame } from '../../contexts/GameContext';
import { LoginPanel } from '../LoginPanel';
import { colors, gradients, shadows, radii, fonts } from '../../theme';
import { GoldButton, SectionLabel, TextInput, Select } from '../ui';
import { getAvailablePlayers, getAvailableHandSizes } from './helpers';

export function CustomLobbySheet({
  discordId,
  userId,
  username,
  avatarUrl,
}: {
  discordId?: string;
  userId?: string;
  username?: string;
  avatarUrl?: string;
}) {
  const { createGame, joinGame, spectateGame, findPublicGames } = useGame();
  const { t } = useTranslation('home');
  const [tab, setTab] = useState<'create' | 'join' | 'browse'>('create');
  const [isLoading, setIsLoading] = useState(false);
  const [rooms, setRooms] = useState<RoomAvailable[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState('classic');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [handSize, setHandSize] = useState(5);
  const [teamSelection, setTeamSelection] = useState<'random' | 'manual'>('random');

  const fetchRooms = useCallback(async () => {
    try {
      setRooms(await findPublicGames());
    } catch {
      /* ignore */
    }
  }, [findPublicGames]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'browse') void fetchRooms();
  }, [tab, fetchRooms]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <LoginPanel />

      {/* Tab strip — gold underline */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: 4,
          borderRadius: radii.md,
          background: 'rgba(0,0,0,0.45)',
          border: '1px solid rgba(212,175,55,0.15)',
          boxShadow: shadows.engrave,
        }}
      >
        {(['create', 'join', 'browse'] as const).map((tabKey) => {
          const active = tab === tabKey;
          return (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              style={{
                flex: 1,
                padding: '11px 0',
                borderRadius: radii.sm,
                border: 'none',
                cursor: 'pointer',
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase',
                background: active ? gradients.gold : 'transparent',
                color: active ? colors.ink[900] : colors.ivory[300],
                textShadow: active ? '0 1px 0 rgba(255,255,255,0.3)' : undefined,
                boxShadow: active ? shadows.engrave : 'none',
                transition: 'all 0.18s',
              }}
            >
              {t(`custom.${tabKey}`)}
            </button>
          );
        })}
      </div>

      {tab === 'create' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <SectionLabel>{t('custom.mode')}</SectionLabel>
            <Select
              value={mode}
              onChange={(e) => {
                const m = e.target.value;
                setMode(m);
                const vp = getAvailablePlayers(m);
                const np = vp.includes(maxPlayers) ? maxPlayers : vp[0]!;
                setMaxPlayers(np);
                const vh = getAvailableHandSizes(m, np);
                if (!vh.includes(handSize)) setHandSize(vh[0]!);
              }}
            >
              <option value="classic">{t('custom.modeClassic')}</option>
              <option value="teams">{t('custom.modeTeams')}</option>
            </Select>
          </div>
          <div>
            <SectionLabel>{t('custom.players')}</SectionLabel>
            <Select
              value={maxPlayers}
              onChange={(e) => {
                const n = parseInt(e.target.value);
                setMaxPlayers(n);
                const vh = getAvailableHandSizes(mode, n);
                if (!vh.includes(handSize)) setHandSize(vh[0]!);
              }}
            >
              {getAvailablePlayers(mode).map((n) => (
                <option key={n} value={n}>
                  {t('custom.nPlayers', { count: n })}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <SectionLabel>{t('custom.handSize')}</SectionLabel>
            <Select
              value={handSize}
              onChange={(e) => setHandSize(parseInt(e.target.value))}
              disabled={getAvailableHandSizes(mode, maxPlayers).length <= 1}
            >
              {getAvailableHandSizes(mode, maxPlayers).map((s) => (
                <option key={s} value={s}>
                  {t('custom.nCards', { count: s })}
                </option>
              ))}
            </Select>
          </div>
          {mode === 'teams' && (
            <div>
              <SectionLabel>{t('custom.teamAssignment')}</SectionLabel>
              <Select
                value={teamSelection}
                onChange={(e) => setTeamSelection(e.target.value as 'random' | 'manual')}
              >
                <option value="random">{t('custom.randomTeams')}</option>
                <option value="manual">{t('custom.manualSelection')}</option>
              </Select>
            </div>
          )}
          <GoldButton
            size="lg"
            block
            loading={isLoading}
            onClick={async () => {
              setIsLoading(true);
              await createGame({
                maxPlayers,
                isPrivate: true,
                mode,
                teamSelection,
                handSize,
                ...(discordId ? { discordId } : {}),
                ...(userId ? { userId } : {}),
                ...(username ? { username } : {}),
                ...(avatarUrl ? { avatarUrl } : {}),
              });
              setIsLoading(false);
            }}
          >
            {t('custom.openTable')}
          </GoldButton>
        </div>
      )}

      {tab === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <SectionLabel>{t('custom.inviteCode')}</SectionLabel>
            <TextInput
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              style={{
                letterSpacing: 6,
                fontSize: 22,
                fontWeight: 900,
                fontFamily: fonts.display,
                textAlign: 'center',
                color: colors.gold[300],
              }}
            />
          </div>
          <GoldButton
            size="lg"
            block
            loading={isLoading}
            disabled={!joinCode.trim()}
            onClick={async () => {
              if (!joinCode.trim()) return;
              setIsLoading(true);
              await joinGame(joinCode.trim(), discordId, userId, username, avatarUrl);
              setIsLoading(false);
            }}
          >
            {t('custom.takeSeat')}
          </GoldButton>
        </div>
      )}

      {tab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={fetchRooms}
              style={{
                background: 'none',
                border: 'none',
                color: colors.gold[400],
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {t('common:actions.refresh')}
            </button>
          </div>
          {rooms.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 0',
                color: colors.ivory[300],
                fontSize: 13,
                opacity: 0.7,
                fontStyle: 'italic',
              }}
            >
              {t('custom.lounge')}
              <br />
              {t('custom.loungeHint')}
            </div>
          ) : (
            rooms.map((r) => {
              const meta = r.metadata as Record<string, unknown> | null;
              const pc = (meta?.playerCount as number) ?? r.clients;
              const mx = (meta?.maxPlayers as number) ?? r.maxClients;
              const phase = (meta?.phase as string) ?? 'waiting';
              const full = pc >= mx;
              return (
                <div
                  key={r.roomId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: radii.md,
                    background: gradients.panel,
                    border: '1px solid rgba(212,175,55,0.2)',
                    boxShadow: shadows.engrave,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: fonts.display,
                        fontWeight: 700,
                        fontSize: 14,
                        color: colors.gold[300],
                        letterSpacing: 1.5,
                      }}
                    >
                      {t('custom.tableLabel', { id: r.roomId.slice(0, 6) })}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: colors.ivory[300],
                        marginTop: 3,
                        opacity: 0.75,
                        letterSpacing: 0.3,
                      }}
                    >
                      {t('custom.seatedOf', {
                        count: pc,
                        max: mx,
                        mode:
                          meta?.mode === 'teams' ? t('custom.modeTeams') : t('custom.modeClassic'),
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <GoldButton
                      size="sm"
                      variant={full ? 'ghost' : 'gold'}
                      disabled={isLoading || full}
                      onClick={() => joinGame(r.roomId, discordId, userId, username, avatarUrl)}
                    >
                      {t('custom.join')}
                    </GoldButton>
                    <GoldButton
                      size="sm"
                      variant="burgundy"
                      disabled={phase !== 'playing'}
                      onClick={() => spectateGame(r.roomId)}
                    >
                      {t('custom.watch')}
                    </GoldButton>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
