# Sound effects

The clip director's named sound effects (`"sfx": "laugh"`), mixed in by `scripts/lib/sfx.mjs`.
Every file is a CC0 1.0 (public domain) recording from [Freesound](https://freesound.org): free
to use in monetized videos, no credit required. `sources.json` lists each one's Freesound page
and author; thanks to them all the same.

Each is the Freesound HQ preview, cut to its first sound, trimmed to 0.4–3.6 s with a fade-out
and loudness-normalised (ffmpeg `silenceremove`, `atrim`, `afade`, `loudnorm=I=-16:TP=-1.5`).
Mix volumes live in `PRESETS` in `scripts/lib/sfx.mjs`; the laugh is kept low, an awkward few
people rather than a sitcom crowd.

| Name       | Freesound | Sound                  |
| ---------- | --------- | ---------------------- |
| `laugh`    | #346682   | Crowd awkward laughter |
| `giggle`   | #536517   | Aukward smile          |
| `cough`    | #561013   | Polite coughing        |
| `crickets` | #69439    | synth-cricket          |
| `trombone` | #175409   | wah wah sad trombone   |
| `boom`     | #177242   | Cinematic Impact       |
| `scratch`  | #43404    | record_scratch         |
| `bonk`     | #573047   | Bonk Sound effect      |
| `slap`     | #774754   | Card Slap1             |
| `swoosh`   | #264777   | Swoosh                 |
| `draw`     | #84322    | flipCard               |
| `shuffle`  | #256508   | Riffle Card Shuffle    |
| `drumroll` | #191718   | drumroll               |
| `gasp`     | #439258   | gasps small crowd      |
| `whoosh`   | #60013    | Whoosh                 |
| `ding`     | #538147   | Correct Bell           |
| `airhorn`  | #68999    | airhorn-short          |
| `sting`    | #122076   | Dramatic 1             |

To replace one, drop a new CC0 (or otherwise cleared) file in with the same name and update
`sources.json` and this table.
