const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_NUM = 3;
const OWNER = "turbo-leg";
const PROJECT_NODE_ID = "PVT_kwHOCsmXI84BU8hD";
const STATUS_FIELD_ID = "PVTSSF_lAHOCsmXI84BU8hDzhMI8YI";

// Mapping local states to GitHub Project Status Option IDs
const STATUS_MAP = {
  "TODO": "f75ad846",
  "UP_NEXT": "f75ad846",      // Mapping UP_NEXT to Todo
  "IN_PROGRESS": "47fc9ee4",
  "DONE": "98236657"
};

console.log('Fetching current project items from GitHub...');
try {
  // 1. Fetch current project items
  const itemsJson = execSync(`gh project item-list ${PROJECT_NUM} --owner "${OWNER}" --format json --limit 200`, { encoding: 'utf-8' });
  const projectItems = JSON.parse(itemsJson).items;

  // 2. Read local issues list
  const issuesFilePath = path.join(__dirname, '..', 'data', 'issues_list.json');
  const localIssues = JSON.parse(fs.readFileSync(issuesFilePath, 'utf-8'));

  let updatedCount = 0;

  // 3. Iterate and synchronize
  for (const localIssue of localIssues) {
    const targetStatusId = STATUS_MAP[localIssue.state];
    
    if (!targetStatusId) {
      console.warn(`Unknown state '${localIssue.state}' for local issue #${localIssue.number}. Skipping.`);
      continue;
    }

    // Try to find the matching item in the GitHub Project board by title or number
    let matchingItem = projectItems.find(item => 
      (item.content && item.content.number === localIssue.number) || 
      (item.title && item.title.includes(localIssue.title))
    );

    let itemId = matchingItem ? matchingItem.id : null;

    if (!itemId) {
      console.log(`Adding missing issue #${localIssue.number} to project board...`);
      try {
        const issueUrl = `https://github.com/${OWNER}/Durak/issues/${localIssue.number}`;
        const addJson = execSync(`gh project item-add ${PROJECT_NUM} --owner "${OWNER}" --url "${issueUrl}" --format json`, { encoding: 'utf-8' });
        
        const addedItem = JSON.parse(addJson);
        itemId = addedItem.id;
        
      } catch (err) {
        // Issue might already belong to the project or have another error, ignore
        if (!err.message.includes("Project already has associated item")) {
          console.error(`Failed to add issue #${localIssue.number} to board:`, err.message);
        }
      }
    }

    if (itemId) {
      console.log(`Updating issue #${localIssue.number} to ${localIssue.state}...`);
      
      const cmd = `gh project item-edit --id ${itemId} --project-id ${PROJECT_NODE_ID} --field-id ${STATUS_FIELD_ID} --single-select-option-id ${targetStatusId}`;
      
      try {
        execSync(cmd, { stdio: 'ignore' });
        updatedCount++;
      } catch (err) {
        console.error(`Failed to update item ${itemId}:`, err.message);
      }
    } else {
      console.log(`Could not find or add a matching GitHub project item for local issue: "${localIssue.title}"`);
    }
  }

  console.log(`\nSynchronization complete! Successfully updated ${updatedCount} items on the Kanban board.`);

} catch (err) {
  console.error("An error occurred during synchronization:", err.message);
}
