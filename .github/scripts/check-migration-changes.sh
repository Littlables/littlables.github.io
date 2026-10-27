#!/bin/bash
# Check if Supabase migration files changed in this push.
# Sets 'should_migrate' output to 'true' or 'false'.
#
# Required env vars (set by the workflow):
#   EVENT_NAME    - github.event_name
#   FORCE_MIGRATE - inputs.run_migrations (workflow_dispatch only)
#   BEFORE_SHA    - github.event.before
#   CURRENT_SHA   - github.sha
#   GITHUB_OUTPUT - path to GitHub Actions output file (set by runner)

set -u

if [ "$EVENT_NAME" = "workflow_dispatch" ] && [ "$FORCE_MIGRATE" = "true" ]; then
  echo "Manual workflow dispatch with run_migrations=true; running migrations."
  echo "should_migrate=true" >> "$GITHUB_OUTPUT"
  exit 0
fi

if [ -n "$BEFORE_SHA" ] && [ "$BEFORE_SHA" != "0000000000000000000000000000000000000000" ] && git cat-file -e "${BEFORE_SHA}^{commit}" 2>/dev/null; then
  CHANGED_FILES=$(git diff --name-only "$BEFORE_SHA" "$CURRENT_SHA")
elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
  CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD)
else
  CHANGED_FILES=$(git ls-files)
fi

echo "Changed files in push:"
echo "$CHANGED_FILES"

if echo "$CHANGED_FILES" | grep -Eq '^supabase/.*\.sql$'; then
  echo "Changes detected in supabase/ — running migrations."
  echo "should_migrate=true" >> "$GITHUB_OUTPUT"
else
  echo "No changes in supabase/ — skipping migrations."
  echo "should_migrate=false" >> "$GITHUB_OUTPUT"
fi
