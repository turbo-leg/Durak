#!/usr/bin/env zsh
gh project item-list 3 --owner turbo-leg --limit 200 > items.txt
move_to() {
    local pattern="$1"
    local status_id="$2"
    grep -i "$pattern" items.txt | while read -r line; do
        item_id=$(echo "$line" | awk '{print $NF}')
        if [[ -n "$item_id" ]]; then
            echo "Moving item $item_id for $pattern"
            gh project item-edit --id "$item_id" \
                 --project-id "PVT_kwHOCsmXI84BU8hD" \
                 --field-id "PVTSSF_lAHOCsmXI84BU8hDzhMI8YI" \
                 --single-select-option-id "$status_id"
        fi
    done
}
# Done
move_to "Phase 1: Implement Game Over conditions" "98236657"
# In Progress
move_to "Phase 1: Handle player disconnections" "47fc9ee4"
