# PR Summary: Turn Timer Feature (#73)

## Overview
This PR implements a turn-based timer system for the Durak game with a visual sand clock display that shakes when time is running out. Players now have a configurable time limit (default 30 seconds) to complete their turn actions.

## Changes

### 1. **Backend - Server-Side Timer Management** (`packages/server/src/rooms/DurakRoom.ts`)
- Added `turnTimeoutId` field to track active timeout timers
- Implemented timer enforcement that automatically advances turns when time expires
- **Auto-Pickup Logic**: When a defender's timer runs out, they automatically pick up all cards instead of holding up the game
- Added `turnStartTime` tracking to synchronize timer state across all clients
- Timer resets and starts whenever `currentTurn` changes (either through `nextTurn()` or game start)
- Cleanup of timeout intervals when game ends to prevent memory leaks

**Key Methods Modified:**
- `startGame()`: Initializes `turnStartTime` when game begins
- `nextTurn()`: Sets `turnStartTime = Date.now()` when advancing to next player
- Timer enforcement: Calls `handlePickUp()` automatically if defender doesn't defend in time

### 2. **Shared State Schema** (`packages/shared/src/state/GameState.ts`)
- Added `turnStartTime: number = 0` - Epoch timestamp of when current turn started
- Added `turnTimeLimit: number = 30000` - Time limit in milliseconds (configurable per game)

### 3. **Frontend - UI Component** (`packages/client/src/components/GameBoard.tsx`)
- **Timer Display**: 
  - Sand clock emoji (⏳) positioned above the table
  - Real-time countdown showing seconds remaining
  - Updates every 100ms for smooth countdown
  - Only visible during the active player's turn

- **Visual Feedback**:
  - Timer color changes based on time remaining:
    - 🟢 Green (> 50% time): Safe zone
    - 🟡 Yellow (25-50% time): Warning zone
    - 🔴 Red (< 25% time): Danger zone
  - **Shake Animation**: Timer and text vibrate when less than 3 seconds remain, creating urgency

- **Text Rendering Improvements**:
  - Fixed text cutoff issues in opponent badges by:
    - Removing `truncate` class from player IDs
    - Adjusting badge positioning and padding
    - Reducing label font sizes slightly for better fit
    - Adding `whitespace-nowrap` to prevent text wrapping
  - Improved label sizes and spacing for "Attack", "Defend", "Incoming" badges
  - Better responsive design for mobile and desktop

### 4. **Game Context** (`packages/client/src/contexts/GameContext.tsx`)
- Added listener for `turnExpired` server event (optional enhancement for future notifications)

## Features

✅ **30-second turn timer** (default, configurable)
✅ **Server-side enforcement** - Time expiration is enforced on server, not just visual
✅ **Auto-pickup for defenders** - Prevents defenders from stalling the game
✅ **Real-time synchronization** - All clients see the same timer via Colyseus
✅ **Visual urgency** - Color gradient + shake animation when time runs out
✅ **Mobile-friendly** - Responsive design with adjusted font sizes
✅ **No cutoff text** - Improved UI readability across all badges and labels

## How It Works

1. **Turn Start**: When a new turn begins, server sets `turnStartTime = Date.now()`
2. **Client Display**: Client calculates remaining time: `turnTimeLimit - (now - turnStartTime)`
3. **Timer Update**: Frontend updates display every 100ms with smooth countdown
4. **Time Expiration**:
   - **For Attacker**: Turn automatically passes to next player
   - **For Defender**: Cards are automatically picked up, ending the round
5. **Visual Feedback**: Timer color and shake intensity increase as time runs out

## Technical Details

- **Synchronization**: Uses Colyseus Schema to sync `turnStartTime` and `turnTimeLimit` across all clients
- **Performance**: 100ms update interval balances visual smoothness with performance
- **Accessibility**: Clear visual indicators (color, animation) communicate time pressure
- **Responsive**: Font sizes and spacing adapt for mobile (320px) to desktop (1920px+)

## Testing Notes

- Test timer functionality in both classic and team modes
- Verify defender auto-pickup works correctly
- Check color transitions at 50%, 25% time thresholds
- Confirm shake animation triggers at <3 seconds
- Test on mobile and desktop viewports for text overflow

## Browser Support

- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 15+
- ✅ Mobile browsers

## Files Changed

| File | Changes |
|------|---------|
| `packages/server/src/rooms/DurakRoom.ts` | +45 lines: Timer logic, auto-pickup enforcement |
| `packages/client/src/components/GameBoard.tsx` | +70 lines: Timer UI, visual feedback, text fixes |
| `packages/shared/src/state/GameState.ts` | +2 lines: Timer state fields |
| `packages/client/src/contexts/GameContext.tsx` | +4 lines: Event listener setup |

## Future Enhancements

- [ ] Configurable timer duration per game mode
- [ ] Toast notifications when time expires
- [ ] Sound effect for timer expiration
- [ ] Statistics tracking (fastest defenders, timeout patterns)
- [ ] Pause timer during game pause states
