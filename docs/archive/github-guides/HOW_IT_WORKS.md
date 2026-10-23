# 🎮 How GitHub Integration Works - Complete Explanation

## **The Big Picture: What Happens**

You have **THREE** separate systems working together:

```
┌─────────────────┐
│  GitHub.com     │  (Remote - in the cloud)
│  (Your Repo)    │
└────────┬────────┘
         │ (push/pull via Git)
         │
┌────────▼────────┐
│  Local Git Repo │  (On your computer)
│  (.git folder)  │
└────────┬────────┘
         │ (changes you make)
         │
┌────────▼────────┐
│  VS Code Editor │  (What you see)
│  (Your Files)   │
└─────────────────┘
```

---

## **System 1: GitHub.com (The Cloud)**

**What is it?**

- Your project lives on GitHub servers
- Contains all your code, issues, PRs, history
- Everyone can see it (if public)
- The "source of truth" for your code

**What's stored there:**

- ✅ All your code files
- ✅ All Git history (commits)
- ✅ All branches
- ✅ Issues and PRs
- ✅ Comments and discussions

**URL:** `https://github.com/turbo-leg/Durak`

---

## **System 2: Local Git Repository (.git folder)**

**What is it?**

- A copy of everything from GitHub on **your computer**
- Hidden folder: `/Users/khanboldbattulga/Documents/GitHub/Durak/.git`
- Tracks all your changes locally before you push

**What happens here:**

1. You make changes to files
2. You `git add` them (stage changes)
3. You `git commit` (save a snapshot)
4. You `git push` (send to GitHub)
5. You `git pull` (get updates from GitHub)

**Key folders:**

```
/Users/khanboldbattulga/Documents/GitHub/Durak/
├── .git/                    ← Git repo (tracks everything)
├── packages/
│   ├── server/
│   ├── client/
│   └── shared/
├── GITHUB_CHEATSHEET.md     ← You can see and edit these
├── QUICK_START.md
└── README.md
```

---

## **System 3: VS Code (Your Editor)**

**What is it?**

- The text editor where you write code
- Can see the `.git` folder info (via Git extensions)
- Shows you which files changed
- Integrates with GitHub CLI

**What you see:**

- Files you can edit
- Source Control panel (shows git status)
- GitHub extensions (Issue Notebooks, PR Monitor)

---

## **How It All Works Together**

### **Scenario: You Fix a Bug**

```
1. YOU MAKE CHANGES
   ┌─────────────────┐
   │  VS Code Editor │
   │                 │
   │  Open file.ts   │ ← You edit here
   │  Save changes   │
   └────────┬────────┘
            │
            ▼

2. STAGE CHANGES (git add .)
   ┌──────────────────┐
   │  Git Staging     │
   │  Area (.git)     │
   │                  │
   │  Your file.ts    │ ← Ready to commit
   │  is waiting      │
   └────────┬─────────┘
            │
            ▼

3. CREATE SNAPSHOT (git commit)
   ┌──────────────────┐
   │  Local Git Repo  │
   │  (.git folder)   │
   │                  │
   │  Commit stored   │ ← Saved locally
   │  with message    │
   └────────┬─────────┘
            │
            ▼

4. SEND TO GITHUB (git push)
   ┌──────────────────┐
   │  GitHub.com      │
   │  (Cloud Server)  │
   │                  │
   │  Commit uploaded │ ← Now everyone can see
   │  Branch updated  │
   └──────────────────┘
```

---

## **The GitHub CLI (`gh` Command)**

**What is it?**

- A command-line tool that talks to GitHub.com
- Lets you manage issues, PRs, branches WITHOUT opening a browser
- Already installed on your computer

**How it works:**

```
Terminal Command
    ↓
"gh issue list"
    ↓
GitHub CLI (gh)
    ↓
Sends request to GitHub.com via HTTPS
    ↓
GitHub.com API responds with issues
    ↓
CLI shows you the list in terminal
```

**Example:**

```bash
gh issue list
# → Connects to GitHub
# → Asks: "Give me all open issues in turbo-leg/Durak"
# → GitHub sends back the list
# → You see it in your terminal
```

---

## **Authentication: The Key**

**Why you need to authenticate:**

- GitHub needs to know it's really you
- Without auth, you can't push code or access private repos
- Auth happens once, then you're verified forever (on that computer)

**How it works:**

```
1. You run: gh auth login

2. Terminal shows menu:
   - Choose GitHub.com
   - Choose HTTPS

3. Browser opens GitHub login page
   - You sign in with your password
   - GitHub generates a "device code"

4. You copy the device code

5. Paste it back in terminal

6. GitHub verifies: "Yes, this is the real person"

7. Terminal receives a "token" (like a temporary password)
   - This token is saved on your computer
   - Used for all future requests to GitHub

8. You're authenticated! ✅
   - Now you can push code
   - Now you can create PRs
   - Now you can manage issues
```

**Where the token is stored:**

```
~/.config/gh/config.yml  (macOS/Linux)
or
C:\Users\...\AppData\Local\GitHub CLI  (Windows)
```

---

## **The Three-Way Sync: GitHub ↔ Local Git ↔ VS Code**

### **Your Workflow:**

```
STEP 1: GitHub → Your Computer
─────────────────────────────
gh issue develop 5
    ↓
Creates a new branch: "5-fix-something"
    ↓
Clones/pulls from GitHub
    ↓
Git creates the branch locally in .git/
    ↓
VS Code switches to this branch
    ↓
You can now see the branch in VS Code

STEP 2: You Edit Files in VS Code
─────────────────────────────────
Open file in VS Code
Edit code
Save file (Cmd + S)
    ↓
Changes exist ONLY in VS Code
Git doesn't know about them yet
    ↓
git diff shows: "Hey, this file changed!"

STEP 3: Commit (Local Git)
─────────────────────────
git add .
    ↓
"Stage" the changes
    ↓
git commit -m "fix: bug"
    ↓
Creates a snapshot in .git/
    ↓
Your changes are now tracked locally
    ↓
git log shows your new commit

STEP 4: Push (Local Git → GitHub)
─────────────────────────────────
git push origin your-branch
    ↓
Sends your local commits to GitHub
    ↓
GitHub receives them
    ↓
GitHub updates the branch: "5-fix-something"
    ↓
Your teammates can now see your changes
    ↓
You can create a PR from GitHub

STEP 5: Create Pull Request
─────────────────────────────
gh pr create --title "Fix bug" --body "Fixes #5"
    ↓
GitHub CLI sends request to GitHub.com
    ↓
GitHub creates a PR
    ↓
Compares your branch with main
    ↓
Shows the diff (what changed)
    ↓
Shows the PR on GitHub.com
```

---

## **Real Example: Fix Attack Bug**

Let me walk you through an actual example:

### **Step 1: See Issues**

```bash
$ gh issue list

#1  Implement Full Game Loop          open
#3  Fix Attack Validation             open
#5  Add Card Animations               open
```

What happened:

- ✅ Your terminal connected to GitHub.com
- ✅ Asked for all open issues
- ✅ GitHub sent back the list
- ✅ You can now see them

### **Step 2: Start Working on Issue #3**

```bash
$ gh issue develop 3
```

What happened:

- ✅ GitHub CLI connected to GitHub
- ✅ Found issue #3 info
- ✅ Created a new branch called "3-fix-attack-validation"
- ✅ Git created this branch in `.git/`
- ✅ Switched your workspace to this branch
- ✅ VS Code shows: "You're now on branch 3-fix-attack-validation"

### **Step 3: Edit the File**

```
In VS Code:
- Open: packages/server/src/rooms/DurakRoom.ts
- Find the handleAttack function
- Fix the validation logic
- Save the file (Cmd + S)
```

What happened:

- ✅ You changed the file on disk
- ✅ Git sees the change (but hasn't committed yet)
- ✅ VS Code shows a dot on the file (unsaved indicator)

### **Step 4: Check What Changed**

```bash
$ git diff
```

Output:

```diff
--- a/packages/server/src/rooms/DurakRoom.ts
+++ b/packages/server/src/rooms/DurakRoom.ts
@@ -150,7 +150,7 @@

     // Validation
     const isMass = cardsToPlay.length > 1;
-    if (isMass && !DurakEngine.isValidMass(cards)) {
+    if (isMass && !DurakEngine.isValidMassAttack(cardsToPlay, allPlayers, deckSize)) {
         client.send("error", "Invalid attack");
```

What happened:

- ✅ Git compared your file with the last commit
- ✅ Showed you exactly what changed
- ✅ Lines with `-` are removed, lines with `+` are added

### **Step 5: Commit**

```bash
$ git add .
$ git commit -m "fix: correct attack validation function call"
```

What happened:

- ✅ `git add .` staged all changes
- ✅ `.git/` folder prepared the commit
- ✅ `git commit` created a snapshot
- ✅ Snapshot stored in `.git/` with message
- ✅ You can now undo to this point if needed

### **Step 6: Push to GitHub**

```bash
$ git push origin 3-fix-attack-validation
```

What happened:

- ✅ Git connected to GitHub.com
- ✅ Sent your local commits
- ✅ GitHub received them
- ✅ GitHub updated the branch "3-fix-attack-validation"
- ✅ Your teammates can now pull your changes
- ✅ You can see the branch on github.com in browser

### **Step 7: Create a Pull Request**

```bash
$ gh pr create --title "Fix attack validation" --body "Fixes #3"
```

What happened:

- ✅ GitHub CLI connected to GitHub.com
- ✅ Created a new PR
- ✅ Linked it to issue #3
- ✅ Compared your branch with main
- ✅ Showed the diff
- ✅ PR is now visible on GitHub.com
- ✅ Others can review your code

### **Step 8: Merge the PR**

```bash
$ gh pr merge 1
```

What happened:

- ✅ GitHub merged your branch into main
- ✅ Your code is now part of the project
- ✅ Issue #3 auto-closed
- ✅ All developers will see your changes when they pull

---

## **The Key Concepts**

### **Branch**

- A separate copy of the code to work on
- Doesn't affect main branch
- When done, merge back to main

### **Commit**

- A snapshot of your changes
- Has a message explaining what changed
- Lives in Git history forever
- Can undo to any commit

### **Push**

- Sends your local commits to GitHub
- Makes your work visible to others
- Required before creating a PR

### **Pull**

- Gets latest changes from GitHub
- Updates your local files
- Needed before pushing (to avoid conflicts)

### **Pull Request (PR)**

- A request to merge your branch into main
- Allows code review
- Shows exactly what changed
- Team can discuss before merging

---

## **What Happens Behind the Scenes**

When you run `gh issue list`:

```
1. Your command: "gh issue list"

2. GitHub CLI checks: "Am I authenticated?"
   └─ Looks in ~/.config/gh/config.yml
   └─ Finds your token

3. Connects to GitHub API:
   └─ HTTPS request to: api.github.com/repos/turbo-leg/Durak/issues

4. GitHub server:
   └─ Checks your token
   └─ Verifies you have access
   └─ Queries the database
   └─ Returns JSON data

5. GitHub CLI receives JSON:
   └─ Parses the data
   └─ Formats it nicely
   └─ Displays in your terminal

6. You see:
   #1  Implement Game Loop        open
   #3  Fix Attack Validation      open
```

---

## **VS Code Extensions: The Visual Layer**

**GitHub Issue Notebooks:**

- Instead of terminal, you get a visual notebook
- Shows issues in a table
- Click an issue → see details
- More user-friendly than CLI

**GitHub Pull Request Monitor:**

- Shows PRs in a sidebar
- Updates in real-time
- Shows status: ✅ approved, ❌ changes requested, 🟡 needs review

**These are optional!** Both the CLI and extensions do the same thing, just different interfaces.

---

## **The Complete Picture**

```
┌──────────────────────────────────────────────────────────────┐
│                    GitHub.com (Cloud)                        │
│  - Stores all code                                           │
│  - Stores all issues & PRs                                   │
│  - Stores entire history                                     │
│  - Everyone can access (if public)                           │
└────────────────────────┬─────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    git push         git pull      GitHub API
    git pull     git fetch      (via gh CLI)
         │               │               │
         ▼               ▼               ▼
┌──────────────────────────────────────────────────────────────┐
│              Your Computer (.git folder)                     │
│  - Local copy of code                                        │
│  - Local copy of history                                     │
│  - Branches stored here                                      │
│  - Commits stored here                                       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                    git status
                    git diff
                    git add
                    git commit
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────────┐      ┌──────────────────────────┐
│  VS Code Editor     │      │   Terminal/CLI Commands  │
│                     │      │                          │
│  - Edit files       │      │  - gh issue list         │
│  - See changes      │      │  - gh pr create          │
│  - Git integration  │      │  - git push/pull         │
│  - Extensions       │      │  - git commit            │
└─────────────────────┘      └──────────────────────────┘
```

---

## **Quick Answer: How It Works**

**TL;DR:**

1. **GitHub.com** stores your code online
2. **Your computer (.git)** has a local copy
3. **VS Code** lets you edit the files
4. **GitHub CLI (`gh`)** lets you manage issues/PRs
5. **Git commands** (`git push/pull`) sync everything

**Flow:**

- Edit → Commit → Push → Create PR → Merge
- All changes are tracked, never lost
- Can see who changed what, when

That's it! 🎉
