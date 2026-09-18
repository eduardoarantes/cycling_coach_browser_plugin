#!/usr/bin/env bash
set -euo pipefail

# The workflow supplies a normalized version and a unique run/attempt branch.
: "${RELEASE_VERSION:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}"
BRANCH="release/actions-v${RELEASE_VERSION}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
BASE_SHA=$(git rev-parse HEAD)

git switch -c "$BRANCH"
node scripts/release-version.cjs write "$RELEASE_VERSION"
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add package.json package-lock.json public/manifest.json
git commit -m "chore(release): bump version to ${RELEASE_VERSION}"
BUMP_SHA=$(git rev-parse HEAD)
git push origin "HEAD:refs/heads/$BRANCH"

BODY_FILE=$(mktemp)
trap 'rm -f "$BODY_FILE"' EXIT
cat > "$BODY_FILE" <<BODY
Set package.json, package-lock.json, and the extension manifest to ${RELEASE_VERSION}.

Requested through the Release Artifact workflow. The workflow waits for the pull-request CI run for this commit and merges only after it passes; branch protection still applies.
BODY
PR_URL=$(gh pr create --base main --head "$BRANCH" \
  --title "chore(release): bump version to ${RELEASE_VERSION}" --body-file "$BODY_FILE")
printf 'Version bump PR: %s\n' "$PR_URL"
printf 'Version bump PR: %s\n' "$PR_URL" >> "$GITHUB_STEP_SUMMARY"

# Only pull_request CI satisfies required branch checks. A manually dispatched
# run can pass for the same SHA while GitHub still reports validate as expected.
# Discover the run for this unique branch and exact commit, never a previous run.
RUN_ID=''
for ATTEMPT in {1..30}; do
  RUN_ID=$(gh api --method GET \
    "repos/$GITHUB_REPOSITORY/actions/workflows/ci.yml/runs" \
    -f event=pull_request -f "branch=$BRANCH" -f "head_sha=$BUMP_SHA" \
    --jq '.workflow_runs[0].id // empty')
  if [[ "$RUN_ID" =~ ^[0-9]+$ ]]; then break; fi
  sleep 2
done
[[ "$RUN_ID" =~ ^[0-9]+$ ]] || { echo 'No pull-request CI run appeared within 60 seconds.' >&2; exit 1; }
printf 'CI run: https://github.com/%s/actions/runs/%s\n' "$GITHUB_REPOSITORY" "$RUN_ID" >> "$GITHUB_STEP_SUMMARY"

# GitHub requires execution approval for PRs created with GITHUB_TOKEN. This
# approves only the run of the version-only PR just created, not a PR review.
CONCLUSION=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$RUN_ID" --jq '.conclusion // empty')
if [[ "$CONCLUSION" == action_required ]]; then
  gh api --method POST "repos/$GITHUB_REPOSITORY/actions/runs/$RUN_ID/approve"
fi
# Bound the wait. A failure leaves the PR available for diagnosis and never tags.
timeout 20m gh run watch "$RUN_ID" --interval 10 --exit-status
CI_SHA=$(gh api "repos/$GITHUB_REPOSITORY/actions/runs/$RUN_ID" --jq '.head_sha')
[[ "$CI_SHA" == "$BUMP_SHA" ]] || { echo 'CI ran on a different commit.' >&2; exit 1; }

# Do not silently release intervening changes or merge a stale version bump.
MAIN_SHA=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq '.object.sha')
[[ "$MAIN_SHA" == "$BASE_SHA" ]] || { echo 'main changed during CI. Close this PR and run the release again.' >&2; exit 1; }
gh pr merge "$PR_URL" --squash --match-head-commit "$BUMP_SHA"
MERGE_SHA=$(gh pr view "$PR_URL" --json mergeCommit --jq '.mergeCommit.oid')
[[ "$MERGE_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'Version PR was not merged.' >&2; exit 1; }
git fetch origin "$MERGE_SHA"
git checkout --detach "$MERGE_SHA"
# Ensure the merge contains exactly the validated tree, even if main raced ahead.
[[ "$(git rev-parse HEAD^{tree})" == "$(git rev-parse "$BUMP_SHA^{tree}")" ]] || {
  echo 'Merged tree differs from the commit validated by CI; release stopped.' >&2
  exit 1
}
