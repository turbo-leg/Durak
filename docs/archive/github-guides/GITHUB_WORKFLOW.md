# 🚀 GitHub Integration Guide for Durak Project

This guide shows you how to work with GitHub issues, pull requests, and code changes directly in VS Code.

---

## **📦 What I Just Set Up For You**

I've installed 3 powerful extensions:

1. **GitHub Issue Notebooks** - View and manage issues in interactive notebooks
2. **GitHub Actions** - Monitor CI/CD workflows and runs
3. **GitHub Pull Request Monitor** - Track PR status, conflicts, reviews

---

## **🔐 Step 1: Authenticate with GitHub CLI**

First, authenticate your GitHub account:

```bash
gh auth login
```

Follow the prompts:

- Choose: **GitHub.com**
- Choose: **HTTPS** (for cloned repos)
- Choose: **Y** to authenticate with your browser token
- This will open a browser → authenticate → copy token → paste in terminal

**Test it worked:**

```bash
gh auth status
```

You should see: `Logged in to github.com as <your-username>`

---

## **📋 Step 2: View Issues in VS Code**

### **Method 1: GitHub Issue Notebooks (Visual)**

1. Open VS Code Command Palette: `Cmd + Shift + P`
2. Type: `GitHub Issue Notebooks: Create Issue Notebook`
3. Select your repository: `turbo-leg/Durak`
4. A notebook opens showing all issues with filtering

**In the notebook, you can:**

- Filter by status (open, closed, assigned to you)
- See issue descriptions and comments
- Create new issues
- Assign yourself to issues

### **Method 2: GitHub CLI (Terminal)**

```bash
# View all open issues
gh issue list --repo turbo-leg/Durak

# View issues assigned to you
gh issue list --repo turbo-leg/Durak --assignee @me

# View a specific issue (e.g., issue #5)
gh issue view 5 --repo turbo-leg/Durak

# Create a new issue
gh issue create --repo turbo-leg/Durak --title "Your Issue Title" --body "Description"

# Work on an issue (creates a branch)
gh issue develop 5 --repo turbo-leg/Durak
```

---

## **🔀 Step 3: Create Feature Branches & Pull Requests**

### **Workflow: Issue → Branch → Code → PR**

#### **1. Create a branch for an issue:**

```bash
# This creates a new branch like `5-issue-title` and switches to it
gh issue develop 5 --repo turbo-leg/Durak
```

#### **2. Make your code changes:**

```bash
# Edit files...
git add .
git commit -m "Fix: implement feature X"
```

#### **3. Push your branch:**

```bash
git push origin your-branch-name
```

#### **4. Create a Pull Request:**

```bash
gh pr create --repo turbo-leg/Durak --title "Fix: implement feature X" --body "Fixes #5"
```

Or automatically link to the issue:

```bash
gh pr create --repo turbo-leg/Durak --title "Implement X" --body "Closes #5" --draft
```

---

## **📊 Step 4: Monitor Pull Requests**

### **In VS Code - Pull Request Monitor:**

1. Open the Side Explorer
2. Look for the **GitHub Pull Request Monitor** view
3. Shows: Status, conflicts, reviews, branch up-to-date status

### **Using GitHub CLI:**

```bash
# View all open PRs
gh pr list --repo turbo-leg/Durak

# View a specific PR
gh pr view 1 --repo turbo-leg/Durak

# View PRs waiting for your review
gh pr list --repo turbo-leg/Durak --search "reviewed-by:@me"

# Check status of your PR
gh pr status --repo turbo-leg/Durak

# Merge a PR (after approved)
gh pr merge 1 --repo turbo-leg/Durak
```

---

## **🔄 Step 5: Sync Changes from GitHub to Local**

### **Pull latest changes:**

```bash
git fetch origin
git pull origin main
```

### **See what changed:**

```bash
# See commits since last sync
git log --oneline -5

# See file changes
git diff origin/main..HEAD

# See which files changed
git diff --name-only origin/main..HEAD
```

---

## **📝 Step 6: Commit & Push Workflow**

### **Daily workflow:**

```bash
# 1. Check status
git status

# 2. See what you changed
git diff

# 3. Stage changes
git add .

# 4. Commit with clear message
git commit -m "feat: add new feature"
# or
git commit -m "fix: resolve issue"
# or
git commit -m "docs: update README"

# 5. Push to GitHub
git push origin your-branch-name

# 6. See it on GitHub
gh pr view --web  # Opens PR in browser
```

---

## **✨ Common Git Commands**

```bash
# See all branches
git branch -a

# Switch to another branch
git checkout main
git checkout feature-branch

# Create a new branch
git checkout -b feature/my-new-feature

# Delete a branch locally
git branch -d feature/old-feature

# Delete a branch on GitHub
git push origin --delete feature/old-feature

# See commit history
git log --oneline

# Undo last commit (if not pushed)
git reset --soft HEAD~1

# See all changes in PR
git diff main...your-branch-name

# Rebase to get latest main
git fetch origin
git rebase origin/main
```

---

## **🎯 Real Example Workflow**

Let's say you want to fix the DurakRoom issue:

```bash
# 1. View issues
gh issue list --repo turbo-leg/Durak

# 2. Pick an issue (let's say issue #3)
gh issue view 3 --repo turbo-leg/Durak

# 3. Create a branch for it
gh issue develop 3 --repo turbo-leg/Durak
# Creates branch like: `3-fix-attack-logic`

# 4. Make changes
nano packages/server/src/rooms/DurakRoom.ts
# ... edit file ...

# 5. Check your changes
git status
git diff

# 6. Commit
git add .
git commit -m "fix: resolve invalid attack validation in DurakRoom"

# 7. Push
git push origin 3-fix-attack-logic

# 8. Create PR
gh pr create --repo turbo-leg/Durak \
  --title "Fix: Resolve invalid attack validation" \
  --body "Fixes #3 by improving card validation logic" \
  --draft

# 9. Open in browser to review
gh pr view --web

# 10. Mark as ready for review
gh pr ready 1  # where 1 is the PR number

# 11. Wait for reviews, then merge
gh pr merge 1 --repo turbo-leg/Durak
```

---

## **🔍 Advanced: VS Code GitHub Integration**

### **See Git Blame:**

Install **Git Blame** extension (already available)

- Hover over any line → see who changed it and when

### **See PR Changes:**

```bash
# In terminal
gh pr diff 1 --repo turbo-leg/Durak

# Or in browser
gh pr view 1 --web --repo turbo-leg/Durak
```

### **Review Code:**

```bash
# Start a review
gh pr review 1 --comment "Great work!" --repo turbo-leg/Durak

# Request changes
gh pr review 1 --request-changes --comment "Please fix X" --repo turbo-leg/Durak

# Approve
gh pr review 1 --approve --repo turbo-leg/Durak
```

---

## **📱 Checking Issues & PRs in VS Code UI**

### **Method 1: Source Control Panel**

- Click the **Source Control** icon (left sidebar)
- Shows current branch, changes, commits
- Sync button to pull/push

### **Method 2: GitHub Issue Notebooks**

- Command Palette → `GitHub Issue Notebooks`
- Visual interface for issues
- Click issue → view details → assign yourself

### **Method 3: GitHub Pull Request Monitor**

- Shows all PRs in a dedicated panel
- Red = conflicts, Yellow = needs review, Green = ready to merge

---

## **🚨 Troubleshooting**

### **"Authentication failed"**

```bash
gh auth logout
gh auth login  # Re-authenticate
```

### **"Cannot push to origin"**

```bash
# Check remote
git remote -v

# Set correct remote
git remote set-url origin https://github.com/turbo-leg/Durak.git
```

### **"Merge conflicts"**

```bash
# Fetch latest
git fetch origin

# See conflicts
git status

# Edit files to resolve conflicts, then:
git add .
git commit -m "Resolve merge conflicts"
git push origin your-branch-name
```

### **"Out of date with main"**

```bash
git fetch origin
git rebase origin/main
git push origin --force-with-lease your-branch-name  # Force push safely
```

---

## **📚 Useful Resources**

- GitHub CLI Docs: https://cli.github.com/manual
- GitHub Flow: https://guides.github.com/introduction/flow/
- Writing Good Commit Messages: https://www.conventionalcommits.org/

---

## **🎯 Next Steps**

1. ✅ Run `gh auth login` to authenticate
2. ✅ Run `gh issue list --repo turbo-leg/Durak` to see issues
3. ✅ Pick an issue and run `gh issue develop ISSUE_NUMBER`
4. ✅ Make your changes, commit, and push
5. ✅ Create a PR with `gh pr create`

Happy coding! 🚀
