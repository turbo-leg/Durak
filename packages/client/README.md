# Durak client

The active client uses React, Vite and Three.js with a Colyseus connection owned by `src/contexts/GameContext.tsx`. `src/App.tsx` handles browser/embedded authentication and renders the replacement `src/room/CardRoom.tsx`. Its home/lobby controls live in `RoomMenu.tsx`, with account/rules/confirmation dialogs in `RoomDialog.tsx`. The previous HomePage/GameBoard/ShopPage/ProfilePage composition is no longer imported by the app; source and its tests remain historical reference while account/shop features are migrated.

From the repository root:

```sh
npm run dev:server
# In a second terminal:
npm run dev:client
```

Open `http://localhost:5173`. The Vite proxy forwards API and WebSocket requests to port 2567. Production assets are served by the game server. See the [root README](../../README.md) for environment and Discord setup.

```sh
npm test -w @durak/client
npm run lint -w @durak/client
npm run typecheck -w @durak/client
npm run build:client
```

The opening screen and live play share a lazy-loaded interactive Three.js card room: textured blue felt, walnut rails, rounded cards, pointer picking, hover lift and bounded camera orbit. Card controls provide native keyboard buttons and default open on narrow screens. The view switch selects 2D, also used automatically after WebGL failure. `src/game/tableSnapshot.ts` copies filtered schema values into a presentation model; the renderer never owns game rules or connections. The fresh design is documented in [FRONTEND_REBUILD.md](../../docs/FRONTEND_REBUILD.md). Progress and release criteria are in [PROJECT_PLAN.md](../../docs/PROJECT_PLAN.md); baseline limitations are in [PROJECT_AUDIT.md](../../docs/PROJECT_AUDIT.md).

## Historical Vite template notes

The original template notes below are retained as tooling reference.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x';
import reactDom from 'eslint-plugin-react-dom';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
