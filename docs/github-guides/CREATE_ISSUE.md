# 🎯 How to Create Issues on GitHub

## **Quick Answer**

### **Method 1: Using GitHub CLI (Terminal) - FASTEST ⚡**

```bash
gh issue create --title "Your issue title" --body "Description of the issue"
```

**Example:**

```bash
gh issue create --title "Fix attack validation bug" --body "The attack validation function is not checking card ranks correctly"
```

**Output:**

```
Creating issue in turbo-leg/Durak

✓ Created issue #8: Fix attack validation bug
https://github.com/turbo-leg/Durak/issues/8
```

---

### **Method 2: Using GitHub Website (Browser) - EASIEST 🌐**

1. Go to: `https://github.com/turbo-leg/Durak/issues`
2. Click green **"New issue"** button
3. Fill in:
   - **Title**: "What's the problem or feature?"
   - **Description**: "More details..."
4. Click **"Submit new issue"**
5. ✅ Issue created!

---

### **Method 3: Using VS Code (Notebook) - VISUAL 📓**

1. Press `Cmd + Shift + P`
2. Type: `GitHub Issue Notebooks`
3. Select: `Create Issue Notebook`
4. In the notebook, click **"New Issue"** button
5. Fill in form
6. ✅ Issue created!

---

## **Detailed Guide: Create Issue via Terminal**

### **Step 1: Basic Issue**

```bash
gh issue create --title "Add card animations"
```

This creates an issue with just a title.

### **Step 2: Issue with Description**

```bash
gh issue create \
  --title "Add card animations" \
  --body "Cards should animate when dealt, played, and discarded"
```

### **Step 3: Issue with All Details**

```bash
gh issue create \
  --title "Add card animations" \
  --body "Cards should animate when dealt, played, and discarded

## Description
Players should see smooth animations when:
- Cards are dealt from deck
- Cards are played on the table
- Cards move to discard pile

## Acceptance Criteria
- [ ] Deal animation (0.5s)
- [ ] Play animation (0.3s)
- [ ] Discard animation (0.2s)
- [ ] Works on all screen sizes

## Related
Fixes #5" \
  --assignee @me \
  --label "enhancement" \
  --label "ui"
```

---

## **All Options Explained**

| Option        | What It Does           | Example                   |
| ------------- | ---------------------- | ------------------------- |
| `--title`     | Issue title (required) | `--title "Fix bug"`       |
| `--body`      | Description            | `--body "Description..."` |
| `--assignee`  | Assign to person       | `--assignee @me`          |
| `--label`     | Add labels (tags)      | `--label "bug"`           |
| `--project`   | Add to project         | `--project "Roadmap"`     |
| `--milestone` | Link to milestone      | `--milestone "v1.0"`      |
| `--web`       | Open in browser        | `--web`                   |

---

## **Real Examples**

### **Example 1: Bug Report**

```bash
gh issue create \
  --title "Attack validation fails with jokers" \
  --body "When a player attacks with joker cards, the validation returns false even though jokers should beat anything"
```

### **Example 2: Feature Request**

```bash
gh issue create \
  --title "Add sound effects" \
  --body "Add sound effects for:
- Card deal
- Card play
- Round win
- Game over"
```

### **Example 3: Documentation**

```bash
gh issue create \
  --title "Document game flow in README" \
  --body "Add diagrams explaining:
1. Turn flow
2. Attack/defend cycle
3. Win conditions" \
  --label "documentation"
```

### **Example 4: With Checklist**

```bash
gh issue create \
  --title "Implement Discord integration" \
  --body "## Tasks
- [ ] Setup Discord bot
- [ ] Add OAuth flow
- [ ] Test authentication
- [ ] Deploy to production"
```

---

## **Step-by-Step: Create Your First Issue**

### **1. Open Terminal**

```bash
cd /Users/khanboldbattulga/Documents/GitHub/Durak
```

### **2. Create Simple Issue**

```bash
gh issue create --title "Test issue" --body "This is my first issue!"
```

### **3. See Your Issue**

```bash
gh issue list
```

You'll see your new issue in the list!

### **4. View It Online**

```bash
gh issue view <NUMBER> --web
```

Opens it in browser.

---

## **Pro Tips**

### **Tip 1: Use Templates**

If you want to always include certain information:

```bash
# Create a template
gh issue create \
  --title "New Issue" \
  --body "## Description
[Describe the issue]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]"
```

### **Tip 2: Assign to Yourself**

```bash
gh issue create --title "..." --body "..." --assignee @me
```

### **Tip 3: Add Labels**

```bash
gh issue create \
  --title "..." \
  --body "..." \
  --label "bug" \
  --label "urgent"
```

### **Tip 4: Link to Related Issues**

In the body, mention related issues:

```bash
gh issue create \
  --title "..." \
  --body "Fixes #5
Related to #7"
```

### **Tip 5: Use Markdown in Description**

```bash
gh issue create \
  --title "Fix attack validation" \
  --body "## Problem
The \`isValidMass()\` function returns **false** for valid attacks.

## Solution
Use \`isValidMassAttack()\` instead.

## Code Changes
\`\`\`typescript
// Before
if (!isValidMass(cards)) return false;

// After
if (!isValidMassAttack(cards, players, deck)) return false;
\`\`\`"
```

---

## **Quick Command Reference**

| What You Want         | Command                                                |
| --------------------- | ------------------------------------------------------ |
| Simple issue          | `gh issue create --title "Title"`                      |
| With description      | `gh issue create --title "Title" --body "Description"` |
| Assign to you         | Add `--assignee @me`                                   |
| Add label             | Add `--label "bug"`                                    |
| Multiple labels       | `--label "bug" --label "urgent"`                       |
| Assign to person      | `--assignee username`                                  |
| Open in browser       | Add `--web`                                            |
| View in browser after | `gh issue view <NUM> --web`                            |

---

## **Real Workflow: Create Issue + Work On It**

```bash
# 1. Create issue
gh issue create --title "Fix attack bug" --body "Attack validation broken"

# 2. See all issues
gh issue list
# Output shows your new issue as #8

# 3. Start working on it
gh issue develop 8
# Creates branch: 8-fix-attack-bug

# 4. Make changes...

# 5. Commit
git add .
git commit -m "fix: attack validation"

# 6. Push
git push

# 7. Create PR
gh pr create

# 8. Link to issue
# In PR description, say: "Fixes #8"

# 9. Merge when approved
gh pr merge

# 10. Issue auto-closes! ✅
```

---

## **Differences Between Methods**

| Method       | Speed   | Features    | Keyboard    |
| ------------ | ------- | ----------- | ----------- |
| **Terminal** | ⚡ Fast | All options | ✅ Pure CLI |
| **Browser**  | 🐢 Slow | Visual      | 🖱️ Mouse    |
| **VS Code**  | ⚡ Fast | Most        | ✅ Keyboard |

---

## **What's a Good Issue?**

### **✅ Good Issue:**

```
Title: Fix attack validation with jokers

Description:
When attacking with joker cards, the validation fails.

Steps to reproduce:
1. Create game with 2 players
2. Player 1 has: Jack, Ace, Red Joker
3. Player 1 attacks with Red Joker
4. Validation returns false (but should return true)

Expected: Joker should always beat non-joker
Actual: Joker beats validation function
```

### **❌ Bad Issue:**

```
Title: Bug

Description: it dont work
```

---

## **Checklist: Before Creating Issue**

- [ ] Clear title (what's the problem?)
- [ ] Description (why is it a problem?)
- [ ] Steps to reproduce (how to see it?)
- [ ] Expected vs actual behavior
- [ ] Any error messages?
- [ ] Which file is affected?
- [ ] Is there a related issue?

---

## **After Creating: What Happens?**

1. ✅ Issue gets a number (#8, #9, etc.)
2. ✅ Issue appears on GitHub.com
3. ✅ You can work on it: `gh issue develop 8`
4. ✅ Others can comment on it
5. ✅ Create a PR linked to it: "Fixes #8"
6. ✅ When PR merges, issue auto-closes

---

## **Summary**

**Fastest way to create issue:**

```bash
gh issue create --title "Title" --body "Description"
```

**Common additions:**

```bash
--assignee @me           # Assign to yourself
--label "bug"            # Add a label
--web                    # Open in browser after
```

**Then work on it:**

```bash
gh issue develop 8       # Creates branch
# Edit files...
git add . && git commit -m "fix"
git push
gh pr create             # Create PR
```

**Done!** 🎉

---

**Ready to create your first issue?**

Try this now:

```bash
gh issue create --title "Test: Learn GitHub" --body "Testing issue creation workflow"
```

Then:

```bash
gh issue list
```

See it there? Great! You've created your first issue! 🚀
