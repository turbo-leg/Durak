import path from 'node:path';
import mongoose from 'mongoose';
import pino from 'pino';
import { GameLog } from '../models/GameLog';
import { PlayerProfile } from '../models/PlayerProfile';
import { calculateEloDeltas, type EloPlayer } from '../utils/EloEngine';
import { evaluateBadges, BADGES } from '../utils/Badges';
import { enqueueResult, getPendingResultCount } from './resultQueue';
import { ResultOutbox } from './resultOutbox';

export interface MatchResultSnapshot {
  id: string;
  log: {
    roomId: string;
    mode: string;
    players: string[];
    discordIds: string[];
    userIds: string[];
    winners: string[];
    durak: string | null;
    huzurSetting: string;
    actionLog: string[];
  };
  players: Array<{
    id: string;
    discordId: string;
    userId: string;
    username: string;
    avatarUrl: string;
  }>;
  winnerSessions: string[];
  mode: string;
  isPrivate: boolean;
  loser: string;
  completed: boolean;
  eloDeltas?: Record<string, number>;
  eloBefore?: Record<string, number>;
}

type ResultNotification = (playerId: string | null, type: string, data: unknown) => void;
const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
let store: ResultOutbox<MatchResultSnapshot> | undefined;
function resultStore() {
  return (store ??= new ResultOutbox<MatchResultSnapshot>(
    process.env.RESULT_OUTBOX_DIR ??
      (process.env.NODE_ENV === 'production'
        ? '/data/results'
        : path.resolve(process.cwd(), '../../output/result-outbox')),
  ));
}

export async function persistMatchResult(
  snapshot: MatchResultSnapshot,
  notify?: ResultNotification,
): Promise<void> {
  const { log, players, winnerSessions, mode, isPrivate, loser, completed } = snapshot;
  const resultKey = snapshot.id;
  const resultId = new mongoose.Types.ObjectId(resultKey);
  let eloDeltas = snapshot.eloDeltas ? new Map(Object.entries(snapshot.eloDeltas)) : undefined;
  if ((await GameLog.findById(resultId))?.resultApplied) {
    await PlayerProfile.updateMany(
      { appliedResultIds: resultKey },
      { $pull: { appliedResultIds: resultKey } },
    );
    return;
  }
  await GameLog.updateOne({ _id: resultId }, { $setOnInsert: log }, { upsert: true });
  logger.info({ roomId: log.roomId }, 'GameLog saved to MongoDB');

  // Shutdown snapshots are useful replay evidence, never completed-match rewards.
  if (!completed) {
    await GameLog.updateOne({ _id: resultId }, { $set: { resultApplied: true } });
    return;
  }

  // Upsert PlayerProfile for every authenticated participant (Discord or email)
  const authedPlayers = players.filter((p) => p?.discordId || p?.userId);
  const eloField = mode === 'teams' || mode === 'horse' ? 'eloTeams' : 'eloClassic';
  // Guests may join public tables, but a mixed/guest match cannot affect ratings.
  const isRanked = !isPrivate && authedPlayers.length === players.length;

  // Fetch current profiles so we can compute Elo deltas
  const currentProfiles = await Promise.all(
    authedPlayers.map((p) => {
      const filter = p.discordId ? { discordId: p.discordId } : { userId: p.userId };
      return PlayerProfile.findOne(filter);
    }),
  );

  const eloInputs: EloPlayer[] = authedPlayers.map((p, i) => {
    const prof = currentProfiles[i];
    const isWinner = winnerSessions.includes(p.id);
    return {
      id: p.id,
      currentElo: prof?.[eloField] ?? 1000,
      gamesPlayed: prof?.stats.gamesPlayed ?? 0,
      // Everyone who did not win lost; there are no middle places.
      placement: isWinner ? 'winner' : 'durak',
    };
  });

  // ELO deltas are only applied for ranked (non-private) games
  eloDeltas ??= isRanked ? calculateEloDeltas(eloInputs) : new Map<string, number>();
  const deltas = eloDeltas;
  snapshot.eloDeltas = Object.fromEntries(deltas);
  snapshot.eloBefore ??= Object.fromEntries(
    authedPlayers.map((p, i) => [p.id, currentProfiles[i]?.[eloField] ?? 1000]),
  );
  // Save the computed ELO so a retry reuses it. Best effort: a full or failing volume must
  // not stop the database write itself.
  await resultStore()
    .put(snapshot.id, snapshot)
    .catch((error: unknown) =>
      logger.warn({ err: error, resultId: snapshot.id }, 'Could not update saved result'),
    );

  const profileOps = authedPlayers.map((p) => {
    const isWinner = winnerSessions.includes(p.id);
    const isDurak = loser === p.id;
    const delta = deltas.get(p.id) ?? 0;
    const filter = p.discordId ? { discordId: p.discordId } : { userId: p.userId };
    const setFields = p.discordId
      ? { discordId: p.discordId, username: p.username, avatarUrl: p.avatarUrl }
      : { userId: p.userId, username: p.username, avatarUrl: p.avatarUrl };
    const alreadyApplied = { $in: [resultKey, { $ifNull: ['$appliedResultIds', []] }] };
    const once = (field: string, value: unknown) => ({
      $cond: [alreadyApplied, `$${field}`, value],
    });
    // Aggregation pipeline update so Elo is computed atomically in the DB:
    // max(100, storedElo + delta) prevents JS read-modify-write races when
    // a player finishes two concurrent games in different rooms.
    return PlayerProfile.findOneAndUpdate(
      filter,
      [
        {
          $set: {
            ...Object.fromEntries(
              Object.entries(setFields).map(([key, value]) => [key, { $literal: value }]),
            ),
            // Only mutate ELO field for ranked games
            ...(isRanked && {
              [eloField]: once(eloField, {
                $max: [100, { $add: [{ $ifNull: [`$${eloField}`, 1000] }, delta] }],
              }),
            }),
            'stats.gamesPlayed': once('stats.gamesPlayed', {
              $add: [{ $ifNull: ['$stats.gamesPlayed', 0] }, 1],
            }),
            'stats.wins': once('stats.wins', {
              $add: [{ $ifNull: ['$stats.wins', 0] }, isWinner ? 1 : 0],
            }),
            'stats.losses': once('stats.losses', {
              $add: [{ $ifNull: ['$stats.losses', 0] }, isWinner ? 0 : 1],
            }),
            'stats.durakCount': once('stats.durakCount', {
              $add: [{ $ifNull: ['$stats.durakCount', 0] }, isDurak ? 1 : 0],
            }),
            'stats.winStreak': once(
              'stats.winStreak',
              isWinner ? { $add: [{ $ifNull: ['$stats.winStreak', 0] }, 1] } : 0,
            ),
            'stats.durakFreeStreak': once(
              'stats.durakFreeStreak',
              isDurak ? 0 : { $add: [{ $ifNull: ['$stats.durakFreeStreak', 0] }, 1] },
            ),
            coins: once('coins', { $add: [{ $ifNull: ['$coins', 0] }, isWinner ? 10 : 3] }),
            appliedResultIds: {
              $cond: [
                alreadyApplied,
                '$appliedResultIds',
                { $concatArrays: [{ $ifNull: ['$appliedResultIds', []] }, [resultKey]] },
              ],
            },
          },
        },
      ],
      { upsert: true, returnDocument: 'after', updatePipeline: true },
    );
  });
  const updatedProfiles = await Promise.all(profileOps);

  // Award any newly earned badges
  const badgeResults: { playerName: string; newBadges: string[] }[] = [];
  const badgeOps = authedPlayers.map((p, i) => {
    const updatedProfile = updatedProfiles[i];
    if (!updatedProfile) return null;
    const isWinner = winnerSessions.includes(p.id);
    const newBadges = evaluateBadges(updatedProfile, isWinner);
    if (newBadges.length === 0) return null;
    badgeResults.push({ playerName: p.username, newBadges });
    return PlayerProfile.findByIdAndUpdate(updatedProfile._id, {
      $addToSet: { badges: { $each: newBadges } },
    });
  });
  await Promise.all(badgeOps.filter(Boolean));

  // Pin profile receipts until every participant is done. A permanent completion
  // marker makes both a delayed retry and receipt cleanup safe across later games.
  await GameLog.updateOne({ _id: resultId }, { $set: { resultApplied: true } });
  await PlayerProfile.updateMany(
    { appliedResultIds: resultKey },
    { $pull: { appliedResultIds: resultKey } },
  );

  // Notify only after the complete result is committed; retries cannot announce
  // rewards which failed to persist or announce an applied match a second time.
  for (const [i, p] of authedPlayers.entries()) {
    const updated = updatedProfiles[i];
    if (!updated) continue;
    const client = notify
      ? { send: (type: string, data: unknown) => notify(p.id, type, data) }
      : undefined;
    if (!client) continue;
    if (isRanked) {
      const delta = deltas.get(p.id) ?? 0;
      const newElo = updated[eloField];
      client.send('eloResult', {
        delta,
        oldElo: snapshot.eloBefore?.[p.id] ?? newElo - delta,
        newElo,
        isWinner: winnerSessions.includes(p.id),
        isDurak: loser === p.id,
      });
    }
    client.send('statsUpdated', {
      eloClassic: updated.eloClassic ?? 1000,
      eloTeams: updated.eloTeams ?? 1000,
      stats: updated.stats,
      coins: updated.coins ?? 0,
      badges: [
        ...new Set([
          ...(updated.badges ?? []),
          ...badgeResults.filter((b) => b.playerName === p.username).flatMap((b) => b.newBadges),
        ]),
      ],
    });
  }

  for (const { playerName, newBadges } of badgeResults) {
    notifyBadgeUnlocks(notify, playerName, newBadges);
  }
}

function submit(snapshot: MatchResultSnapshot, notify?: ResultNotification) {
  // The snapshot is already on disk (queueMatchResult or restore). Writing it again here
  // would let a full or failing volume block the database write forever.
  enqueueResult(snapshot.id, async () => {
    await persistMatchResult(snapshot, notify);
    await resultStore().remove(snapshot.id);
  });
}

export async function queueMatchResult(
  snapshot: MatchResultSnapshot,
  notify?: ResultNotification,
): Promise<void> {
  try {
    await resultStore().put(snapshot.id, snapshot);
  } finally {
    // Keep a live-process retry even if the durable volume is temporarily unavailable.
    // Past the cap (a long database outage), the result stays on disk only and
    // replayStoredResults picks it up later, so the in-memory queue cannot fill.
    if (getPendingResultCount() < QUEUE_SOFT_CAP) submit(snapshot, notify);
  }
}

const QUEUE_SOFT_CAP = 500;

/** Re-queue results saved on disk but not in memory. Duplicate ids are ignored. */
export async function replayStoredResults(): Promise<void> {
  try {
    for (const { id, payload } of await resultStore().readAll()) {
      if (getPendingResultCount() >= QUEUE_SOFT_CAP) return;
      if (payload.id === id && Array.isArray(payload.winnerSessions)) submit(payload);
    }
  } catch (error) {
    logger.error({ err: error }, 'Could not replay saved results');
  }
}

/** Called before listening, after configuration loads; failures keep startup closed. */
export async function restoreMatchResults(): Promise<void> {
  for (const { id, payload } of await resultStore().readAll()) {
    if (
      payload.id !== id ||
      !Array.isArray(payload.players) ||
      payload.players.length > 6 ||
      !payload.log ||
      typeof payload.log.roomId !== 'string' ||
      !Array.isArray(payload.winnerSessions)
    ) {
      throw new Error('Invalid saved match result');
    }
    submit(payload);
  }
}

function notifyBadgeUnlocks(
  notify: ResultNotification | undefined,
  playerName: string,
  badgeIds: string[],
): void {
  const defs = BADGES.filter((b) => badgeIds.includes(b.id));
  if (!defs.length) return;
  const lines = defs.map((b) => b.emoji + ' **' + b.name + '** \u2014 ' + b.description).join('\n');
  notify?.(null, 'badgeUnlocked', {
    playerName,
    badges: defs.map((b) => b.id),
    message: playerName + ' unlocked:\n' + lines,
  });
}
