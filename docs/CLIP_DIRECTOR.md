# Clip director

A development page for staging scripted table scenes with the real characters and cards, and
rendering them to vertical video for promos and short-form posts. It needs no game server.

```bash
npm run dev:client                         # Vite on :5173
# preview: http://localhost:5173/director.html?scene=big-pickup
npm run director:record -- big-pickup      # → output/clips/big-pickup.mp4 + .cues.json
```

The preview has a scene picker, play/pause and a scrubber; **Paste JSON** loads a scene from the
clipboard. Caption cues (`say` beats) show in the preview only, never in the video: add text and
voiceover in the editor, timed from the `.cues.json` beside each clip.

Recorder options: more scenes or `.json` paths in one run, `--out=<dir>`, `--w=1080 --h=1920`
(use `--w=1920 --h=1080` for landscape), `--from=<ms> --to=<ms>`, `--frames` to keep the PNGs.
Every frame is posed at exactly `i / fps`, so takes never drop frames and come out identical.
Needs ffmpeg on PATH (or `FFMPEG_PATH`); `DIRECTOR_URL` points at another dev server and
`DIRECTOR_SWIFTSHADER=1` renders without a GPU.

## Narration and captions

Give the scene a voice and write its narration as `say` beats; then voice it and record with
`--voice`:

```bash
npm run director:voice -- big-pickup           # ElevenLabs → output/voice (cached per line)
npm run director:record -- big-pickup --voice  # narration mixed in, captions burned in
```

```json
"voice": { "id": "<ElevenLabs voice id>", "model": "eleven_v4" },
"beats": [{ "at": 3900, "do": "say", "text": "Долоо. Долоо. Бас долоо!" }]
```

`director:voice` prints each line's start, end and length so beats can be placed on the words; a
line is only voiced (and paid for) once per voice, model and text. Mongolian needs `eleven_v4`,
`eleven_v4_turbo` or `eleven_v3` (v3 detects the language; the older models do not speak it). The
key comes from `ELEVENLABS_API_KEY` or `~/.elevenlabs/key.txt` and needs only text-to-speech
permission. Captions show a few words at a time with the spoken word in yellow, set above the
area the apps cover with their own buttons.

## Writing a scene

Scenes are JSON in `packages/client/src/director/scenes/`. Times are milliseconds.

```json
{
  "title": "Jagaa picks up everything",
  "duration": 9000,
  "trump": "9h",
  "deck": 10,
  "cast": [
    { "name": "Jagaa", "cards": 4 },
    { "name": "Orgil", "cards": 6 }
  ],
  "camera": [
    { "at": 0, "shot": "wide", "push": 0.08 },
    { "at": 2700, "shot": "face:Jagaa", "ease": 500, "zoom": 1.1 }
  ],
  "beats": [
    { "at": 400, "who": "Orgil", "do": "play", "card": "7s" },
    { "at": 3000, "who": "Jagaa", "do": "shrug" },
    { "at": 4300, "who": "Jagaa", "do": "pickup" }
  ]
}
```

**Cast** (2 to 6): a bot's name (Orgil, Jagaa, Mugii, Dok, Tsomo, Buyna) picks its own look;
otherwise give `preset` (`copper`, `sage`, `indigo`, `ochre`, `casual` or a `bot-*` id). `cards`
is the starting hand (default 6). Seats go evenly round the table with the first player facing
the camera; `seat` sets an angle in degrees (0 nearest the camera, 180 facing it).

**Cards** use the game notation: printed rank then suit letter (`7h`, `10s`, `Qd`, `3c`, `2d`,
`As`), or `BJ`/`RJ` for the Jokers. `trump` is the Huzur; `deck` is how many cards remain.

**Beats** (`do`):

| `do`                                                                           | Needs                                                           | What happens                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------- |
| `play`                                                                         | `who`, `card`                                                   | Attacks: the card rides in the hand, then lands in a slot |
| `defend`                                                                       | `who`, `card`, optional `on`                                    | Covers the first open attack, or the card named in `on`   |
| `pickup`                                                                       | `who`                                                           | Takes every card on the table into the hand               |
| `discard`                                                                      | —                                                               | The table goes face-down to the discard pile              |
| `draw`                                                                         | `who`, optional `count`                                         | Draws from the deck, one card every 650 ms                |
| `look`                                                                         | `who`, `target`: a cast name, `table`, `deck`, `camera`, `down` | Turns the head (and eyes) there until the next look       |
| `victory`                                                                      | `who`                                                           | Both arms up (best with an empty hand)                    |
| `say`                                                                          | `text`, optional `who`                                          | A caption cue for the editor                              |
| `one` `two` `three` `four` `nose` `ear-left` `ear-right` `cry` `cheer` `shrug` | `who`                                                           | The public emotes, 2 s each                               |

A play takes about 0.8 s to land, a pickup about 0.9 s; leave room before the next beat on the
same player. The table must make sense: `defend` needs an open attack and `pickup` a full table.

**Camera**: `wide`, `top`, `table` (the attack row, readable), `face:<name>`, `over:<name>`
(behind that player's shoulder), `hand:<name>` or `custom` with `eye` and `target` points. Each
shot can add `ease` (ms to glide from the last shot; otherwise a cut), `zoom` (1.5 punches in,
0.75 widens), `push` (creeps in over the hold), `shake`, `lift` (raise or lower the camera) and
`orbit` (degrees around the subject).

A scene that does not make sense is refused with every problem listed by beat, in the preview and
by the recorder.
