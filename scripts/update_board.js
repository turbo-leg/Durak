const fs = require('fs');
const path = require('path');

const issuesFilePath = path.join(__dirname, '..', 'issues_list.json');

// Define the new statuses based on our project progress
const kanbanMap = {
  "DONE": [11, 7, 5, 4, 3, 1],
  "IN_PROGRESS": [9],
  "UP_NEXT": [8],
  "TODO": [6, 2]
};

try {
  // Read current issues
  const rawData = fs.readFileSync(issuesFilePath, 'utf16le'); // Try utf16 since it has weird token
  let cleanData = rawData.trim();
  if (cleanData.charCodeAt(0) === 0xFEFF) {
    cleanData = cleanData.slice(1);
  }
  let issues;
  try {
    issues = JSON.parse(cleanData);
  } catch (e) {
    // fallback if it wasn't utf16le
    const fallbackData = fs.readFileSync(issuesFilePath, 'utf8').replace(/^\uFEFF/, '').trim();
    issues = JSON.parse(fallbackData);
  }

  // Update statuses
  const updatedIssues = issues.map(issue => {
    let newState = issue.state;
    
    for (const [state, numbers] of Object.entries(kanbanMap)) {
      if (numbers.includes(issue.number)) {
        newState = state;
        break;
      }
    }
    
    return { ...issue, state: newState };
  });

  // Write the formatted JSON back to the file
  fs.writeFileSync(issuesFilePath, JSON.stringify(updatedIssues, null, 2));
  console.log('✅ issues_list.json has been successfully updated with the new Kanban statuses!');
  
} catch (error) {
  console.error('❌ Error updating the Kanban board:', error.message);
}
