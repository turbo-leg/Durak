#!/bin/bash
gh issue create --title "Phase 3: Room Config (Singleplayer vs Multiplayer)" --body "Add configuration for singleplayer vs multiplayer rooms."
gh issue create --title "Phase 4: Connect Redis to Colyseus" --body "Allow multiple horizontal Node containers."
gh issue create --title "Phase 4: Setup Load Balancer in docker-compose" --body "Setup Nginx or a Load Balancer routing to server instances."
gh issue create --title "Phase 5: Card Animations" --body "Dealing, attacking, throwing to graveyard."
gh issue create --title "Phase 5: Chat System and Emote Reactions" --body "Basic communication system."
echo "Done!"
