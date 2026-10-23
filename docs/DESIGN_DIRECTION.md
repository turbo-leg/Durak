# Durak table direction

Historical first-slice direction. Superseded by the user-requested frontend replacement in [FRONTEND_REBUILD.md](FRONTEND_REBUILD.md); the active UI now uses a blue-felt card room and a new screen composition.

The existing game already has a recognizable identity. Carry it into the 3D table rather than replacing its artwork or navigation.

- Felt: `#0d4938`; deep green surroundings: `#04150e`.
- Brass rail and selection accents: `#b59b59` / `#d4af37`.
- Ivory card stock: `#fff9e9` / `#e7d9b7`; red suit ink: `#a5222e`.
- Dark wood edge: `#21160f`; black suit ink: `#152a32`.
- Typography: retain the existing Cinzel/Georgia card-room character and existing UI font stack. Card faces and seat labels use readable serif text.

The table is the main visual element: an angled oval, shallow wood/brass rim, quiet directional lighting, and a local hand facing the player. Opponents sit clockwise around the far rail. Keep the center clear for single and mass attacks, place the deck/Huzur to the left, and discard to the right. Existing large DOM card controls stay below for readable keyboard/touch selection, with the same selected state as the 3D hand.

```text
           opponent seats and public hand counts
        /---------------------------------------\
       /       history / incoming attacks        \
      | deck + Huzur                   discard    |
       \             local 3D hand               /
        \---------------------------------------/
                   shared action controls
                  accessible card controls
```

Motion explains changes: cards travel from the deck, selected cards rise, and played cards move to the table/discard. Honor reduced motion and stop rendering after the scene settles or the tab is hidden. Retain the equipped card-back artwork. The 2D table remains available through an explicit switch and automatic WebGL failure fallback.

The initial scene is a playable vertical slice. Further polish includes table materials, richer deal/reveal choreography, readable large-mass history, camera tuning on physical mobile devices, and performance measurements before release.
