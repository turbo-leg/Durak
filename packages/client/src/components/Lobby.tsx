import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../contexts/GameContext';
import type { RoomAvailable } from 'colyseus.js';
import { PlayerProfilePanel } from './PlayerProfilePanel';
import { LoginPanel } from './LoginPanel';
import { Panel, GoldButton, TextInput, Select, SectionLabel } from './ui';
import { colors, radii, fonts } from '../theme';

const getAvailablePlayers = (mode: string) => {
  return mode === 'teams' ? [4, 6] : [2, 3, 4, 5, 6];
};

const getAvailableHandSizes = (mode: string, players: number) => {
  if (mode === 'teams') {
    return players === 4 ? [7] : [5];
  } else {
    return players <= 4 ? [5, 7] : [5];
  }
};

interface LobbyProps {
  discordId?: string;
  userId?: string;
  username?: string;
  avatarUrl?: string;
  defaultPrivate?: boolean;
  defaultVsBot?: boolean;
}

export const Lobby: React.FC<LobbyProps> = ({
  discordId,
  userId,
  username = '',
  avatarUrl = '',
  defaultPrivate = false,
  defaultVsBot = false,
}) => {
  const { t } = useTranslation('game');
  const { createGame, joinGame, spectateGame, findPublicGames, error } = useGame();

  const [rooms, setRooms] = useState<RoomAvailable[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Form options
  const [maxPlayers, setMaxPlayers] = useState(defaultVsBot ? 2 : 6);
  const [isPrivate, setIsPrivate] = useState(defaultPrivate);
  const [mode, setMode] = useState('classic');
  const [teamSelection, setTeamSelection] = useState<'random' | 'manual'>('random');
  const [handSize, setHandSize] = useState(5);

  const fetchRooms = async () => {
    try {
      const publicRooms = await findPublicGames();
      setRooms(publicRooms);
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(() => {
      void fetchRooms();
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await createGame({ maxPlayers, isPrivate, mode, teamSelection, handSize });
    setIsLoading(false);
  };

  const handleJoinById = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setIsLoading(true);
    await joinGame(joinCode.trim(), discordId, userId);
    setIsLoading(false);
  };

  const handSizeLocked = getAvailableHandSizes(mode, maxPlayers).length <= 1;

  return (
    <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 relative z-20">
      {/* Create Room Panel */}
      <Panel>
        <SectionLabel>{t('lobby.createNewGame')}</SectionLabel>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <FieldLabel>{t('lobby.gameMode')}</FieldLabel>
            <Select
              value={mode}
              onChange={(e) => {
                const newMode = e.target.value;
                setMode(newMode);
                const validPlayers = getAvailablePlayers(newMode);
                let newPlayers = maxPlayers;
                if (!validPlayers.includes(newPlayers)) {
                  newPlayers = validPlayers[0];
                  setMaxPlayers(newPlayers);
                }
                const validHandSizes = getAvailableHandSizes(newMode, newPlayers);
                if (!validHandSizes.includes(handSize)) {
                  setHandSize(validHandSizes[0]);
                }
              }}
            >
              <option value="classic">{t('lobby.modeClassic')}</option>
              <option value="teams">{t('lobby.modeTeams')}</option>
            </Select>
          </div>

          <div>
            <FieldLabel>{t('lobby.playersAtTable')}</FieldLabel>
            <Select
              value={maxPlayers}
              onChange={(e) => {
                const num = parseInt(e.target.value);
                setMaxPlayers(num);
                const validHandSizes = getAvailableHandSizes(mode, num);
                if (!validHandSizes.includes(handSize)) {
                  setHandSize(validHandSizes[0]);
                }
              }}
            >
              {getAvailablePlayers(mode).map((num) => (
                <option key={num} value={num}>
                  {t('lobby.nPlayers', { count: num })}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <FieldLabel>{t('lobby.cardsInHand')}</FieldLabel>
            <Select
              value={handSize}
              onChange={(e) => setHandSize(parseInt(e.target.value))}
              disabled={handSizeLocked}
            >
              {getAvailableHandSizes(mode, maxPlayers).map((size) => (
                <option key={size} value={size}>
                  {t('lobby.nCards', { count: size })}
                </option>
              ))}
            </Select>
            {handSizeLocked && (
              <p style={{ fontSize: 12, color: colors.ivory[300], marginTop: 6 }}>
                {t('lobby.handLocked', { size: getAvailableHandSizes(mode, maxPlayers)[0] })}
              </p>
            )}
          </div>

          {mode === 'teams' && (
            <div>
              <FieldLabel>{t('lobby.teamSelection')}</FieldLabel>
              <Select
                value={teamSelection}
                onChange={(e) => setTeamSelection(e.target.value as 'random' | 'manual')}
              >
                <option value="random">{t('lobby.randomAssignment')}</option>
                <option value="manual">{t('lobby.manualSelection')}</option>
              </Select>
            </div>
          )}

          <label
            htmlFor="isPrivate"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              color: colors.ivory[100],
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <input
              type="checkbox"
              id="isPrivate"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: colors.gold[500], cursor: 'pointer' }}
            />
            {t('lobby.privateGame')}
          </label>

          <GoldButton type="submit" block disabled={isLoading}>
            {isLoading ? t('lobby.creating') : t('lobby.createAndJoin')}
          </GoldButton>
        </form>
      </Panel>

      {/* Right column: auth/profile + join + public rooms */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Login / profile panel — always shown in browser mode */}
        <LoginPanel />

        {/* Expanded profile stats when logged in */}
        {(discordId || userId) && (
          <PlayerProfilePanel
            discordId={discordId}
            userId={userId}
            username={username}
            avatarUrl={avatarUrl}
          />
        )}

        {/* Join by Code */}
        <Panel>
          <SectionLabel>{t('lobby.joinPrivate')}</SectionLabel>
          <form onSubmit={handleJoinById} style={{ display: 'flex', gap: 8 }}>
            <TextInput
              type="text"
              placeholder={t('lobby.roomCodePlaceholder')}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <GoldButton type="submit" variant="burgundy" disabled={isLoading || !joinCode.trim()}>
              {t('lobby.join')}
            </GoldButton>
          </form>
          {error && (
            <p style={{ marginTop: 8, fontSize: 13, color: '#e98a8a', fontWeight: 600 }}>{error}</p>
          )}
        </Panel>

        {/* Public Rooms */}
        <Panel style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: 14,
            }}
          >
            <SectionLabel>{t('lobby.publicLobbies')}</SectionLabel>
            <button
              onClick={fetchRooms}
              style={{
                background: 'none',
                border: 'none',
                color: colors.gold[400],
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.5,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              ↻ {t('lobby.refresh')}
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: 300,
              borderRadius: radii.sm,
              border: '1px solid rgba(212,175,55,0.15)',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            {rooms.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 32,
                  textAlign: 'center',
                  color: colors.ivory[300],
                  fontSize: 14,
                }}
              >
                <span>{t('lobby.noPublicGamesLine1')}</span>
                <span>{t('lobby.noPublicGamesLine2')}</span>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {rooms.map((r) => {
                  const meta = r.metadata as Record<string, unknown> | null;
                  const playerCount = (meta?.playerCount as number) ?? r.clients;
                  const maxPlayers = (meta?.maxPlayers as number) ?? r.maxClients;
                  const spectatorCount = (meta?.spectatorCount as number) ?? 0;
                  const phase = (meta?.phase as string) ?? 'waiting';
                  const isFull = playerCount >= maxPlayers;
                  const canWatch = phase === 'playing';
                  const modeLabel =
                    meta?.mode === 'teams' ? t('lobby.teams') : t('lobby.classic');
                  return (
                    <li
                      key={r.roomId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        borderBottom: '1px solid rgba(212,175,55,0.1)',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: fonts.display,
                            fontWeight: 700,
                            color: colors.ivory[100],
                            fontSize: 15,
                          }}
                        >
                          {t('lobby.roomName', { id: r.roomId.substring(0, 6) })}
                        </div>
                        <div style={{ fontSize: 12, color: colors.ivory[300], marginTop: 2 }}>
                          {t('lobby.roomMeta', {
                            count: playerCount,
                            max: maxPlayers,
                            mode: modeLabel,
                          })}
                          {spectatorCount > 0 && (
                            <span style={{ marginLeft: 8, color: colors.gold[400] }}>
                              👁 {spectatorCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <GoldButton
                          size="sm"
                          onClick={() => joinGame(r.roomId, discordId, userId)}
                          disabled={isLoading || isFull}
                        >
                          {t('lobby.join')}
                        </GoldButton>
                        <GoldButton
                          size="sm"
                          variant="ghost"
                          onClick={() => spectateGame(r.roomId)}
                          disabled={isLoading || !canWatch}
                          title={!canWatch ? t('lobby.watchDisabled') : undefined}
                        >
                          {t('lobby.watch')}
                        </GoldButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
};

// Small uppercase gold field label, lighter than SectionLabel for form rows.
const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label
    style={{
      display: 'block',
      fontFamily: fonts.body,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 0.5,
      color: colors.gold[300],
      marginBottom: 6,
    }}
  >
    {children}
  </label>
);
