
echo "Creating Phase 2 issues..."
gh issue create --title "Phase 2: Playmat UI (Hands, Table, Deck, Huzur)" --body "Render own hand, face-down opponent cards, deck size, face-up Huzur card."
gh issue create --title "Phase 2: Actions UI (Attack, Defend, Pass, Take)" --body "Click/Drag cards to attack/defend, 'Take Cards' button, 'Pass' button."
gh issue create --title "Phase 2: Error Notification Toast System" --body "Basic UI for invalid moves (linked to server error emissions)."
gh issue create --title "Phase 2: 'Players in Room' Counter" --body "Display in the header/lobby UI."

echo "Creating Phase 3 issues..."
gh issue create --title "Phase 3: Integrate GrandmasterBot & MCTS" --body "Act as an opponent if there aren't enough players."
gh issue create --title "Phase 3: Room Config (Singleplayer vs Multiplayer)" --body "Add configuration for singleplayer vs multiplayer rooms."

echo "Creating Phase 4 issues..."
gh issue create --title "Phase 4: Connect Redis to Colyseus" --body "Allow multiple horizontal Node containers."
gh issue create --title "Phase 4: Setup Load Balancer in docker-compose" --body "Setup Nginx or a Load Balancer routing to server instances."

echo "Creating Phase 5 issues..."
gh issue create --title "Phase 5: Card Animations" --body "Dealing, attacking, throwing to graveyard."
gh issue create --title "Phase 5: Chat System and Emote Reactions" --body "Basic communication system."
echo "Done!"
