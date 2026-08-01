#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const read = file => readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
const pull = read('.github/workflows/pull-shared-with-protected-evidence.yml');
const proof = read('.github/workflows/prove-shared-update-release.yml');
const validate = read('.github/workflows/validate.yml');
const retired = read('.github/workflows/update-shared.yml');
const sourceReader = read('scripts/read-public-shared-source.mjs');
const classifier = read('scripts/classify-connect-shared-pin.mjs');
const reconstructor = read('scripts/reconstruct-shared-dependency.mjs');
const reusedCandidate = read('scripts/validate-reused-shared-candidate.mjs');
const exactPin = read('scripts/verify-shared-dependency-pin.mjs');
const identityWriter = read('scripts/write-build-identity.mjs');
const identityVerifier = read('scripts/verify-connect-build-identity-dist.mjs');
const runbook = read('docs/SHARED_PROPAGATION_RELEASE_RUNBOOK.md').replace(/\s+/g, ' ');
const workflowFiles = readdirSync('.github/workflows')
  .filter(file => /\.ya?ml$/i.test(file))
  .map(file => read(join('.github/workflows', file)));
const allWorkflows = workflowFiles.join('\n');

assert(!existsSync('.npmrc'), 'A repository .npmrc is forbidden');
for (const workflow of [pull, proof, validate, retired]) {
  assert(!workflow.includes('SCALESMALL_PAT'), 'Shared propagation must not depend on the retired PAT');
}
assert(!pull.includes('secrets.'), 'Shared pull must not read a stored secret');
assert(!proof.includes('secrets.'), 'Release proof must not read a stored secret');
assert(!validate.includes('secrets.'), 'Validate must build with nonsecret validation-only inputs');
assert(!pull.includes('repository_dispatch'), 'Shared pull must not depend on cross-repository dispatch');
assert(!pull.includes('shared-updated'), 'Shared pull must not accept producer payloads');

assert.match(pull, /^on:\n {2}schedule:\n {4}- cron: '23 \* \* \* \*'\n {2}workflow_dispatch:/m);
assert.match(
  pull,
  /github\.event_name == 'workflow_dispatch'\n {6}\|\| vars\.SSAI_SHARED_PULL_SCHEDULE_ENABLED == 'true'/,
);
assert.match(pull, /concurrency:\n {2}group: connect-local-shared-pull\n {2}cancel-in-progress: false/);
assert.match(pull, /^permissions: \{\}$/m);
assert.match(pull, /SSAI_CONNECT_PROTECTED_MAIN_RULESET_ID/);
assert.match(pull, /expected_ruleset_name='SSAI Connect protected main'/);
for (const control of [
  '.current_user_can_bypass == "never"',
  'count_type("deletion") == 1',
  'count_type("non_fast_forward") == 1',
  'count_type("required_linear_history") == 1',
  'count_type("pull_request") == 1',
  '.required_approving_review_count >= 1',
  '.dismiss_stale_reviews_on_push == true',
  '.require_last_push_approval == true',
  '.required_review_thread_resolution == true',
  '.strict_required_status_checks_policy == true',
  '{context:"Cloudflare Pages", integration_id:85455}',
  '{context:"validate", integration_id:15368}',
]) {
  assert(pull.includes(control), `Shared pull protection preflight is missing ${control}`);
  assert(proof.includes(control), `Post-merge protection proof is missing ${control}`);
}
assert(!pull.includes('expected_ruleset_id=19612327'), 'Dashboard ruleset ID must not leak into Connect');

assert.match(pull, /discover:\n[\s\S]*?permissions:\n {6}actions: read\n {6}contents: read\n {6}pull-requests: read\n {4}outputs:/);
assert.match(pull, /gate:\n[\s\S]*?permissions:\n {6}contents: read/);
assert.match(pull, /publish:\n[\s\S]*?permissions:\n {6}contents: write/);
assert.match(pull, /open-review:\n[\s\S]*?permissions:\n {6}actions: read\n {6}contents: read\n {6}pull-requests: write/);
assert.match(pull, /branch-gate:\n[\s\S]*?permissions:\n {6}actions: write\n {6}contents: read\n {6}pull-requests: read/);
assert.equal((pull.match(/contents: write/g) ?? []).length, 1);
assert.equal((pull.match(/pull-requests: write/g) ?? []).length, 1);
assert.equal((pull.match(/actions: write/g) ?? []).length, 1);
assert.equal((allWorkflows.match(/^\s+actions: write$/gm) ?? []).length, 1);
assert.equal((allWorkflows.match(/actions\/workflows\/[^\s"']+\/dispatches/g) ?? []).length, 1);
for (const forbiddenPermission of ['checks: write', 'deployments: write', 'id-token: write']) {
  assert(!pull.includes(forbiddenPermission), `Shared pull must not grant ${forbiddenPermission}`);
}

assert(pull.includes('automation/ssai-shared-${TARGET_SHARED_SHA}-${CONNECT_BASE_SHA}'));
assert(pull.includes('mode=no_change'));
assert(pull.includes('mode=pending_review'));
assert(pull.includes('mode=branch_ready'));
assert(pull.includes('Close the stale immutable review through the normal human workflow'));
assert(pull.includes('and ([.files[].filename] | sort) == ["package-lock.json", "package.json"]'));
assert(pull.includes('"repos/${GITHUB_REPOSITORY}/git/refs" --input -'));
assert(!pull.includes('git push'), 'Publisher must create a fresh immutable ref through Git data only');
assert(!pull.includes('force-with-lease'));

const publish = pull.split('\n  publish:\n')[1].split('\n  open-review:\n')[0];
const openReview = pull.split('\n  open-review:\n')[1].split('\n  branch-gate:\n')[0];
const branchGate = pull.split('\n  branch-gate:\n')[1];
for (const [name, slice] of [
  ['publisher', publish],
  ['PR writer', openReview],
  ['Actions dispatcher', branchGate],
]) {
  assert(!slice.includes('uses: actions/checkout@'), `${name} must not check out candidate code`);
  assert(!slice.includes('uses: actions/setup-node@'), `${name} must not install a runtime`);
  assert(!slice.includes('node scripts/'), `${name} must not execute repository scripts`);
}
assert(publish.includes('/git/blobs'));
assert(publish.includes('/git/trees'));
assert(publish.includes('/git/commits'));
assert(publish.includes('PACKAGE_JSON_B64'));
assert(openReview.includes('needs: [discover, gate, publish, branch-gate]'));
assert(openReview.includes("needs.discover.outputs.mode == 'pending_review'"));
assert(openReview.includes('needs.discover.outputs.review_candidate_sha || needs.branch-gate.outputs.candidate_sha'));
assert(openReview.includes('needs.discover.outputs.review_branch_gate_run_id || needs.branch-gate.outputs.branch_gate_run_id'));
assert(openReview.includes('draft: false'));
assert(openReview.includes("reviewer='tylan-scale-small'"));
assert(openReview.includes('collaborators/${reviewer}/permission'));
assert(openReview.includes('requested_reviewers'));
assert.equal((openReview.match(/pulls\/\$\{pull_number\}\/requested_reviewers/g) ?? []).length, 3);
for (const control of [
  'pulls/${pull_number}/reviews?per_page=100',
  '.commit_id == $head',
  '.user.type == "User"',
  '.user.login == $reviewer',
  '.state == "APPROVED"',
  '.state == "CHANGES_REQUESTED"',
  '.state == "DISMISSED"',
  'sort_by([.submitted_at // "", .id])',
  'if [ "${latest_decisive_state}" = \'APPROVED\' ]',
  'requested_reviewers_before="$(gh api',
  'if ! jq -e --arg reviewer "${reviewer}"',
  'requested_reviewers_after="$(gh api',
]) {
  assert(openReview.includes(control), `Pending-review repair is missing ${control}`);
}
assert.match(
  openReview,
  /requested_reviewers_after="\$\(gh api \\\n\s+"repos\/\$\{GITHUB_REPOSITORY\}\/pulls\/\$\{pull_number\}\/requested_reviewers"\)"/,
);
assert(openReview.includes('[.users[]? |'));
const reviewerEligibilityPreflight = openReview.indexOf(
  '"repos/${GITHUB_REPOSITORY}/collaborators/${reviewer}/permission"',
);
const pullRequestCreation = openReview.indexOf('gh api --method POST "repos/${GITHUB_REPOSITORY}/pulls"');
assert(reviewerEligibilityPreflight >= 0 && pullRequestCreation > reviewerEligibilityPreflight,
  'Reviewer write eligibility must be established before opening a PR');
assert(openReview.includes('.actor.login == "github-actions[bot]"'));
assert(openReview.includes('.triggering_actor.login == "github-actions[bot]"'));
assert(openReview.includes('event=pull_request&head_sha=${CANDIDATE_SHA}'));
assert(openReview.includes('completed:action_required)'));
assert(branchGate.includes('workflow_id=289102321'));
assert(branchGate.includes("workflow_path='.github/workflows/validate.yml'"));
assert(branchGate.includes('expected_title="Validate Connect app [${correlation}]"'));
assert(branchGate.includes('/actions/workflows/${workflow_id}/dispatches'));
assert(branchGate.includes('correlation="shared-${SHARED_SHA}-${CANDIDATE_SHA}"'));
assert(branchGate.includes('assert_no_open_review before-gate'));
assert(branchGate.includes('assert_no_open_review after-gate'));
assert(branchGate.includes('timeout-minutes: 45'));
assert(branchGate.includes('for _ in $(seq 1 210); do'));
assert(branchGate.includes('.run_attempt == 1'));
assert(branchGate.includes('immutable failures are not rerun'));
assert(!branchGate.includes('/rerun'), 'Immutable candidate failures must never be rerun');

assert.match(retired, /^name: Retired legacy Shared package consumer$/m);
assert.match(retired, /^on:\n {2}workflow_dispatch:/m);
assert.match(retired, /^permissions: \{\}$/m);
assert.match(retired, /^\s+if: \$\{\{ false \}\}$/m);
assert(!retired.includes('repository_dispatch'));
assert(!retired.includes(': write'));

assert.match(validate, /^run-name: >-\n {2}Validate Connect app/m);
assert.match(validate, /workflow_dispatch:\n {4}inputs:\n {6}release_proof_id:/);
assert(validate.includes('DISPATCH_ACTOR: ${{ github.actor }}'));
assert(validate.includes('DISPATCH_TRIGGERING_ACTOR: ${{ github.triggering_actor }}'));
assert(validate.includes("[ \"${DISPATCH_ACTOR}\" != 'github-actions[bot]' ]"));
assert(validate.includes("[ \"${DISPATCH_TRIGGERING_ACTOR}\" != 'github-actions[bot]' ]"));
assert(validate.includes('persist-credentials: false'));
assert(validate.includes('npm ci --ignore-scripts'));
assert(validate.includes('connect-validation-signature'));
assert(validate.includes('VITE_SSAI_BUILD_SHA'));
assert(validate.includes('npm run check'));
assert(validate.includes('verify-connect-build-identity-dist.mjs'));
assert(!validate.includes('git config --global'));

assert.match(proof, /^on:\n {2}pull_request:\n {4}types: \[closed\]\n {4}branches: \[main\]/m);
assert.match(proof, /^permissions: \{\}$/m);
assert.match(proof, /permissions:\n {6}actions: read\n {6}checks: read\n {6}contents: read\n {6}pull-requests: read/);
assert(!proof.includes(': write'));
assert(!proof.includes('uses: actions/checkout@'));
assert(!proof.includes('uses: actions/setup-node@'));
assert(proof.includes('MERGED_SHA: ${{ github.event.pull_request.merge_commit_sha }}'));
assert(proof.includes('[ "${EVENT_BASE_SHA}" = "${MERGED_SHA}" ]'));
assert(proof.includes('.merged_by.type == "User"'));
assert(proof.includes("reviewer='tylan-scale-small'"));
assert(proof.includes('.state == "APPROVED"'));
assert(proof.includes('.state == "CHANGES_REQUESTED"'));
assert(proof.includes('.state == "DISMISSED"'));
assert(proof.includes('.commit_id == $head'));
assert(proof.includes('collaborators/${reviewer}/permission'));
assert(proof.includes('reviewed_head_tree_sha'));
assert(proof.includes('[ "${merged_tree_sha}" != "${reviewed_head_tree_sha}" ]'));
assert(proof.includes('event=workflow_dispatch&head_sha=${reviewed_head_sha}'));
assert(proof.includes('expected_gate_title="Validate Connect app [shared-${target_shared_sha}-${reviewed_head_sha}]"'));
assert(proof.includes('validate_workflow_id=289102321'));
assert(proof.includes('event=push&branch=main'));
assert(proof.includes('.name == "validate"'));
assert(proof.includes('.app.id == 15368'));
assert(proof.includes('.name == "Cloudflare Pages"'));
assert(proof.includes('.app.id == 85455'));
assert(proof.includes('https://connect.scalesmall.ai/build-identity.json'));
assert(proof.includes('.schema == "ssai.connect.build-identity.v1"'));
assert(proof.includes('.sha == $sha'));
assert(proof.includes('for _ in $(seq 1 300); do'));
assert(proof.includes('compare/${MERGED_SHA}...${main_sha}'));

assert(sourceReader.includes('/git/ref/heads/main'));
assert(sourceReader.includes('/contents/package.json?ref='));
assert(sourceReader.includes('contentsBytes.equals(rawBytes)'));
assert(sourceReader.includes('AbortSignal.timeout(HTTP_TIMEOUT_MS)'));
assert(sourceReader.includes('HTTP_ATTEMPTS = 3'));
assert(sourceReader.includes('MAX_RESPONSE_BYTES'));
assert(sourceReader.includes('sanitizePublicEnvironment'));
assert(!sourceReader.includes('Authorization'));
assert(classifier.includes("mode: noChange ? 'no_change' : 'update'"));
assert(classifier.includes('CANONICAL_SPEC_PATTERN'));
assert(classifier.includes('CANONICAL_RESOLVED_PATTERN'));
assert(reconstructor.includes("'--ignore-scripts'"));
assert(reconstructor.includes('sterileEnvironment'));
assert(reconstructor.includes('EXPECTED_CANONICAL_CANDIDATE_TREE_SHA'));
assert(reusedCandidate.includes('canonicalTreeSha'));
assert(exactPin.includes('EXPECTED_SHARED_SHA'));

assert(identityWriter.includes('CF_PAGES_COMMIT_SHA'));
assert(identityWriter.includes('GITHUB_SHA'));
assert(identityWriter.includes('VITE_SSAI_BUILD_SHA'));
assert(identityWriter.includes("['rev-parse', '--verify', 'HEAD^{commit}']"));
assert(identityWriter.includes("name !== 'GITHUB_SHA'"));
assert(identityWriter.includes('must match the checked-out git HEAD'));
assert(identityWriter.includes('ssai.connect.build-identity.v1'));
assert(identityWriter.includes('dist'));
assert(identityVerifier.includes('dist/build-identity.json'));
assert(identityVerifier.includes('Object.keys(identity)'));
assert(identityVerifier.includes("['rev-parse', '--verify', 'HEAD^{commit}']"));
assert(identityVerifier.includes("name !== 'GITHUB_SHA'"));
assert(identityVerifier.includes('must match the checked-out git HEAD'));

for (const statement of [
  '`SSAI_SHARED_PULL_SCHEDULE_ENABLED` remains absent or not `true`',
  'sends **no authentication header or credential** to Shared',
  'idempotent no-op',
  'Never rerun a historical workflow attempt',
  'Do not add a PAT, App key',
  'one approving human review',
  'cannot satisfy its own protected-branch approval',
  'approval-required',
  'normal human merge',
  'entirely read-only',
  'exact live build SHA',
  'one open PR per immutable Shared target',
  'checks out and executes no code',
]) {
  assert(runbook.includes(statement), `Runbook is missing required control: ${statement}`);
}

console.log('[shared-propagation-contract] Connect-owned public Shared pull is hardened');
