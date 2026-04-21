# 📊 Visual Diagrams - How GitHub Integration Works

## **Diagram 1: The Three Systems**

```
YOUR COMPUTER                          GITHUB.com
─────────────────                      ──────────

┌─────────────┐                        ┌─────────────────┐
│  VS Code    │   ◄──────────────────► │  GitHub.com     │
│  (Editor)   │    git push/pull       │  (Cloud Server) │
└──────┬──────┘    GitHub CLI          └─────────────────┘
       │
       │ edits files
       │
       ▼
┌─────────────┐
│  .git/      │  ◄─────────────────────┐
│ (Git Repo)  │   stores everything    │
└─────────────┘                        │
       │                               │
       └───────────────────────────────┘
       tracks changes
```

---

## **Diagram 2: The Workflow**

```
START: You have an issue to fix
   │
   ▼
gh issue develop 5
   │ (creates branch locally)
   ▼
Branch: 5-fix-something
   │
   ▼
Open VS Code & Edit Files
   │
   ├─ file1.ts (changed)
   ├─ file2.ts (changed)
   └─ file3.ts (unchanged)
   │
   ▼
git add .  (stage changes)
   │
   ▼
git commit -m "fix: ..."  (create snapshot)
   │
   ▼
git push origin 5-fix-something  (send to GitHub)
   │
   ▼
GitHub receives your code
   │
   ▼
gh pr create  (create pull request)
   │
   ▼
PR visible on GitHub.com
   │
   ▼
Team reviews code
   │
   ▼
gh pr merge  (merge to main)
   │
   ▼
✅ Done! Code is now live
```

---

## **Diagram 3: Git States**

```
File States in Git:

1. UNTRACKED          2. STAGING AREA       3. COMMITTED
   (not tracked)         (staged)              (saved)

   file.ts             git add .          git commit
   (new file)    ────────────────►      ◄─────────────
                                         
   No git info         Ready to commit     In .git/
                       waiting to save     tracked
                       
                       (preview of        history
                       next commit)
                       
───────────────────────────────────────────────────────

   EXAMPLE FLOW:

   1. Create new file
      $ touch utils.ts
      ✅ File exists but git ignores it

   2. Stage it
      $ git add utils.ts
      ✅ Git prepares to track it

   3. Commit it
      $ git commit -m "Add utils"
      ✅ Git saves snapshot in .git/

   4. Now it's tracked forever!
      $ git log
      ✅ You can see this commit in history
```

---

## **Diagram 4: Local vs Remote**

```
YOUR COMPUTER (LOCAL)           GITHUB.com (REMOTE)
──────────────────              ─────────────────

.git folder contains:           GitHub database contains:

✅ All commits                   ✅ All commits
✅ All branches                  ✅ All branches
✅ All history                   ✅ All history

Branch: main                     Branch: main
└─ commit 1                      └─ commit 1
└─ commit 2                      └─ commit 2
└─ commit 3                      └─ commit 3

Branch: 5-fix-bug                Branch: 5-fix-bug
└─ commit 4  ◄──┐                └─ commit 4  ◄──┐
                │                                │
                │ (not synced                    │
                │  until you push)               │
                └────────────────────────────────┘

                    git push
                    ────────►
                    
       SYNC happens!
       Local matches Remote
```

---

## **Diagram 5: Authentication Flow**

```
STEP 1: Start
┌─────────────────────┐
│ gh auth login       │
│ in terminal         │
└─────────┬───────────┘

STEP 2: Choose Protocol
┌─────────────────────┐
│ ? GitHub.com or GH Enterprise?
│ → GitHub.com ✓
│
│ ? HTTPS or SSH?
│ → HTTPS ✓
└─────────┬───────────┘

STEP 3: Open Browser
┌─────────────────────┐
│ Queueing auth...
│ Press enter to open browser...
│ ► Open in browser
└─────────┬───────────┘

STEP 4: Browser Login
┌─────────────────────┐
│ GitHub Login Page   │
│                     │
│ Email: you@...      │
│ Password: ****      │
│ [Login]             │
└─────────┬───────────┘

STEP 5: GitHub Approves
┌─────────────────────┐
│ Authorize GitHub CLI
│ [Authorize]         │
│                     │
│ Device code: ABC123 │
└─────────┬───────────┘

STEP 6: Copy Code
┌─────────────────────┐
│ Copy device code    │
│ ABC123              │
└─────────┬───────────┘

STEP 7: Paste in Terminal
┌─────────────────────┐
│ Paste code: ABC123  │
│ [Enter]             │
└─────────┬───────────┘

STEP 8: Verified!
┌─────────────────────┐
│ ✅ Logged in!       │
│                     │
│ Token saved in:     │
│ ~/.config/gh/       │
│ config.yml          │
└─────────────────────┘

RESULT: All future commands work!
```

---

## **Diagram 6: git push/pull**

```
PUSH (Your → GitHub)
────────────────────

Your Computer                  GitHub.com
─────────────               ──────────────

Local commits:              Remote commits:

commit A ✓                  commit A ✓
commit B ✓                  commit B ✓
commit C ✓                  commit C ✓
commit D ✓    ─git push─►   commit D ✓
commit E ✓                  commit E ✓

(matches now!)


PULL (GitHub → Your)
────────────────────

Your Computer                  GitHub.com
─────────────               ──────────────

Local commits:              Remote commits:

commit A ✓                  commit A ✓
commit B ✓                  commit B ✓
commit C ✓                  commit C ✓
                            commit D ✓
                   ◄─git pull──commit E ✓

(your computer updated!)

Local commits after pull:

commit A ✓
commit B ✓
commit C ✓
commit D ✓    ◄── New!
commit E ✓    ◄── New!
```

---

## **Diagram 7: Branching**

```
main branch (production code)
│
├─ commit 1: "Initial setup"
├─ commit 2: "Add auth"
├─ commit 3: "Add deck system"
│
└─ commit 4: "Add game loop"
   │
   └─ Create new branch: "5-fix-attack"
      │
      ├─ commit 5: "Fix validation"
      ├─ commit 6: "Add tests"
      │
      └─ Merge back to main
         │
         └─ commit 7: "Merge PR #1"
            │
            └─ commit 8: "New feature"

Timeline:
─────────────────────────────────────►

    main: 1 → 2 → 3 → 4 → 7 → 8
                      ↑
                      └─ 5 → 6 ─┘
                      (separate branch)
```

---

## **Diagram 8: Pull Request**

```
Your Branch: 5-fix-attack        Main Branch
─────────────────────            ────────────

commit 1 ✓                        commit 1 ✓
commit 2 ✓                        commit 2 ✓
commit 3 ✓                        commit 3 ✓
commit 4 ✓ NEW                    
commit 5 ✓ NEW                    

                ┌─ PULL REQUEST ─┐
                │                 │
                │ Changes:        │
                │ +4 commits      │
                │ +50 lines       │
                │ -10 lines       │
                │                 │
                │ Review Status:  │
                │ ✅ Approved     │
                │ 👍 1 review     │
                │                 │
                │ [Merge] button  │
                └────────┬────────┘
                         │
                         ▼
        Both branches merge to main:
        
        commit 1 ✓
        commit 2 ✓
        commit 3 ✓
        commit 4 ✓ (from feature branch)
        commit 5 ✓ (from feature branch)
```

---

## **Diagram 9: Real Example - Fix Attack Bug**

```
ISSUE #3: Fix attack validation bug

└─ You: "gh issue develop 3"
   │
   └─ Creates branch: 3-fix-attack-validation
      │
      └─ You: Edit file in VS Code
         packages/server/src/rooms/DurakRoom.ts
         │
         │ Change: function validation logic
         │
         └─ You: "git add ."
            │
            └─ You: "git commit -m 'fix: correct validation'"
               │
               ├─ Snapshot created in .git/
               │
               └─ You: "git push"
                  │
                  └─ Code sent to GitHub
                     │
                     └─ You: "gh pr create"
                        │
                        └─ PR created on GitHub.com
                           │
                           ├─ Shows diff:
                           │  - Before: isValidMass(cards)
                           │  + After: isValidMassAttack(...)
                           │
                           └─ Team reviews
                              │
                              ├─ Person A: "✅ Approved"
                              ├─ Person B: "👍 Looks good"
                              │
                              └─ You: "gh pr merge"
                                 │
                                 └─ ✅ Merged to main!
                                    │
                                    └─ Issue #3 auto-closed
                                       │
                                       └─ Everyone pulls changes
                                          └─ Code is now live!
```

---

## **Diagram 10: Information Flow**

```
┌──────────────────────────────────────────────────┐
│  GitHub.com (Source of Truth)                   │
│  - All code                                      │
│  - All history                                   │
│  - All issues/PRs                                │
└─────────────┬──────────────────────┬─────────────┘
              │                      │
         git pull              GitHub CLI (gh)
         git fetch             API requests
              │                      │
              ▼                      ▼
    ┌────────────────┐       ┌──────────────────┐
    │  Your .git/    │       │ Your Terminal    │
    │                │       │                  │
    │  Local copy    │       │ $ gh issue list  │
    │  of repo       │       │ $ gh pr create   │
    └────────┬───────┘       │ $ git push       │
             │               │ $ git commit     │
        git status           └──────────────────┘
        git diff
             │
             ▼
    ┌────────────────────┐
    │  VS Code Editor    │
    │                    │
    │  Shows your files  │
    │  Shows changes     │
    │  Shows branches    │
    └────────────────────┘
```

---

## **Key Takeaway**

```
┌─────────────────────────────────────────────────────────────┐
│                    THE CYCLE                                │
│                                                             │
│  1. Create issue on GitHub                                 │
│  2. Create branch: gh issue develop                        │
│  3. Edit files in VS Code                                  │
│  4. Commit changes: git add & git commit                   │
│  5. Push to GitHub: git push                               │
│  6. Create PR: gh pr create                                │
│  7. Team reviews                                           │
│  8. Merge: gh pr merge                                     │
│  9. Code goes live! ✅                                      │
│                                                             │
│  Repeat! →                                                 │
└─────────────────────────────────────────────────────────────┘
```

That's how it all works! 🎉
