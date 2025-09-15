#!/usr/bin/env bash
# gitpush.sh — smart push with ssh-agent reuse
# - Reuse existing ssh-agent if available (from previous runs)
# - Otherwise start it and persist env so future runs can reuse
# - Add your SSH key only if not already loaded
# - Then: git add . ; git commit ; git push origin main

set -u

# ---- Config ----
KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/id_ed25519}"     # change if your key has a different name
AGENT_ENV_FILE="$HOME/.ssh/.ssh-agent-env"            # where we persist agent env between runs
BRANCH="${1:-main}"                                   # optional arg: branch to push (default: main)
COMMIT_MSG="${2:-+}"                                  # optional arg: commit message (default: "+")
# Usage examples:
#   ./gitpush.sh                -> pushes 'main' with commit message "+"
#   ./gitpush.sh dev "WIP"      -> pushes 'dev' with commit message "WIP"

# ---- Helpers ----
start_agent() {
  eval "$(ssh-agent -s)" >/dev/null
  # Persist env so next run can reuse without starting a fresh agent
  umask 077
  {
    echo "export SSH_AUTH_SOCK='$SSH_AUTH_SOCK'"
    echo "export SSH_AGENT_PID='$SSH_AGENT_PID'"
  } > "$AGENT_ENV_FILE"
}

agent_running() {
  # shellcheck disable=SC2009
  [ -n "${SSH_AGENT_PID-}" ] && ps -p "$SSH_AGENT_PID" >/dev/null 2>&1
}

load_agent_env_if_any() {
  if [ -f "$AGENT_ENV_FILE" ]; then
    # shellcheck disable=SC1090
    . "$AGENT_ENV_FILE"
  fi
}

key_loaded() {
  ssh-add -l >/dev/null 2>&1
}

# ---- Ensure agent is up and key is loaded ----
load_agent_env_if_any

if ! agent_running; then
  # Maybe agent is running but env file is stale; try detect by process name (best-effort)
  if command -v pgrep >/dev/null 2>&1 && pgrep -u "$USER" ssh-agent >/dev/null 2>&1; then
    # There is an agent, but we don't know its env; safest is to start our own to avoid guessing sockets.
    start_agent
  else
    start_agent
  fi
fi

# Ensure key is loaded (ssh-add -l returns non-zero if no identities)
if ! key_loaded; then
  if [ ! -f "$KEY_PATH" ]; then
    echo "❌ SSH key not found at: $KEY_PATH"
    echo "   Set SSH_KEY_PATH to your key path or create one with: ssh-keygen -t ed25519"
    exit 1
  fi
  echo "🔐 Loading SSH key: $KEY_PATH"
  ssh-add "$KEY_PATH" || { echo "❌ Failed to add SSH key"; exit 1; }
fi

# ---- Git workflow ----
# Ensure we’re inside a git repo
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "❌ Not a git repository."; exit 1; }

# Stage everything
git add .

# Commit only if there are staged changes
if ! git diff --cached --quiet --exit-code; then
  git commit -m "$COMMIT_MSG"
else
  echo "ℹ️ Nothing to commit (working tree clean)."
fi

# Push
echo "⬆️  Pushing to origin/$BRANCH ..."
git push origin "$BRANCH"
