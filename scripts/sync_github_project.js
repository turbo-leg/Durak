const { execSync } = require('child_process');
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('all_items.json', 'utf8'));
const FIELD_ID = "PVTSSF_lAHOCsmXI84BU8hDzhMI8YI";
const DONE_OPT = "98236657";
const IN_PROG_OPT = "47fc9ee4";

const donePatterns = [
  "Phase 1:",
  "Phase 2:",
  "Basic Frontend Connection",
  "Implement Game State Schema",
  "Fix game logic error",
  "Fix game logic and build",
  "Initialize Colyseus Server",
  "Discord App & Environment"
];
const inProgressPatterns = [
  "Card Animations"
];

for (const item of data.items) {
  const title = item.title;
  let targetStatusOpt = null;
  let targetStatusName = null;

  if (donePatterns.some(p => title.includes(p))) {
    if (item.status === "Done") continue;
    targetStatusOpt = DONE_OPT; targetStatusName = "Done";
  } else if (inProgressPatterns.some(p => title.includes(p))) {
    if (item.status === "In Progress") continue;
    targetStatusOpt = IN_PROG_OPT; targetStatusName = "In Progress";
  }

  if (!targetStatusOpt) continue;

  console.log(`Updating \x1b[36m"${title}"\x1b[0m -> \x1b[32m${targetStatusName}\x1b[0m...`);
  
  try {
    execSync(`gh project item-edit --id ${item.id} --project-id PVT_kwHOCsmXI84BU8hD --field-id ${FIELD_ID} --single-select-option-id ${targetStatusOpt}`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Failed to update item:', item.title);
  }
}
console.log("All GitHub Project updates finished.");
