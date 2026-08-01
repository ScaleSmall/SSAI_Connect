import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { classifyConnectSharedPin } from '../scripts/classify-connect-shared-pin.mjs';
import {
  decodeContentsPayload,
  parseCommitPayload,
  parseLsRemote,
  parseRefPayload,
  readPublicSharedSource,
  sanitizePublicEnvironment,
  sha256,
  verifySharedEvidence,
} from '../scripts/read-public-shared-source.mjs';
import { validateReusedSharedCandidate } from '../scripts/validate-reused-shared-candidate.mjs';

const verifier = resolve('scripts/verify-shared-dependency-pin.mjs');
const sharedSha = '0123456789abcdef0123456789abcdef01234567';
const sharedTreeSha = '1111111111111111111111111111111111111111';
const sharedBlobSha = '2222222222222222222222222222222222222222';
const connectBaseSha = '3333333333333333333333333333333333333333';
const candidateSha = '4444444444444444444444444444444444444444';
const canonicalCandidateTreeSha = '5555555555555555555555555555555555555555';
const expectedSpecifier = `github:ScaleSmall/SSAI_Shared#${sharedSha}`;
const sharedPackageBytes = Buffer.from('{"name":"ssai-shared","version":"1.2.3","private":true}\n');

function connectFixture({
  dependency = expectedSpecifier,
  lockDependency = dependency,
  resolved = `git+ssh://git@github.com/ScaleSmall/SSAI_Shared.git#${sharedSha}`,
} = {}) {
  return {
    packageJson: { dependencies: { 'ssai-shared': dependency } },
    packageLock: {
      packages: {
        '': { dependencies: { 'ssai-shared': lockDependency } },
        'node_modules/ssai-shared': { resolved },
      },
    },
  };
}

function runVerifier({ dependency, lockDependency, resolved } = {}) {
  const fixture = connectFixture({ dependency, lockDependency, resolved });
  const fixtureDirectory = mkdtempSync(resolve(tmpdir(), 'ssai-shared-pin-'));
  try {
    writeFileSync(resolve(fixtureDirectory, 'package.json'), JSON.stringify(fixture.packageJson));
    writeFileSync(resolve(fixtureDirectory, 'package-lock.json'), JSON.stringify(fixture.packageLock));
    return spawnSync(process.execPath, [verifier], {
      cwd: fixtureDirectory,
      env: { ...process.env, EXPECTED_SHARED_SHA: sharedSha },
      encoding: 'utf8',
    });
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

function assertPostmergeProvenanceContract(workflow) {
  assert.match(workflow, /timeout-minutes: 70/);
  assert.match(workflow, /for _ in \$\(seq 1 300\); do/);
  assert.match(workflow, /reviewed_head_tree_sha="\$\(jq -er '\.tree\.sha'/);
  assert.match(workflow, /\[ "\$\{merged_tree_sha\}" != "\$\{reviewed_head_tree_sha\}" \]/);
  assert.match(workflow, /event=workflow_dispatch&head_sha=\$\{reviewed_head_sha\}/);
  assert.match(workflow, /\.actor\.login == "github-actions\[bot\]"/);
  assert.match(workflow, /\.triggering_actor\.login == "github-actions\[bot\]"/);
  assert.match(workflow, /expected_gate_title="Validate Connect app \[shared-\$\{target_shared_sha\}-\$\{reviewed_head_sha\}\]"/);
  assert.match(workflow, /reviewed_gate_run_id=/);
  assert.match(workflow, /\.name == "Cloudflare Pages"/);
  assert.match(workflow, /\.app\.id == 85455/);
  assert.match(workflow, /https:\/\/connect\.scalesmall\.ai\/build-identity\.json/);
}

function extractStepRunScript(workflow, stepName) {
  const normalized = workflow.replace(/\r\n?/g, '\n');
  const marker = `      - name: ${stepName}\n`;
  const markerIndex = normalized.indexOf(marker);
  assert(markerIndex >= 0, `workflow step is missing: ${stepName}`);
  const lines = normalized.slice(markerIndex + marker.length).split('\n');
  const runIndex = lines.findIndex(line => line === '        run: |');
  assert(runIndex >= 0, `workflow step has no literal run script: ${stepName}`);
  const body = [];
  for (const line of lines.slice(runIndex + 1)) {
    if (line.trim() && !line.startsWith('          ')) break;
    body.push(line.startsWith('          ') ? line.slice(10) : '');
  }
  return body.join('\n');
}

function runDispatchActorGuard({ actor, triggeringActor }) {
  const workflow = readFileSync('.github/workflows/validate.yml', 'utf8');
  const script = extractStepRunScript(
    workflow,
    'Bind explicit release dispatch to the repository Actions bot',
  );
  const bash = process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\bin\\bash.exe'
    : 'bash';
  return spawnSync(bash, ['-c', script], {
    env: {
      ...process.env,
      DISPATCH_ACTOR: actor,
      DISPATCH_TRIGGERING_ACTOR: triggeringActor,
      RELEASE_PROOF_ID: `shared-${sharedSha}-${candidateSha}`,
    },
    encoding: 'utf8',
  });
}

function assertReuseBindingContract(workflow) {
  const canonicalStep = workflow.indexOf('Derive the canonical candidate tree from trusted Connect main');
  const reuseStep = workflow.indexOf('validate-reused-shared-candidate.mjs');
  assert(canonicalStep >= 0, 'canonical trusted-main candidate derivation is missing');
  assert(reuseStep > canonicalStep, 'reused candidates must be validated only after canonical derivation');
  assert.match(workflow, /canonical_candidate_tree_sha: \$\{\{ steps\.canonical\.outputs\.tested_tree_sha \}\}/);
  assert.match(workflow, /--arg canonicalTreeSha "\$\{CANONICAL_CANDIDATE_TREE_SHA\}"/);
  assert.match(workflow, /\.tree\.sha == \$tree/);
  assert.match(workflow, /\[ "\$\{TESTED_TREE_SHA\}" = "\$\{CANONICAL_CANDIDATE_TREE_SHA\}" \]/);
}

function assertBranchGateRecoveryContract(workflow) {
  const branchGate = workflow.split(/\r?\n  branch-gate:\r?\n/)[1];
  const openReview = workflow
    .split(/\r?\n  open-review:\r?\n/)[1]
    ?.split(/\r?\n  branch-gate:\r?\n/)[0];
  assert(branchGate, 'branch gate job is missing');
  assert(openReview, 'post-gate PR writer job is missing');
  assert.match(branchGate, /timeout-minutes: 45/);
  assert.match(branchGate, /for _ in \$\(seq 1 60\); do/);
  assert.match(branchGate, /for _ in \$\(seq 1 210\); do/);
  assert.match(branchGate, /correlation="shared-\$\{SHARED_SHA\}-\$\{CANDIDATE_SHA\}"/);
  assert.doesNotMatch(branchGate, /correlation=.*GITHUB_RUN_ID/);
  assert.match(branchGate, /needs: \[discover, gate, publish\]/);
  assert.match(branchGate, /actions: write\r?\n      contents: read\r?\n      pull-requests: read/);
  assert.match(branchGate, /inventory_gate\(\) \{/);
  assert.match(branchGate, /\[ "\$\{count\}" -gt 1 \]/);
  assert.match(branchGate, /if \[ -z "\$\{run_id\}" \]; then/);
  assert.match(branchGate, /immutable failures are not rerun/);
  assert.doesNotMatch(branchGate, /actions\/runs\/\$\{run_id\}\/rerun/);
  assert.match(branchGate, /\.run_attempt == 1/);
  assert.match(branchGate, /validate_candidate_boundary/);
  assert.match(branchGate, /assert_no_open_review\(\) \{/);
  assert.match(branchGate, /assert_no_open_review before-gate/);
  assert.match(branchGate, /assert_no_open_review after-gate/);
  assert.equal((branchGate.match(/assert_no_open_review/g) ?? []).length, 3);
  assert.match(branchGate, /branch_gate_run_id=%s/);
  assert.doesNotMatch(branchGate, /PR_NUMBER|pull-requests: write|markPullRequestReadyForReview/);
  assert.doesNotMatch(workflow, /markPullRequestReadyForReview/);
  assert.match(openReview, /needs: \[discover, gate, publish, branch-gate\]/);
  assert.match(openReview, /needs\.discover\.outputs\.mode == 'pending_review'/);
  assert.match(
    openReview,
    /CANDIDATE_SHA: \$\{\{ needs\.discover\.outputs\.review_candidate_sha \|\| needs\.branch-gate\.outputs\.candidate_sha \}\}/,
  );
  assert.match(
    openReview,
    /BRANCH_GATE_RUN_ID: \$\{\{ needs\.discover\.outputs\.review_branch_gate_run_id \|\| needs\.branch-gate\.outputs\.branch_gate_run_id \}\}/,
  );
  assert.match(openReview, /actions: read\r?\n      contents: read\r?\n      pull-requests: write/);
  assert.match(openReview, /event == "workflow_dispatch"/);
  assert.match(openReview, /\.actor\.login == "github-actions\[bot\]"/);
  assert.match(openReview, /\.triggering_actor\.login == "github-actions\[bot\]"/);
  assert.match(openReview, /status == "completed"/);
  assert.match(openReview, /conclusion == "success"/);
  assert.match(openReview, /draft: false/);
  assert.match(openReview, /\.draft == false/);
  const eligibilityPreflight = openReview.indexOf(
    '"repos/${GITHUB_REPOSITORY}/collaborators/${reviewer}/permission"',
  );
  const pullCreation = openReview.indexOf('gh api --method POST "repos/${GITHUB_REPOSITORY}/pulls"');
  assert(eligibilityPreflight >= 0, 'reviewer eligibility preflight is missing');
  assert(pullCreation > eligibilityPreflight, 'reviewer eligibility must be verified before PR creation');
  assert.equal(
    (openReview.match(/pulls\/\$\{pull_number\}\/requested_reviewers/g) ?? []).length,
    3,
    'the single writer must inspect, conditionally repair, then independently verify the requested reviewer',
  );
  assert.match(openReview, /pulls\/\$\{pull_number\}\/reviews\?per_page=100/);
  assert.match(openReview, /\.commit_id == \$head/);
  assert.match(openReview, /\.user\.type == "User"/);
  assert.match(openReview, /\.user\.login == \$reviewer/);
  assert.match(openReview, /\.state == "APPROVED"/);
  assert.match(openReview, /\.state == "CHANGES_REQUESTED"/);
  assert.match(openReview, /\.state == "DISMISSED"/);
  assert.match(openReview, /sort_by\(\[\.submitted_at \/\/ "", \.id\]\)/);
  assert.match(openReview, /if \[ "\$\{latest_decisive_state\}" = 'APPROVED' \]; then/);
  assert.match(openReview, /requested_reviewers_before="\$\(gh api/);
  assert.match(openReview, /if ! jq -e --arg reviewer "\$\{reviewer\}"/);
  assert.match(
    openReview,
    /requested_reviewers_after="\$\(gh api \\\r?\n\s+"repos\/\$\{GITHUB_REPOSITORY\}\/pulls\/\$\{pull_number\}\/requested_reviewers"\)"/,
  );
  assert.match(openReview, /\[\.users\[\]\? \|/);
  assert.match(openReview, /event=pull_request&head_sha=\$\{CANDIDATE_SHA\}/);
  assert(
    branchGate.indexOf('gate_succeeded=1') < branchGate.indexOf('branch_gate_run_id=%s'),
    'the successful exact gate must be exported only after terminal success',
  );
}

function assertPostmergeHumanReviewContract(workflow) {
  for (const control of [
    'SSAI_CONNECT_PROTECTED_MAIN_RULESET_ID',
    '.current_user_can_bypass == "never"',
    'count_type("pull_request") == 1',
    '.required_approving_review_count >= 1',
    '.dismiss_stale_reviews_on_push == true',
    '.require_last_push_approval == true',
    '{context:"Cloudflare Pages", integration_id:85455}',
    '{context:"validate", integration_id:15368}',
    '.merged_by.type == "User"',
    "reviewer='tylan-scale-small'",
    '.state == "APPROVED"',
    '.commit_id == $head',
    '.user.type == "User"',
    '.state == "CHANGES_REQUESTED"',
    '.state == "DISMISSED"',
    'sort_by(.submitted_at // "", .id)',
    'collaborators/${reviewer}/permission',
    '.permission == "write"',
  ]) {
    assert(workflow.includes(control), `post-merge human/ruleset proof is missing ${control}`);
  }
}

function latestExactHeadApprovals(reviews, { head, author }) {
  const decisiveStates = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);
  const latestByReviewer = new Map();
  for (const review of reviews) {
    if (
      review.commit_id !== head
      || review.user?.type !== 'User'
      || typeof review.user?.login !== 'string'
      || review.user.login.length === 0
      || review.user.login === author
      || !decisiveStates.has(review.state)
    ) {
      continue;
    }
    const previous = latestByReviewer.get(review.user.login);
    const chronology = [review.submitted_at ?? '', Number(review.id)];
    const previousChronology = previous
      ? [previous.submitted_at ?? '', Number(previous.id)]
      : null;
    if (
      !previous
      || chronology[0] > previousChronology[0]
      || (chronology[0] === previousChronology[0] && chronology[1] > previousChronology[1])
    ) {
      latestByReviewer.set(review.user.login, review);
    }
  }
  return [...latestByReviewer.values()].filter(review => review.state === 'APPROVED');
}

function planPendingReviewerRepair(reviews, requestedReviewers, { head, reviewer }) {
  const decisiveStates = new Set(['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED']);
  const latest = reviews
    .filter(review => (
      review.commit_id === head
      && review.user?.type === 'User'
      && review.user.login === reviewer
      && decisiveStates.has(review.state)
    ))
    .sort((left, right) => {
      const leftKey = [left.submitted_at ?? '', Number(left.id)];
      const rightKey = [right.submitted_at ?? '', Number(right.id)];
      return leftKey[0].localeCompare(rightKey[0]) || leftKey[1] - rightKey[1];
    })
    .at(-1);
  if (latest?.state === 'APPROVED') {
    return { postRequest: false, verifyRequested: false, state: 'APPROVED' };
  }
  const alreadyRequested = requestedReviewers.some(user => (
    user?.type === 'User' && user.login === reviewer
  ));
  return {
    postRequest: !alreadyRequested,
    verifyRequested: true,
    state: latest?.state ?? '',
  };
}

function reusedCandidateFixture({ kind = 'pending_pr' } = {}) {
  const expectedFiles = [{ filename: 'package-lock.json' }, { filename: 'package.json' }];
  return {
    kind,
    branch: `automation/ssai-shared-${sharedSha}-${connectBaseSha}`,
    branchSha: candidateSha,
    parentSha: connectBaseSha,
    targetSharedSha: sharedSha,
    canonicalTreeSha: canonicalCandidateTreeSha,
    commit: {
      sha: candidateSha,
      parents: [{ sha: connectBaseSha }],
      tree: { sha: canonicalCandidateTreeSha },
    },
    comparison: {
      status: 'ahead',
      ahead_by: 1,
      behind_by: 0,
      commits: [{ sha: candidateSha }],
      files: expectedFiles.map(file => ({ ...file })),
    },
    pullFiles: kind === 'pending_pr' ? expectedFiles.map(file => ({ ...file })) : null,
  };
}

test('parses only an exact single Shared main Git ref', () => {
  assert.equal(parseLsRemote(`${sharedSha}\trefs/heads/main\n`), sharedSha);
  assert.throws(() => parseLsRemote(`${sharedSha}\trefs/heads/dev\n`), /exactly one immutable/);
  assert.throws(
    () => parseLsRemote(`${sharedSha}\trefs/heads/main\n${'f'.repeat(40)}\trefs/heads/main\n`),
    /exactly one immutable/,
  );
});

test('validates exact ref, commit, and package artifact evidence', () => {
  assert.equal(
    parseRefPayload(JSON.stringify({
      ref: 'refs/heads/main',
      object: { type: 'commit', sha: sharedSha },
    })),
    sharedSha,
  );
  assert.deepEqual(
    parseCommitPayload(JSON.stringify({
      sha: sharedSha,
      tree: { sha: sharedTreeSha },
      parents: [{ sha: '3'.repeat(40) }],
    }), sharedSha),
    { sha: sharedSha, treeSha: sharedTreeSha },
  );
  const contents = decodeContentsPayload(JSON.stringify({
    type: 'file',
    path: 'package.json',
    encoding: 'base64',
    sha: sharedBlobSha,
    content: sharedPackageBytes.toString('base64'),
  }), sharedSha);
  assert(contents.bytes.equals(sharedPackageBytes));
  assert.equal(contents.blobSha, sharedBlobSha);
});

test('requires independent package readers to agree byte-for-byte', () => {
  const evidence = verifySharedEvidence({
    gitSha: sharedSha,
    refSha: sharedSha,
    commit: { sha: sharedSha, treeSha: sharedTreeSha },
    contentsBytes: sharedPackageBytes,
    rawBytes: Buffer.from(sharedPackageBytes),
    packageBlobSha: sharedBlobSha,
  });
  assert.equal(evidence.packageJsonSha256, sha256(sharedPackageBytes));
  assert.equal(evidence.packageVersion, '1.2.3');
  assert.throws(
    () => verifySharedEvidence({
      gitSha: sharedSha,
      refSha: sharedSha,
      commit: { sha: sharedSha, treeSha: sharedTreeSha },
      contentsBytes: sharedPackageBytes,
      rawBytes: Buffer.from('{}'),
      packageBlobSha: sharedBlobSha,
    }),
    /disagree byte-for-byte/,
  );
});

test('reads Shared without forwarding any credential and with exact dual-reader agreement', async () => {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, headers: init.headers });
    if (url.endsWith('/git/ref/heads/main')) {
      return new Response(JSON.stringify({
        ref: 'refs/heads/main',
        object: { type: 'commit', sha: sharedSha },
      }));
    }
    if (url.endsWith(`/git/commits/${sharedSha}`)) {
      return new Response(JSON.stringify({
        sha: sharedSha,
        tree: { sha: sharedTreeSha },
        parents: [],
      }));
    }
    if (url.includes('/contents/package.json?ref=')) {
      return new Response(JSON.stringify({
        type: 'file',
        path: 'package.json',
        encoding: 'base64',
        sha: sharedBlobSha,
        content: sharedPackageBytes.toString('base64'),
      }));
    }
    return new Response(sharedPackageBytes);
  };
  const spawnImpl = (_command, _args, options) => {
    assert.equal(options.env.GH_TOKEN, undefined);
    assert.equal(options.env.GITHUB_TOKEN, undefined);
    return { status: 0, stdout: `${sharedSha}\trefs/heads/main\n`, stderr: '' };
  };

  const evidence = await readPublicSharedSource({
    fetchImpl,
    spawnImpl,
    sleepImpl: async () => {},
  });
  assert.equal(evidence.sha, sharedSha);
  assert.equal(evidence.packageJsonSha256, sha256(sharedPackageBytes));
  assert.equal(requests.length, 4);
  assert(requests.every(request => !Object.keys(request.headers).some(key => key.toLowerCase() === 'authorization')));
});

test('sanitizes credential-like environment variables from the public Git reader', () => {
  const env = sanitizePublicEnvironment({
    PATH: '/bin',
    GH_TOKEN: 'secret',
    GITHUB_TOKEN: 'secret',
    SOME_PRIVATE_KEY: 'secret',
    SAFE_VALUE: 'kept',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic secret',
    GIT_SSH_COMMAND: 'ssh -o ProxyCommand=hostile',
    SCALESMALL_PAT: 'legacy-secret',
  });
  assert.equal(env.GH_TOKEN, undefined);
  assert.equal(env.GITHUB_TOKEN, undefined);
  assert.equal(env.SOME_PRIVATE_KEY, undefined);
  assert.equal(env.SAFE_VALUE, undefined);
  assert.equal(env.GIT_CONFIG_COUNT, undefined);
  assert.equal(env.GIT_CONFIG_KEY_0, undefined);
  assert.equal(env.GIT_CONFIG_VALUE_0, undefined);
  assert.equal(env.GIT_SSH_COMMAND, undefined);
  assert.equal(env.SCALESMALL_PAT, undefined);
  assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
});

test('accepts only an exact canonical reused candidate tree', () => {
  const fixture = reusedCandidateFixture();
  assert.deepEqual(validateReusedSharedCandidate(fixture), {
    kind: fixture.kind,
    branch: fixture.branch,
    branchSha: fixture.branchSha,
    parentSha: fixture.parentSha,
    targetSharedSha: fixture.targetSharedSha,
    canonicalTreeSha: fixture.canonicalTreeSha,
  });
});

test('rejects a reused branch whose package scripts were tampered before discovery', () => {
  const fixture = reusedCandidateFixture({ kind: 'preexisting_ref' });
  fixture.commit.tree.sha = '6'.repeat(40);
  assert.throws(
    () => validateReusedSharedCandidate(fixture),
    /differs from trusted-main canonical reconstruction/,
  );
});

test('rejects a reused branch whose lockfile contains extra malicious edits', () => {
  const fixture = reusedCandidateFixture();
  fixture.commit.tree.sha = '7'.repeat(40);
  assert.throws(
    () => validateReusedSharedCandidate(fixture),
    /differs from trusted-main canonical reconstruction/,
  );
});

test('rejects an untrusted preexisting ref even when its filenames look correct', () => {
  const fixture = reusedCandidateFixture({ kind: 'preexisting_ref' });
  fixture.commit.parents[0].sha = '8'.repeat(40);
  assert.throws(
    () => validateReusedSharedCandidate(fixture),
    /parent differs from Connect base/,
  );
});

test('rejects a pending PR with a mutated binding or an extra file', () => {
  const wrongBranch = reusedCandidateFixture();
  wrongBranch.branch = `automation/ssai-shared-${sharedSha}-${'9'.repeat(40)}`;
  assert.throws(
    () => validateReusedSharedCandidate(wrongBranch),
    /does not encode the exact Shared target and Connect base/,
  );

  const extraFile = reusedCandidateFixture();
  extraFile.pullFiles.push({ filename: 'scripts/postinstall.mjs' });
  assert.throws(
    () => validateReusedSharedCandidate(extraFile),
    /Pending review changes unexpected files/,
  );
});

test('classifies an exact canonical pin as an idempotent no-op', () => {
  assert.deepEqual(
    classifyConnectSharedPin({ ...connectFixture(), targetSha: sharedSha }),
    { mode: 'no_change', currentSha: sharedSha, targetSha: sharedSha },
  );
});

test('classifies a canonical floating or stale pin for update', () => {
  const floating = connectFixture({
    dependency: 'github:ScaleSmall/SSAI_Shared',
    lockDependency: 'github:ScaleSmall/SSAI_Shared',
  });
  assert.equal(classifyConnectSharedPin({ ...floating, targetSha: sharedSha }).mode, 'update');

  const staleSha = 'f'.repeat(40);
  const stale = connectFixture({
    dependency: `github:ScaleSmall/SSAI_Shared#${staleSha}`,
    lockDependency: `github:ScaleSmall/SSAI_Shared#${staleSha}`,
    resolved: `git+https://github.com/ScaleSmall/SSAI_Shared.git#${staleSha}`,
  });
  assert.equal(classifyConnectSharedPin({ ...stale, targetSha: sharedSha }).mode, 'update');
});

test('rejects a noncanonical manifest, lock root, or artifact source', () => {
  assert.throws(
    () => classifyConnectSharedPin({
      ...connectFixture({ dependency: 'github:Other/SSAI_Shared' }),
      targetSha: sharedSha,
    }),
    /manifest must reference only canonical/,
  );
  assert.throws(
    () => classifyConnectSharedPin({
      ...connectFixture({ lockDependency: 'github:Other/SSAI_Shared' }),
      targetSha: sharedSha,
    }),
    /lock root must reference only canonical/,
  );
  assert.throws(
    () => classifyConnectSharedPin({
      ...connectFixture({ resolved: `git+https://github.com/Other/SSAI_Shared.git#${sharedSha}` }),
      targetSha: sharedSha,
    }),
    /lock artifact must resolve only canonical/,
  );
});

test('accepts a manifest and lockfile pinned to the exact Shared commit', () => {
  const result = runVerifier();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[shared-dependency-pin\] OK/);
});

test('rejects a floating Shared dependency in the exact-pin verifier', () => {
  const result = runVerifier({
    dependency: 'github:ScaleSmall/SSAI_Shared',
    lockDependency: 'github:ScaleSmall/SSAI_Shared',
  });
  assert.notEqual(result.status, 0);
});

test('rejects a lockfile resolved to another repository or commit', () => {
  const result = runVerifier({
    resolved: `git+ssh://git@github.com/ScaleSmall/SSAI_Shared-fork.git#${sharedSha}`,
  });
  assert.notEqual(result.status, 0);
});

test('fails closed when an open review was tested against a stale Connect base', () => {
  const workflow = readFileSync('.github/workflows/pull-shared-with-protected-evidence.yml', 'utf8');
  const staleGuard = workflow.indexOf('[ "${open_parent_sha}" != "${CONNECT_BASE_SHA}" ]');
  const pendingReview = workflow.indexOf("echo 'mode=pending_review'");
  assert(staleGuard >= 0, 'stale open-review base guard is missing');
  assert(pendingReview > staleGuard, 'pending-review suppression must occur only after the stale-base guard');
  assert.match(workflow, /Close the stale immutable review through the normal human workflow/);
});

test('binds every reused candidate to a trusted-main canonical reconstruction', () => {
  const workflow = readFileSync('.github/workflows/pull-shared-with-protected-evidence.yml', 'utf8');
  assertReuseBindingContract(workflow);
  assert.throws(
    () => assertReuseBindingContract(
      workflow.replace(
        '--arg canonicalTreeSha "${CANONICAL_CANDIDATE_TREE_SHA}"',
        '--arg canonicalTreeSha "${open_sha}"',
      ),
    ),
    /canonicalTreeSha/,
  );
  assert.throws(
    () => assertReuseBindingContract(
      workflow.replace(
        '[ "${TESTED_TREE_SHA}" = "${CANONICAL_CANDIDATE_TREE_SHA}" ]',
        '[ "${TESTED_TREE_SHA}" = "${TESTED_TREE_SHA}" ]',
      ),
    ),
    /TESTED_TREE_SHA/,
  );
});

test('recovers the exact deterministic branch gate before publishing a ready PR', () => {
  const workflow = readFileSync('.github/workflows/pull-shared-with-protected-evidence.yml', 'utf8');
  assertBranchGateRecoveryContract(workflow);
  for (const [control, weakened] of [
    ['deterministic correlation', workflow.replaceAll(
      'correlation="shared-${SHARED_SHA}-${CANDIDATE_SHA}"',
      'correlation="shared-${SHARED_SHA}-${CANDIDATE_SHA}-${GITHUB_RUN_ID}"',
    )],
    ['exact inventory', workflow.replace('inventory_gate() {', 'inventory_removed() {')],
    ['immutable no-rerun boundary', workflow.replace('immutable failures are not rerun', 'retry the failed run')],
    ['candidate boundary', workflow.replaceAll('validate_candidate_boundary', 'validate_candidate_removed')],
    ['pre-gate zero-PR boundary', workflow.replace('assert_no_open_review before-gate', 'true # pre-gate PR check removed')],
    ['post-gate zero-PR boundary', workflow.replace('assert_no_open_review after-gate', 'true # post-gate PR check removed')],
    ['read-only PR inventory', workflow.replace(
      /actions: write\r?\n      contents: read\r?\n      pull-requests: read/,
      'actions: write\n      contents: read\n      pull-requests: none',
    )],
    ['ready PR creation', workflow.replace('{title: $title, head: $head, base: $base, body: $body, draft: false}',
      '{title: $title, head: $head, base: $base, body: $body, draft: true}')],
    ['gate dependency', workflow.replace('needs: [discover, gate, publish, branch-gate]', 'needs: [discover, gate, publish]')],
    ['pending-review repair writer', workflow.replace(
      "needs.discover.outputs.mode == 'pending_review'",
      "needs.discover.outputs.mode == 'pending_review_disabled'",
    )],
    ['reviewer eligibility before PR creation', workflow.replace(
      'collaborators/${reviewer}/permission',
      'collaborators/${reviewer}/permission-after-pr',
    )],
    ['exact-head review binding', workflow.replace('.commit_id == $head', '.commit_id != $head')],
    ['latest decisive review ordering', workflow.replace(
      'sort_by([.submitted_at // "", .id])',
      'sort_by([.id]) | reverse',
    )],
    ['approved review no-request guard', workflow.replace(
      'if [ "${latest_decisive_state}" = \'APPROVED\' ]; then',
      'if [ "${latest_decisive_state}" = \'IGNORED\' ]; then',
    )],
    ['reviewer request verification', workflow.replace(
      'requested_reviewers_after="$(gh api',
      'requested_reviewers_after="$(printf',
    )],
    ['bounded job time', workflow.replace('timeout-minutes: 45', 'timeout-minutes: 40')],
    ['bounded gate polling', workflow.replace('for _ in $(seq 1 210); do', 'for _ in $(seq 1 400); do')],
  ]) {
    assert.throws(() => assertBranchGateRecoveryContract(weakened), control);
  }
});

test('does not re-request a reviewer whose latest decisive exact-head review is approved', () => {
  const reviewer = 'tylan-scale-small';
  const reviews = [
    {
      id: 10,
      commit_id: candidateSha,
      state: 'CHANGES_REQUESTED',
      submitted_at: '2026-08-01T10:00:00Z',
      user: { login: reviewer, type: 'User' },
    },
    {
      id: 11,
      commit_id: candidateSha,
      state: 'APPROVED',
      submitted_at: '2026-08-01T10:01:00Z',
      user: { login: reviewer, type: 'User' },
    },
  ];
  assert.deepEqual(
    planPendingReviewerRepair(reviews, [], { head: candidateSha, reviewer }),
    { postRequest: false, verifyRequested: false, state: 'APPROVED' },
  );
});

test('posts and verifies a missing reviewer request when exact-head approval is absent', () => {
  const reviewer = 'tylan-scale-small';
  const reviews = [{
    id: 12,
    commit_id: candidateSha,
    state: 'CHANGES_REQUESTED',
    submitted_at: '2026-08-01T10:02:00Z',
    user: { login: reviewer, type: 'User' },
  }];
  assert.deepEqual(
    planPendingReviewerRepair(reviews, [], { head: candidateSha, reviewer }),
    { postRequest: true, verifyRequested: true, state: 'CHANGES_REQUESTED' },
  );
  assert.deepEqual(
    planPendingReviewerRepair(reviews, [{ login: reviewer, type: 'User' }], {
      head: candidateSha,
      reviewer,
    }),
    { postRequest: false, verifyRequested: true, state: 'CHANGES_REQUESTED' },
  );
});

test('accepts an explicit full gate only when both actors are the repository Actions bot', () => {
  const result = runDispatchActorGuard({
    actor: 'github-actions[bot]',
    triggeringActor: 'github-actions[bot]',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('rejects a manually dispatched full gate from a human user', () => {
  const result = runDispatchActorGuard({
    actor: 'tylan-scale-small',
    triggeringActor: 'tylan-scale-small',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /actor must be github-actions\[bot\]/);
});

test('rejects a human-retriggered full gate even when the original actor was the Actions bot', () => {
  const result = runDispatchActorGuard({
    actor: 'github-actions[bot]',
    triggeringActor: 'tylan-scale-small',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /triggering actor must be github-actions\[bot\]/);
});

test('keeps the protected local Shared pull as the sole Actions-write workflow dispatcher', () => {
  const workflowDirectory = '.github/workflows';
  const workflows = readdirSync(workflowDirectory)
    .filter(name => /\.ya?ml$/i.test(name))
    .map(name => readFileSync(resolve(workflowDirectory, name), 'utf8').replace(/\r\n?/g, '\n'))
    .join('\n');
  assert.equal((workflows.match(/^\s+actions: write$/gm) ?? []).length, 1);
  assert.equal((workflows.match(/actions\/workflows\/[^\s"']+\/dispatches/g) ?? []).length, 1);
  const protectedPull = readFileSync(
    resolve(workflowDirectory, 'pull-shared-with-protected-evidence.yml'),
    'utf8',
  );
  assert.match(protectedPull, /actions: write/);
  assert.match(protectedPull, /actions\/workflows\/\$\{workflow_id\}\/dispatches/);
});

test('keeps the legacy workflow identity disabled in GitHub and inert in source', () => {
  const legacy = readFileSync('.github/workflows/update-shared.yml', 'utf8');
  assert.match(legacy, /^name: Retired legacy Shared package consumer\r?$/m);
  assert.match(legacy, /^on:\r?\n  workflow_dispatch:\r?$/m);
  assert.match(legacy, /^permissions: \{\}\r?$/m);
  assert.match(legacy, /^\s+if: \$\{\{ false \}\}\r?$/m);
  assert.doesNotMatch(legacy, /schedule:|actions: write|contents: write|pull-requests: write/);
  assert.doesNotMatch(legacy, /actions\/workflows\/|git push|force-with-lease/);
});

test('holds scheduled Shared polling dormant until controlled UAT enables it', () => {
  const workflow = readFileSync(
    '.github/workflows/pull-shared-with-protected-evidence.yml',
    'utf8',
  );
  assert.match(
    workflow,
    /github\.event_name == 'workflow_dispatch'\r?\n      \|\| vars\.SSAI_SHARED_PULL_SCHEDULE_ENABLED == 'true'/,
  );
});

test('binds post-merge production proof to the refreshed PR merge commit', () => {
  const workflow = readFileSync('.github/workflows/prove-shared-update-release.yml', 'utf8');
  assert.match(
    workflow,
    /MERGED_SHA: \$\{\{ github\.event\.pull_request\.merge_commit_sha \}\}/,
  );
  assert.doesNotMatch(workflow, /MERGED_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /\.merge_commit_sha == \$merged_sha/);
  assert.match(workflow, /\[ "\$\{EVENT_BASE_SHA\}" = "\$\{MERGED_SHA\}" \]/);
  assertPostmergeProvenanceContract(workflow);
  assertPostmergeHumanReviewContract(workflow);
});

test('rejects a post-merge proof that loses candidate-tree or exact branch-gate provenance', () => {
  const workflow = readFileSync('.github/workflows/prove-shared-update-release.yml', 'utf8');
  assert.throws(
    () => assertPostmergeProvenanceContract(
      workflow.replace(
        '[ "${merged_tree_sha}" != "${reviewed_head_tree_sha}" ]',
        '[ "${merged_tree_sha}" != "" ]',
      ),
    ),
    /merged_tree_sha/,
  );
  assert.throws(
    () => assertPostmergeProvenanceContract(
      workflow.replace(
        'event=workflow_dispatch&head_sha=${reviewed_head_sha}',
        'event=workflow_dispatch',
      ),
    ),
    /head_sha/,
  );
  assert.throws(
    () => assertPostmergeProvenanceContract(
      workflow.replace(
        '.actor.login == "github-actions[bot]"',
        '.actor.login == "tylan-scale-small"',
      ),
    ),
    /actor/,
  );
  assert.throws(
    () => assertPostmergeProvenanceContract(
      workflow.replace(
        '.triggering_actor.login == "github-actions[bot]"',
        '.triggering_actor.login == "tylan-scale-small"',
      ),
    ),
    /triggering_actor/,
  );
  assert.throws(
    () => assertPostmergeProvenanceContract(
      workflow.replace('timeout-minutes: 70', 'timeout-minutes: 40'),
    ),
    /timeout-minutes/,
  );
  assert.throws(
    () => assertPostmergeProvenanceContract(
      workflow.replace('for _ in $(seq 1 300); do', 'for _ in $(seq 1 210); do'),
    ),
    /seq 1 300/,
  );
});

test('rejects bot merges, missing or stale approvals, and weakened live protection evidence', () => {
  const workflow = readFileSync('.github/workflows/prove-shared-update-release.yml', 'utf8');
  for (const weakened of [
    workflow.replace('.merged_by.type == "User"', '.merged_by.type == "Bot"'),
    workflow.replaceAll('.state == "APPROVED"', '.state == "COMMENTED"'),
    workflow.replace('.commit_id == $head', '.commit_id != $head'),
    workflow.replaceAll('.state == "APPROVED"', '.state == "DISMISSED"'),
    workflow.replace('or .state == "CHANGES_REQUESTED"', 'or .state == "COMMENTED"'),
    workflow.replace('or .state == "DISMISSED"', 'or .state == "COMMENTED"'),
    workflow.replace(
      'sort_by(.submitted_at // "", .id)',
      'sort_by(.id)',
    ),
    workflow.replace('.required_approving_review_count >= 1', '.required_approving_review_count >= 0'),
    workflow.replace('.current_user_can_bypass == "never"', '.current_user_can_bypass == "always"'),
  ]) {
    assert.throws(() => assertPostmergeHumanReviewContract(weakened));
  }
});

test('treats a later dismissal or change request as a barrier to an older exact-head approval', () => {
  const head = candidateSha;
  const author = 'github-actions[bot]';
  const approval = {
    id: 1,
    commit_id: head,
    state: 'APPROVED',
    submitted_at: '2026-07-23T12:00:00Z',
    user: { login: 'eligible-human', type: 'User' },
  };
  for (const laterState of ['DISMISSED', 'CHANGES_REQUESTED']) {
    const laterReview = {
      ...approval,
      id: 2,
      state: laterState,
      submitted_at: '2026-07-23T12:01:00Z',
    };
    assert.deepEqual(
      latestExactHeadApprovals([approval, laterReview], { head, author }),
      [],
      `${laterState} must supersede the older approval`,
    );
  }

  const workflow = readFileSync('.github/workflows/prove-shared-update-release.yml', 'utf8');
  assertPostmergeHumanReviewContract(workflow);
  assert.throws(
    () => assertPostmergeHumanReviewContract(
      workflow.replace('or .state == "DISMISSED"', 'or .state == "COMMENTED"'),
    ),
    /DISMISSED/,
  );
  assert.throws(
    () => assertPostmergeHumanReviewContract(
      workflow.replace('or .state == "CHANGES_REQUESTED"', 'or .state == "COMMENTED"'),
    ),
    /CHANGES_REQUESTED/,
  );
});

test('requires the exact Metadata-visible active ruleset and effective main rules', () => {
  const workflow = readFileSync('.github/workflows/pull-shared-with-protected-evidence.yml', 'utf8');
  assert.match(workflow, /^  schedule:\r?\n    - cron: '23 \* \* \* \*'$/m);
  assert.doesNotMatch(workflow, /branchProtectionRules\(first: 100\)/);
  for (const control of [
    'SSAI_CONNECT_PROTECTED_MAIN_RULESET_ID',
    "expected_ruleset_name='SSAI Connect protected main'",
    'rules/branches/main?per_page=100',
    'count_type("deletion") == 1',
    'count_type("non_fast_forward") == 1',
    'count_type("required_linear_history") == 1',
    '(.required_approving_review_count >= 1)',
    '.dismiss_stale_reviews_on_push == true',
    '.require_last_push_approval == true',
    '.required_review_thread_resolution == true',
    '.strict_required_status_checks_policy == true',
    '{context:"Cloudflare Pages", integration_id:85455}',
    '{context:"validate", integration_id:15368}',
    '.current_user_can_bypass == "never"',
  ]) {
    assert(workflow.includes(control), `missing ruleset rollout control: ${control}`);
  }
});

test('explains disabled GITHUB_TOKEN PR creation and classifies the approval-required PR run', () => {
  const workflow = readFileSync('.github/workflows/pull-shared-with-protected-evidence.yml', 'utf8');
  assert.match(workflow, /GitHub Actions is not permitted to create or approve pull requests/);
  assert.match(workflow, /Settings > Actions > General must allow GitHub Actions to create and approve pull requests/);
  assert.match(workflow, /event=pull_request&head_sha=\$\{CANDIDATE_SHA\}/);
  assert.match(workflow, /completed:action_required\)/);
  assert.doesNotMatch(workflow, /^\s+action_required:\)$/m);
  assert.match(workflow, /is not release evidence/);
});
