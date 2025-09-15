#!/usr/bin/env bash
# gitpush.sh - add, commit, push with ssh-agent

# Start ssh-agent in this shell
eval "$(ssh-agent -s)"

# Add your key (adjust path if your key has a different name)
ssh-add ~/.ssh/id_ed25519

# Do the Git workflow
git add .
git commit -m "+"
git push origin main

# Kill the agent so it doesn’t hang around after the script exits
ssh-agent -k
