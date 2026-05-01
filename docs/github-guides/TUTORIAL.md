# 🎓 Step-by-Step Tutorial: Your First GitHub Workflow

## **Complete Example: Fix a Real Bug**

I'll walk you through fixing a bug in the DurakRoom, step by step.

---

## **STEP 1: Get List of Issues (1 minute)**

### **In Terminal:**

```bash
cd /Users/khanboldbattulga/Documents/GitHub/Durak
gh issue list
```

### **What You'll See:**

```
#1  Implement Full Game Loop Orchestration              open  Apr 19
#2  Set up Colyseus Client connection context           open  Apr 19
#3  Implement basic Playmat UI (render hand, deck)      open  Apr 19
#5  Add card animations (dealing, attacking)            open  Apr 19
#7  Implement Game Over conditions                      open  Apr 19
```

### **What Happened:**

✅ GitHub CLI connected to GitHub.com  
✅ Fetched all open issues  
✅ Displayed them in terminal

### **Pick One Issue:**

Let's work on **#7 - Implement Game Over conditions**

---

## **STEP 2: View Issue Details (1 minute)**

### **In Terminal:**

```bash
gh issue view 7
```

### **What You'll See:**

```
Implement Game Over conditions
Author: turbo-leg

A player wins if the deck is empty and they have no cards left.
We check every player and add them to the winners list.

assignees: You

status: OPEN
created:  Apr 19, 2026
updated:  Apr 19, 2026
number:   7
--

Comments (0)

...
```

### **What This Tells You:**

- 📋 Issue title and description
- 👤 Who created it
- 📅 When it was created
- 📊 Current status
- 💬 Comments (if any)

---

## **STEP 3: Create a Feature Branch (1 minute)**

### **In Terminal:**

```bash
gh issue develop 7
```

### **What You'll See:**

```
Creating branch for issue #7
✓ Switched to a new branch 'hotfix/implement-game-over-conditions'
✓ Branch created based on main
✓ Ready to start coding!
```

### **What Happened:**

✅ GitHub CLI contacted GitHub.com  
✅ Created a new branch: `7-implement-game-over-conditions`  
✅ Git switched your local repo to this branch  
✅ You're now isolated from main branch

### **Verify You're on the Branch:**

```bash
git branch
```

Output:

```
* 7-implement-game-over-conditions    ← (you are here)
  main
```

The `*` means you're on this branch.

---

## **STEP 4: Open Files in VS Code (1 minute)**

### **In VS Code:**

1. Open file: `/packages/server/src/rooms/DurakRoom.ts`
2. Find the `checkGameOver()` function
3. You'll see:

```typescript
private checkGameOver() {
  if (this.state.phase !== "playing") return;

  let hasNewWinner = false;
  this.state.players.forEach((player, id) => {
    const alreadyWon = this.state.winners.includes(id);

    if (this.state.deck.length === 0 && player.hand.length === 0 && !alreadyWon) {
      this.state.winners.push(id);
      hasNewWinner = true;
      this.broadcast("playerWon", id);
    }
  });

  if (hasNewWinner) {
    const remainingPlayers = Array.from(this.state.players.keys()).filter(
      id => !this.state.winners.includes(id)
    );

    if (remainingPlayers.length <= 1) {
      this.state.phase = "finished";
      if (remainingPlayers.length === 1) {
        this.state.loser = remainingPlayers[0];
        this.broadcast("gameOver", { loser: this.state.loser });
      } else {
        this.broadcast("gameOver", { loser: null, draw: true });
      }
    }
  }
}
```

---

## **STEP 5: Make Your Changes (5 minutes)**

### **Scenario:**

The code is mostly done, but we need to ensure it handles edge cases. Let's add a comment explaining the logic.

### **Edit the Function:**

Add a clear comment at the start of the function:

```typescript
private checkGameOver() {
  // Check if game is still in progress
  if (this.state.phase !== "playing") return;

  // TODO: Check for winners: track players who empty their hand
  // A player wins when deck is empty AND they have 0 cards
  // The LAST player remaining is the "Durak" (fool)

  let hasNewWinner = false;
  // ... rest of code
}
```

### **What You Changed:**

✅ Added descriptive comments  
✅ Clarified the win condition  
✅ Code is now easier to understand

---

## **STEP 6: Review Your Changes (2 minutes)**

### **In Terminal - See What Changed:**

```bash
git diff
```

### **You'll See:**

```diff
diff --git a/packages/server/src/rooms/DurakRoom.ts b/packages/server/src/rooms/DurakRoom.ts
index 1234567..abcdefg 100644
--- a/packages/server/src/rooms/DurakRoom.ts
+++ b/packages/server/src/rooms/DurakRoom.ts
@@ -320,6 +320,11 @@ export class DurakRoom extends Room<GameState> {

   private checkGameOver() {
     if (this.state.phase !== "playing") return;
+
+    // Check for winners: track players who empty their hand
+    // A player wins when deck is empty AND they have 0 cards
+    // The LAST player remaining is the "Durak" (fool)

     let hasNewWinner = false;
```

### **What This Shows:**

- 📍 File that changed: `DurakRoom.ts`
- ➕ Lines added (green with `+`)
- ➖ Lines removed (red with `-`)
- 🔢 Line numbers

---

## **STEP 7: Stage Your Changes (1 minute)**

### **In Terminal:**

```bash
git add .
```

### **What This Does:**

✅ Prepares all changes for commit  
✅ Stages them in the "staging area"  
✅ Ready to be saved

### **Verify:**

```bash
git status
```

Output:

```
On branch 7-implement-game-over-conditions

Changes to be committed:
  modified:   packages/server/src/rooms/DurakRoom.ts
```

---

## **STEP 8: Commit Your Changes (1 minute)**

### **In Terminal:**

```bash
git commit -m "docs: add clarifying comments to checkGameOver logic"
```

### **What This Does:**

✅ Creates a snapshot in `.git/`  
✅ Saves with your message  
✅ Commit is now in history

### **Output:**

```
[7-implement-game-over-conditions abc1234] docs: add clarifying comments to checkGameOver logic
 1 file changed, 5 insertions(+)
```

### **Verify:**

```bash
git log --oneline -3
```

Output:

```
abc1234 docs: add clarifying comments to checkGameOver logic    ← Your commit!
def5678 Initial setup
ghi9012 Add shared types
```

---

## **STEP 9: Push to GitHub (1 minute)**

### **In Terminal:**

```bash
git push origin 7-implement-game-over-conditions
```

### **What This Does:**

✅ Sends your local commits to GitHub  
✅ Creates/updates the branch on GitHub  
✅ Your teammates can now see your work

### **Output:**

```
Enumerating objects: 3, done.
Counting objects: 100% (3/3), done.
Delta compression using 2 threads
Compressing objects: 100% (2/2), done.
Writing objects: 100% (2/2), 342 bytes | 342.00 KiB/s, done.
Total 3 (delta 1), reused 0 (delta 0), pack-reused 0 (using bitmap)
remote: Resolving deltas: 100% (1/1), completed with 1.27 MiB/s
To github.com:turbo-leg/Durak.git
 * [new branch]      7-implement-game-over-conditions -> 7-implement-game-over-conditions
```

### **See on GitHub:**

Visit: `https://github.com/turbo-leg/Durak/tree/7-implement-game-over-conditions`

You'll see your branch with your commits!

---

## **STEP 10: Create a Pull Request (1 minute)**

### **In Terminal:**

```bash
gh pr create --title "Implement Game Over conditions" --body "Fixes #7

This PR implements the game over logic:
- Players win when deck is empty and hand is empty
- Last remaining player is marked as the Durak
- Game phase changed to finished
- Loser is determined and broadcast to clients"
```

### **What This Does:**

✅ Creates a PR on GitHub  
✅ Links it to issue #7  
✅ Shows your changes for review

### **Output:**

```
Creating pull request for 7-implement-game-over-conditions into main in turbo-leg/Durak

remote: Create a pull request for '7-implement-game-over-conditions' on GitHub by visiting:
remote:      https://github.com/turbo-leg/Durak/pull/1
remote:

✓ Pull request created: #1
```

---

## **STEP 11: Open PR in Browser (1 minute)**

### **In Terminal:**

```bash
gh pr view --web
```

### **What Opens:**

Browser opens to: `https://github.com/turbo-leg/Durak/pull/1`

You see:

- ✅ Your title and description
- ✅ Your commits (1 commit)
- ✅ Your changes (diff view)
- ✅ Review status (waiting for review)
- ✅ Merge button (once approved)

### **What Others See:**

Your teammates can:

- 📖 Read the description
- 👀 Review the code
- 💬 Leave comments
- ✅ Approve or request changes

---

## **STEP 12: Wait for Review (⏱️ varies)**

Your teammates review the code. They might:

### **Scenario A: Approved ✅**

```
Person A: ✅ Approved
Person B: ✅ Approved

Status: Ready to merge!
```

### **Scenario B: Changes Requested 🔄**

```
Person A: 👁️ Reviewing...
Person B: 🔴 Requested changes
  "Can you add a test for this?"

Status: Update needed
```

### **To Make Updates:**

```bash
# Edit the file again in VS Code
vim packages/server/src/rooms/DurakRoom.ts

# Add the test...

# Commit and push
git add .
git commit -m "test: add game over condition tests"
git push origin 7-implement-game-over-conditions

# PR auto-updates with new commit!
```

---

## **STEP 13: Merge the PR (1 minute)**

Once approved, merge it!

### **Option 1: Using Terminal**

```bash
gh pr merge 1
```

### **Option 2: Using GitHub Browser**

1. Go to PR on GitHub
2. Click green [Merge pull request] button
3. Confirm

### **What This Does:**

✅ Merges your branch into main  
✅ Closes the PR  
✅ Auto-closes issue #7  
✅ Your code is now on main!

### **Output:**

```
✓ Pull request #1 merged successfully

remote: Squashed 1 commit
remote: To push use the command below to update your local repository
```

---

## **STEP 14: Update Your Local Main (1 minute)**

### **In Terminal:**

```bash
git checkout main
git pull origin main
```

### **What This Does:**

✅ Switches to main branch  
✅ Downloads the latest code  
✅ Your change is now in main!

### **Verify:**

```bash
git log --oneline -5
```

Output:

```
abc1234 Merge pull request #1 from turbo-leg/7-implement-game-over-conditions    ← Merged!
def5678 docs: add clarifying comments to checkGameOver logic
ghi9012 Initial setup
jkl3456 Add shared types
mno7890 Initial commit
```

---

## **STEP 15: Celebrate! 🎉**

```
✅ Issue created
✅ Branch created
✅ Code written
✅ Changes committed
✅ Code pushed
✅ PR created
✅ Code reviewed
✅ PR merged
✅ Live on main branch!

YOU DID IT! 🎮
```

---

## **Quick Recap**

| Step | Command                  | What It Does           |
| ---- | ------------------------ | ---------------------- |
| 1    | `gh issue list`          | See all issues         |
| 2    | `gh issue view 7`        | View issue details     |
| 3    | `gh issue develop 7`     | Create branch & switch |
| 4    | Edit in VS Code          | Write the code         |
| 5    | `git diff`               | Review changes         |
| 6    | `git add .`              | Stage changes          |
| 7    | `git commit -m "..."`    | Save snapshot          |
| 8    | `git push origin ...`    | Send to GitHub         |
| 9    | `gh pr create`           | Create pull request    |
| 10   | `gh pr view --web`       | Open in browser        |
| 11   | (Wait for review)        | Teammates review       |
| 12   | (Make updates if needed) | Fix feedback           |
| 13   | `gh pr merge`            | Merge to main          |
| 14   | `git pull origin main`   | Get merged code        |
| 15   | 🎉 Celebrate!            | You're done!           |

---

## **Common Questions**

### **Q: What if I made a mistake?**

```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Or undo last commit (discard changes)
git reset --hard HEAD~1
```

### **Q: What if my branch is out of date?**

```bash
git fetch origin
git rebase origin/main
git push origin --force-with-lease
```

### **Q: How do I see all my commits?**

```bash
git log --oneline --all
```

### **Q: How do I switch between branches?**

```bash
git checkout main      # Switch to main
git checkout 7-fix     # Switch to branch 7-fix
```

### **Q: Where's my code stored?**

```
GitHub.com     ← Remote (cloud)
   ↕
.git/ folder   ← Local (your computer)
   ↕
Your files     ← What you edit
```

---

## **You're Ready!**

You now understand the complete workflow. Time to work on a real issue! 🚀

Pick an issue from: `gh issue list`

Start with: `gh issue develop <ISSUE_NUMBER>`

Good luck! 🎮
