# Durak client

React and Vite, with a Three.js card room. Commands, setup and the dev panel are in the
[developer guide](../../CONTRIBUTING.md).

- `src/App.tsx` handles browser and Discord sign-in, then renders `room/CardRoom.tsx`.
- `contexts/GameContext.tsx` owns the Colyseus connection and turns patches into renders.
- `room/` is the interface: home and lobby (`RoomMenu.tsx`), dialogs, hand controls and
  the dev panel (`DevPanel.tsx`, dev builds only).
- `game/` turns filtered server state into a presentation model (`tableSnapshot.ts`) and
  table events (`tableEvents.ts`). The renderer never owns rules or connections.
- `components/three/` draws the table (`TableRenderer.ts`) and seats the characters.
- `character/` is the generated character: contract, mesh, pose solver and clips
  ([spec](../../docs/CHARACTER_SPEC.md)). `character.html` is its preview page.

The 2D view is used automatically when WebGL fails, and the card controls work from the
keyboard.
