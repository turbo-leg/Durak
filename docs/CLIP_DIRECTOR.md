# Clip director

Stage scripted table scenes with the real characters and cards, narrate them in any language
with ElevenLabs, and render vertical reels with sound effects, captions and on-screen text. It
needs no game server.

```bash
npm run reel -- cheater --open      # voice new lines, make sounds, render, open the MP4
```

`reel` voices only new or changed lines, generates missing sound effects, starts its own dev
server and writes `output/clips/<scene>.mp4`. Starter scenes: `cheater` and `player-types`
(written as scripts, below), and `big-pickup`, `trump-save`, `cast-roll` (timed by hand).

## Writing a reel as a script

A script lists the spoken lines in order and pins everything else to a word of the line before
it, so nothing is timed by hand. Scenes live in `packages/client/src/director/scenes/`.

```json
{
  "title": "The friend who cheats",
  "trump": "Qs",
  "deck": 8,
  "felt": "#7a2f3a",
  "voice": { "id": "<narrator voice id>", "model": "eleven_v4" },
  "cast": [
    { "name": "Mugii", "seat": 180, "voice": { "id": "<Mugii's voice id>" } },
    { "name": "Jagaa", "seat": 120 },
    { "name": "Orgil", "seat": 240 }
  ],
  "script": [
    { "at": 0, "shot": "face:Mugii", "push": 0.08 },
    { "at": 0, "text": "Хуурдаг найз", "for": 2600 },
    { "say": "Энэ бол Мөгий. Мөгий хэзээ ч хуурдаггүй." },
    { "word": "хуурдаггүй", "who": "Mugii", "do": "peek-left" },
    { "word": "хуурдаггүй", "shot": "wide", "ease": 500 },
    { "say": "Жагаа анзаарлаа." },
    { "word": "анзаарлаа", "sfx": "boom" },
    { "word": "анзаарлаа", "shot": "face:Jagaa", "zoom": 1.35, "shake": 0.03 },
    { "say": "Би юу ч хараагүй!", "who": "Mugii", "pause": 600 }
  ]
}
```

| Item   | What it is                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------- |
| `say`  | A spoken line. With `who`, that character speaks it in their `voice` and their mouth moves.       |
| `do`   | An action, as in the beats table below (with `who`).                                              |
| `shot` | A camera shot, with the camera options below.                                                     |
| `sfx`  | A sound effect: a preset name or any description in English (`for` sets its length in ms).        |
| `text` | On-screen text for `for` ms: a hook title at the top, or `"style": "center"` for big impact text. |

**Timing.** Lines follow each other 250 ms apart, or `pause` ms to let a joke land. Any other item
takes `word` (a word of the last line: `"долоо"`, or `"долоо#2"` for the second; a prefix matches
a suffixed word), `after` (ms after the previous item) or `at` (ms); `offset` nudges it. An item
with no timing starts with the previous item. A `play` or `defend` pinned to a word lands on that
word. The reel ends a moment after its last line.

**Sound effects:** `boom`, `scratch`, `crickets`, `trombone`, `laugh`, `drumroll`, `gasp`, `ding`,
`airhorn`, `whoosh`, `sting`, `bonk`, or a description. The table's own sounds (a slap as each
card lands, a swoosh on a pickup, a shuffle on a discard) are added under every reel unless the
scene sets `"tableSounds": false`. Effects are generated once and cached in `output/sfx`.

**Voices.** The scene's `voice` narrates; a cast member's `voice` speaks their lines. Mongolian
needs `eleven_v4`, `eleven_v4_turbo` or `eleven_v3` (v3 detects the language; older models do not
speak it). The key comes from `ELEVENLABS_API_KEY` or `~/.elevenlabs/key.txt` and needs
text-to-speech and sound-effects permission. Captions show a few words at a time with the spoken
word in yellow, above the area the apps cover with their buttons.

Step by step: `npm run director:voice -- <scene>` voices the lines and prints when each one plays,
writing the timed scene to `output/scenes/` for the preview page; `npm run director:record --
<scene> --voice` renders against a running dev server.

## Preview and recording

```bash
npm run dev:client                         # Vite on :5173
# preview: http://localhost:5173/director.html?scene=big-pickup
npm run director:record -- big-pickup      # → output/clips/big-pickup.mp4 + .cues.json
```

The preview has a scene picker, play/pause and a scrubber; **Paste JSON** loads a scene from the
clipboard. Scripted scenes appear once voiced. Caption cues show in the preview only.

Recorder options: more scenes or `.json` paths in one run, `--out=<dir>`, `--w=1080 --h=1920`
(use `--w=1920 --h=1080` for landscape), `--from=<ms> --to=<ms>`, `--frames` to keep the PNGs,
`--voice` for sound, captions and text. Every frame is posed at exactly `i / fps`, so takes never
drop frames and come out identical. Needs ffmpeg on PATH (or `FFMPEG_PATH`); `DIRECTOR_URL`
points at another dev server and `DIRECTOR_SWIFTSHADER=1` renders without a GPU.

## Scene reference

A scene can also be timed by hand with `beats` and `camera` lists in milliseconds, as
`big-pickup.json` is.

**Cast** (2 to 6): a bot's name (Orgil, Jagaa, Mugii, Dok, Tsomo, Buyna) picks its own look;
otherwise give `preset` (`copper`, `sage`, `indigo`, `ochre`, `casual` or a `bot-*` id). `cards`
is the starting hand (default 6). Seats go evenly round the table with the first player facing
the camera; `seat` sets an angle in degrees (0 nearest the camera, 180 facing it). `felt` and
`background` set the table and room colours; `back` picks the card back art.

**Cards** use the game notation: printed rank then suit letter (`7h`, `10s`, `Qd`, `3c`, `2d`,
`As`), or `BJ`/`RJ` for the Jokers. `trump` is the Huzur; `deck` is how many cards remain.

**Actions** (`do`):

| `do`                                                                                          | Needs                                                           | What happens                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| `play`                                                                                        | `who`, `card`                                                   | Attacks: the card rides in the hand, then lands in a slot |
| `defend`                                                                                      | `who`, `card`, optional `on`                                    | Covers the first open attack, or the card named in `on`   |
| `pickup`                                                                                      | `who`                                                           | Takes every card on the table into the hand               |
| `discard`                                                                                     | —                                                               | The table goes face-down to the discard pile              |
| `draw`                                                                                        | `who`, optional `count`                                         | Draws from the deck, one card every 650 ms                |
| `look`                                                                                        | `who`, `target`: a cast name, `table`, `deck`, `camera`, `down` | Turns the head (and eyes) there until the next look       |
| `victory`                                                                                     | `who`                                                           | Both arms up (best with an empty hand)                    |
| `say`                                                                                         | `text`, optional `who`                                          | A spoken line (a caption cue when not voiced)             |
| `one` `two` `three` `four` `nose` `ear-left` `ear-right` `cry` `cheer` `shrug`                | `who`                                                           | The public emotes, 2 s each                               |
| `nod` `no` `laugh` `facepalm` `think` `shock` `sleep` `peek-left` `peek-right` `slam` `point` | `who`                                                           | Scripted acts for reels, 1.3 to 3.2 s                     |

Hand acts use the free left hand while the right holds cards. `peek-left`/`peek-right` lean
toward the character's own left or right. A play takes about 0.8 s to land, a pickup about
0.9 s; the table must make sense: `defend` needs an open attack and `pickup` a full table.

**Camera**: `wide`, `top`, `table` (the attack row, readable), `face:<name>`, `over:<name>`
(behind that player's shoulder), `hand:<name>` or `custom` with `eye` and `target` points. Each
shot can add `ease` (ms to glide from the last shot; otherwise a cut), `zoom` (1.35 punches in,
0.75 widens), `push` (creeps in over the hold), `shake`, `lift` (raise or lower the camera) and
`orbit` (degrees around the subject). A face shot of someone turned to look at another player
reads best with `orbit` 30–40° toward that player; a small character's face shot wants `lift`.

A scene that does not make sense is refused with every problem listed by beat or script item.
