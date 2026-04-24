# 🚀 Setup & Run - Complete Guide

## **Quick Status: What You Have ✅**

Your project has **all the required npm packages** to run correctly and display in Discord! Here's what's already installed:

### **Discord Integration** ✅
- ✅ `@discord/embedded-app-sdk` - Discord app embed support
- ✅ Discord token exchange endpoint in backend
- ✅ OAuth2 authentication flow ready
- ✅ Discord username display in UI

### **Game Engine** ✅
- ✅ Colyseus for real-time multiplayer
- ✅ Full game logic (DurakEngine)
- ✅ Card validation and mass attacks
- ✅ State synchronization

### **Frontend** ✅
- ✅ React 19 with TypeScript
- ✅ Vite for fast development
- ✅ Tailwind CSS for styling
- ✅ Framer Motion for animations
- ✅ Colyseus.js client

### **Backend** ✅
- ✅ Express + Node.js
- ✅ Colyseus server
- ✅ CORS enabled
- ✅ Colyseus monitor (debugging UI)

---

## **What You Need to Do Before Running**

### **Step 1: Create `.env` File** 🔧

Create `.env` in the root folder with Discord credentials:

```bash
# In: /Users/khanboldbattulga/Documents/GitHub/Durak/.env

DISCORD_CLIENT_ID=your_discord_client_id_here
DISCORD_CLIENT_SECRET=your_discord_client_secret_here
PORT=2567
```

### **Step 2: Get Discord Credentials** 🎮

1. Go to: https://discord.com/developers/applications
2. Create a new application (or use existing)
3. Go to **OAuth2 → General**
4. Copy **Client ID** and **Client Secret**
5. Paste into `.env` file above

### **Step 3: Create `.env.local` for Client** (Optional)

Create `.env.local` in `/packages/client/`:

```bash
# In: /Users/khanboldbattulga/Documents/GitHub/Durak/packages/client/.env.local

VITE_DISCORD_CLIENT_ID=your_discord_client_id_here
```

(If not set, it defaults to test ID: 123456789012345678)

---

## **Installation & Setup**

### **Step 1: Install All Dependencies**

```bash
cd /Users/khanboldbattulga/Documents/GitHub/Durak
npm install
```

This installs dependencies for:
- Root workspaces
- @durak/shared
- @durak/server
- @durak/client

### **Step 2: Build Client (Required Before Running)**

```bash
npm run build:client
```

This creates the `/packages/client/dist` folder that the server serves.

### **Step 3: (Optional) Build Everything**

```bash
npm run build
```

This builds all packages.

---

## **Running the Program**

### **Option A: Run Both Server & Client (Development)**

```bash
npm run dev
```

This starts:
- ✅ Backend server on `http://localhost:2567`
- ✅ Frontend dev server on `http://localhost:5173`

You can then navigate to `http://localhost:5173` in your browser.

### **Option B: Run Just Server**

```bash
npm run dev:server
```

Starts backend on port 2567.

Then in another terminal:

```bash
npm run dev:client
```

Starts frontend dev server on port 5173.

### **Option C: Production Build & Run**

```bash
# Build both client and server
npm run build

# Start the production server
npm run start:server
```

The server will serve the built client automatically.

---

## **Testing the Setup**

### **1. Check Backend is Running**

```bash
curl http://localhost:2567/colyseus
```

You should see Colyseus monitor UI.

### **2. Check Discord Integration**

- Go to: `http://localhost:5173`
- You should see "Durak Online" header
- If running in Discord (embedded), Discord auth will trigger

### **3. Create a Game Room**

- Click "Create Game"
- Create a room with 2-6 players
- You should be able to join and play

### **4. Check Colyseus Monitor**

- Go to: `http://localhost:2567/colyseus`
- You'll see active rooms, player states, and debug info

---

## **Environment Variables Explained**

| Variable | What It Does | Where to Get |
|----------|------------|-------------|
| `DISCORD_CLIENT_ID` | Identifies your app to Discord | Discord Developer Portal |
| `DISCORD_CLIENT_SECRET` | Secret for Discord OAuth | Discord Developer Portal |
| `PORT` | Server port (default: 2567) | Choose any open port |
| `VITE_DISCORD_CLIENT_ID` | Client-side Discord ID | Same as DISCORD_CLIENT_ID |

---

## **Common Issues & Fixes**

### **Issue: "Missing Discord credentials in server environment"**

**Fix:** Create `.env` file with `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`

```bash
echo "DISCORD_CLIENT_ID=your_id" >> .env
echo "DISCORD_CLIENT_SECRET=your_secret" >> .env
```

### **Issue: "Cannot find module '@durak/shared'"**

**Fix:** Make sure all npm packages are installed

```bash
npm install
```

### **Issue: "Cannot GET /colyseus"**

**Fix:** Server is not running. Start it with:

```bash
npm run dev:server
```

### **Issue: "Port 2567 already in use"**

**Fix:** Either stop the process using that port, or change PORT in `.env`

```bash
PORT=3000 npm run dev:server
```

### **Issue: Vite dev server shows "Cannot GET /"**

**Fix:** Make sure you built the client first

```bash
npm run build:client
```

### **Issue: Discord login not working**

**Fix:** Check if:
- Client ID is correct in `.env.local`
- App is actually running in Discord (embedded)
- Browser console for errors (F12 → Console)

---

## **Full Step-by-Step Guide**

### **First Time Setup (5 minutes)**

```bash
# 1. Navigate to project
cd /Users/khanboldbattulga/Documents/GitHub/Durak

# 2. Create .env with Discord credentials
cat > .env << EOF
DISCORD_CLIENT_ID=YOUR_CLIENT_ID_HERE
DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
PORT=2567
EOF

# 3. Install all dependencies
npm install

# 4. Build client
npm run build:client

# 5. Start everything
npm run dev
```

That's it! 🎉

### **What Happens Next**

- ✅ Terminal shows server running on port 2567
- ✅ Another terminal shows client dev server on 5173
- ✅ Browser opens http://localhost:5173
- ✅ You can create a game and play!

---

## **File Locations**

### **Environment Files**
- `.env` - Root level (server environment)
- `.env.local` - In `/packages/client/` (client environment)

### **Build Outputs**
- `/packages/client/dist/` - Built React app (created by build)
- `/packages/server/dist/` - Built server (created by build)

### **Source Code**
- `/packages/shared/src/` - Game logic and types
- `/packages/server/src/` - Backend room orchestration
- `/packages/client/src/` - React UI components

---

## **NPM Scripts Reference**

| Command | What It Does |
|---------|------------|
| `npm run dev` | Start both server & client in dev mode |
| `npm run dev:server` | Start just backend |
| `npm run dev:client` | Start just frontend |
| `npm run build` | Build all packages |
| `npm run build:client` | Build just client (for production) |
| `npm run start:server` | Start production server |
| `npm run test` | Run all tests |
| `npm run lint` | Check code style |

---

## **Discord Developer Setup (Detailed)**

### **1. Create Discord Application**

1. Go to: https://discord.com/developers/applications
2. Click "New Application"
3. Give it a name: "Durak Online"
4. Accept terms
5. Click "Create"

### **2. Get OAuth2 Credentials**

1. In your app, go to **OAuth2 → General**
2. Copy **Client ID** (save it)
3. Click "Reset Secret"
4. Copy **Client Secret** (save it)
5. Add to `.env`:

```bash
DISCORD_CLIENT_ID=paste_client_id_here
DISCORD_CLIENT_SECRET=paste_client_secret_here
```

### **3. Set Redirect URI (For Web App)**

1. In OAuth2 → General
2. Add **Redirect URI**: `http://localhost:2567/api/token`
3. Click "Save Changes"

### **4. Test Locally**

```bash
npm run dev
# Go to http://localhost:5173
```

### **5. Deploy to Discord (Later)**

Once you're ready to submit as a Discord Activity:
1. Go to **Embedded App Sub-command**
2. Set install URL to your production domain
3. Submit for verification

---

## **What Each Package Does**

### **@durak/shared**
- Game rules (DurakEngine.ts)
- Card/Player/GameState schemas
- AI logic (GrandmasterBot, MCTS)
- Used by both server and client

### **@durak/server**
- Express HTTP server
- Colyseus WebSocket server
- Game room orchestration
- Discord token exchange endpoint
- Serves built client

### **@durak/client**
- React app (GameBoard, Lobby, Card components)
- Colyseus client connection
- Discord SDK integration
- Vite development server

---

## **Next Steps**

1. ✅ Create `.env` with Discord credentials
2. ✅ Run `npm install`
3. ✅ Run `npm run build:client`
4. ✅ Run `npm run dev`
5. ✅ Open http://localhost:5173
6. ✅ Test game creation and gameplay
7. ✅ Read docs/github-guides/TUTORIAL.md for first pull request
8. ✅ Deploy when ready!

---

## **Troubleshooting Checklist**

- [ ] Created `.env` file in root?
- [ ] Added DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET?
- [ ] Ran `npm install`?
- [ ] Ran `npm run build:client`?
- [ ] Running `npm run dev`?
- [ ] Can access `http://localhost:5173`?
- [ ] Can create a game room?
- [ ] Can play the game?

If all checked ✅, you're good to go!

---

## **Getting Help**

If something doesn't work:

1. Check the error message carefully
2. Look at "Common Issues" section above
3. Check browser console (F12 → Console)
4. Check terminal output for error logs
5. Read `docs/github-guides/HOW_IT_WORKS.md` for deeper understanding

---

**You're all set! Ready to develop Durak Online! 🎮**
