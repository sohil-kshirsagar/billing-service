#!/bin/bash

# Arrays of random PR titles and changes
PREFIXES=("fix" "feat" "chore" "refactor" "docs" "test" "perf" "style")
COMPONENTS=("billing" "invoice" "payment" "subscription" "customer" "ramp" "stripe" "webhook" "auth" "api" "config" "logging" "cache" "queue" "db" "validator" "middleware" "utils" "types" "errors")
ACTIONS=("update" "improve" "add" "remove" "fix" "refactor" "optimize" "enhance" "clean" "restructure")
TARGETS=("error handling" "validation" "logging" "types" "tests" "docs" "config" "performance" "security" "caching" "retry logic" "timeout" "rate limiting" "pagination" "filtering" "sorting" "formatting" "null checks" "edge cases" "defaults")

for i in $(seq 1 200); do
  # Pick random elements
  PREFIX=${PREFIXES[$RANDOM % ${#PREFIXES[@]}]}
  COMPONENT=${COMPONENTS[$RANDOM % ${#COMPONENTS[@]}]}
  ACTION=${ACTIONS[$RANDOM % ${#ACTIONS[@]}]}
  TARGET=${TARGETS[$RANDOM % ${#TARGETS[@]}]}

  BRANCH_NAME="auto-pr-$i-$PREFIX-$COMPONENT"
  PR_TITLE="$PREFIX($COMPONENT): $ACTION $TARGET"

  # Create branch
  git checkout -b "$BRANCH_NAME" main --quiet

  # Make a small change - add a comment to a random file
  COMMENT="// Auto-generated change #$i: $ACTION $TARGET in $COMPONENT"
  echo "$COMMENT" >> src/types/common.ts

  # Commit
  git add -A
  git commit -m "$PR_TITLE" --quiet

  # Push and create PR
  git push origin "$BRANCH_NAME" --quiet 2>/dev/null
  gh pr create --title "$PR_TITLE" --body "Auto-generated PR #$i for testing purposes." --head "$BRANCH_NAME" --base main 2>/dev/null

  # Go back to main
  git checkout main --quiet

  # Close the PR immediately (we just want the PR numbers)
  gh pr close "$BRANCH_NAME" --delete-branch 2>/dev/null

  echo "Created and closed PR $i: $PR_TITLE"
done

echo "Done! Created 200 PRs."
