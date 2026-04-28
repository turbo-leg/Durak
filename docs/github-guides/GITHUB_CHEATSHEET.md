# 🎮 Durak GitHub Integration - Quick Reference Card

## **Authentication (DO THIS FIRST)**
```bash
gh auth login
# → Choose: GitHub.com
# → Choose: HTTPS
# → Authenticate in browser
```

---

## **VIEW ISSUES**

| Command | What It Does |
|---------|------------|
| `gh issue list` | Show all open issues |
| `gh issue list --assignee @me` | Issues assigned to you |
| `gh issue view 5` | View issue #5 details |
| `gh issue list --state closed` | Show closed issues |
| `gh issue list --label "bug"` | Show issues with "bug" label |

---
gi
## **WORK ON ISSUES**

| Command | What It Does |
|---------|------------|
| `gh issue develop 5` | Create branch for issue #5 |
| `gh issue comment 5 -b "I'm working on this"` | Comment on issue |
| `gh issue close 5` | Close issue #5 |
| `gh issue reopen 5` | Reopen issue #5 |

---

## **PULL REQUESTS**

| Command | What It Does |
|---------|------------|
| `gh pr list` | Show all open PRs |
| `gh pr view 1` | View PR #1 details |
| `gh pr create --title "My PR" --body "Description"` | Create a PR |
| `gh pr merge 1` | Merge PR #1 |
| `gh pr review 1 --approve` | Approve PR #1 |
| `gh pr diff 1` | See changes in PR #1 |

---

## **GIT COMMANDS**

| Command | What It Does |
|---------|------------|
| `git status` | See current changes |
| `git add .` | Stage all changes |
| `git commit -m "message"` | Commit changes |
| `git push origin branch-name` | Push to GitHub |
| `git pull origin main` | Pull latest from main |
| `git checkout -b feature/xyz` | Create new branch |

---

## **WORKFLOW: Issue → Code → PR → Merge**

```
1️⃣  View issue
    gh issue view 5

2️⃣  Create branch
    gh issue develop 5
    # Creates: 5-issue-title

3️⃣  Make changes
    nano file.ts
    git add .
    git commit -m "fix: description"

4️⃣  Push branch
    git push origin 5-issue-title

5️⃣  Create PR
    gh pr create --title "Fix: ..." --body "Fixes #5"

6️⃣  Review & merge
    gh pr merge 1
```

---

## **IN VS CODE**

**Open Issue Notebooks:**
- `Cmd + Shift + P` → `GitHub Issue Notebooks: Create Issue Notebook`

**See Git Blame:**
- Hover over line of code → see who changed it

**See Pull Request Monitor:**
- Left sidebar → GitHub Pull Request Monitor icon

---

## **REAL EXAMPLE: Fix Attack Logic Bug**

```bash
# 1. See issues
gh issue list

# 2. Find DurakRoom attack issue (#7)
gh issue view 7

# 3. Create branch
gh issue develop 7

# 4. Edit file
vim packages/server/src/rooms/DurakRoom.ts
# Fix the bug...

# 5. Check changes
git diff

# 6. Commit
git add .
git commit -m "fix: resolve attack validation bug (#7)"

# 7. Push
git push

# 8. Create PR (auto-linked to #7)
gh pr create

# 9. Wait for review

# 10. Merge
gh pr merge
```

---

## **COMMON ISSUES**

| Problem | Solution |
|---------|----------|
| "Not authenticated" | `gh auth login` |
| "Cannot push" | `git remote set-url origin https://github.com/turbo-leg/Durak.git` |
| "Merge conflict" | `git status`, fix files, `git add .`, `git commit` |
| "Out of date" | `git fetch origin && git rebase origin/main` |

---

## **TIPS**

✅ Always create a branch for each issue  
✅ Write clear commit messages  
✅ Link PRs to issues with "Fixes #5"  
✅ Keep branches small (one issue = one PR)  
✅ Review changes before committing: `git diff`  
✅ Pull before pushing: `git pull origin main`  

---

## **Resources**

- GitHub CLI Manual: `gh help`
- Repo: https://github.com/turbo-leg/Durak
- Issues: https://github.com/turbo-leg/Durak/issues
- PRs: https://github.com/turbo-leg/Durak/pulls
