#!/bin/bash
# Two-way sync with the remote: commits and pushes local edits, and pulls
# anything that landed on the branch while you were working. Run it with no
# arguments to loop; `--once` does a single cycle (used by the tests).
#
# The one thing it will not do is guess at a conflict: if a rebase cannot be
# replayed cleanly it puts the repository back the way it was and stops, rather
# than leaving a half-finished merge behind.

set -u
cd "$(dirname "$0")" || exit 1

INTERVAL=${INTERVAL:-10}      # seconds between cycles
PULL_EVERY=${PULL_EVERY:-6}   # pull once every N cycles, even with nothing to push
ONCE=false
[ "${1:-}" = "--once" ] && ONCE=true

pull_tick=0

bail_on_conflict() {
  git rebase --abort 2>/dev/null
  echo ""
  echo "*** CONFLICT: a remote change touches the same lines as yours."
  echo "*** The repository was put back the way it was — nothing is lost."
  echo "*** Resolve it by hand, then start this script again."
  exit 1
}

sync_once() {
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)

  # Another git process holds the index — skip rather than race it.
  if [ -f .git/index.lock ]; then
    echo "[$(date '+%H:%M:%S')] git is busy elsewhere — skipping this cycle."
    return 0
  fi

  git add -A
  if ! git diff-index --quiet HEAD --; then
    git commit -q -m "Auto-update: File changed"
    echo "[$(date '+%H:%M:%S')] committed local changes"
  fi

  pull_tick=$((pull_tick + 1))
  local ahead
  ahead=$(git rev-list --count "origin/$branch..HEAD" 2>/dev/null || echo 0)

  # Pull on a slow cadence, and always before pushing something.
  if [ "$pull_tick" -ge "$PULL_EVERY" ] || [ "$ahead" != "0" ]; then
    pull_tick=0
    if ! git pull --rebase --quiet origin "$branch"; then
      bail_on_conflict
    fi
    ahead=$(git rev-list --count "origin/$branch..HEAD" 2>/dev/null || echo 0)
  fi

  if [ "$ahead" != "0" ]; then
    if git push --quiet origin "$branch"; then
      echo "[$(date '+%H:%M:%S')] pushed $ahead commit(s) to $branch"
    else
      # Someone pushed between our pull and our push — take theirs, then retry.
      git pull --rebase --quiet origin "$branch" || bail_on_conflict
      git push --quiet origin "$branch" && echo "[$(date '+%H:%M:%S')] pushed after rebasing on new remote work"
    fi
  fi
}

if [ "$ONCE" = true ]; then
  sync_once
  exit 0
fi

echo "==================================================="
echo "[SYNC] Two-way auto-sync is running."
echo "Local edits go up, remote changes come down."
echo "Please do not close this window."
echo "==================================================="
while true; do
  sync_once
  sleep "$INTERVAL"
done
