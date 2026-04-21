# 🚀 **QUICK START: See GitHub Issues in VS Code**

## **Step 1: Authenticate (ONE TIME ONLY)**

Open Terminal and run:

```bash
gh auth login
```

**Follow the prompts:**
1. Choose `GitHub.com`
2. Choose `HTTPS`
3. Choose `Y` to authenticate with a web login
4. Browser opens → Sign in to GitHub → Approve
5. Copy the device code and paste it back in terminal

**Verify it worked:**
```bash
gh auth status
```

You should see: ✅ `Logged in to github.com as <your-username>`

---

## **Step 2: View Issues (Do This Now)**

Run this to see all issues:

```bash
gh issue list --repo turbo-leg/Durak
```

**Example output:**
```
#1  Implement Full Game Loop                 open   Apr 19
#2  Set up Client Connection Context         open   Apr 19  
#3  Fix Attack Validation Logic              open   Apr 19
#5  Add Card Animations                      open   Apr 19
```

---

## **Step 3: Start Working on an Issue**

Pick an issue number (let's say #1) and run:

```bash
gh issue develop 1
```

**What this does:**
- ✅ Creates a new branch named `1-implement-full-game-loop`
- ✅ Switches to that branch automatically
- ✅ Links it to the GitHub issue

You're now ready to code! 🎉

---

## **Step 4: See Changes Before Pushing**

```bash
# See what you changed
git diff

# See which files changed
git status
```

---

## **Step 5: Commit and Push**

```bash
# Stage your changes
git add .

# Commit with a message
git commit -m "feat: implement game loop logic"

# Push to GitHub
git push origin your-branch-name
```

---

## **Step 6: Create a Pull Request**

```bash
gh pr create --title "Implement Game Loop" --body "Fixes #1"
```

This will:
- ✅ Create a PR
- ✅ Auto-link to issue #1
- ✅ Show a link to view it on GitHub

---

## **View Your PR on GitHub**

```bash
gh pr view --web
```

Opens the PR in your browser so you can:
- See code changes
- Request a review
- Monitor status

---

## **IN VS CODE: See Issues Visually**

### **Option A: Issue Notebooks**
1. Press `Cmd + Shift + P`
2. Type: `GitHub Issue Notebooks`
3. Create a notebook
4. See all issues in a nice table

### **Option B: Pull Request Monitor**
- Look in left sidebar for GitHub icon
- Shows all PRs with status

---

## **See Your Changes on GitHub**

After you push, visit:
```
https://github.com/turbo-leg/Durak/tree/1-implement-full-game-loop
```

You'll see:
- Your new branch
- Your commits
- Your changes
- Option to create a PR

---

## **Everything You Need to Know**

| Do This | Command |
|---------|---------|
| See issues | `gh issue list` |
| Work on issue #1 | `gh issue develop 1` |
| See your changes | `git diff` |
| Commit changes | `git add . && git commit -m "..."` |
| Push to GitHub | `git push` |
| Create a PR | `gh pr create` |
| View PR online | `gh pr view --web` |
| Merge PR | `gh pr merge` |

---

## **That's It!**

You now have:
- ✅ Full GitHub integration in VS Code
- ✅ Can see all issues and PRs
- ✅ Can work on issues locally
- ✅ Can push changes and create PRs
- ✅ Can track everything on GitHub

**Next: Run `gh issue list` and pick an issue to work on!**
