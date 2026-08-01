# Connect-owned Shared dependency pull

`ScaleSmall/SSAI_Connect` owns this consumer. It polls the public
`ScaleSmall/SSAI_Shared` repository and, only after immutable reconstruction and the complete
Connect validation gate, publishes a single-purpose review branch with the repository's ephemeral
`GITHUB_TOKEN`, explicitly dispatches `Validate Connect app` for that immutable branch, and
only after terminal success opens one exact ready pull request. Automation can prepare and
validate the review; it cannot approve or merge it.
The workflow permits exactly one open PR per immutable Shared target.

Legacy workflow identity `247016074` must remain `disabled_manually`. Its checked-in
`update-shared.yml` definition is intentionally inert. The distinct protected local-pull
workflow may be active for manual UAT, but its hourly job stays dormant while repository
variable `SSAI_SHARED_PULL_SCHEDULE_ENABLED` remains absent or not `true`. Merging the new
definition does not authorize scheduled polling.

## Trust and credential model

- Shared is public. The workflow sends **no authentication header or credential** to Shared.
- Shared main is read independently through sterile Git and the public GitHub REST ref API.
  Both readers must resolve the same lowercase 40-character commit.
- The exact commit API binds that commit to an immutable tree.
- `package.json` at that exact commit is read independently through GitHub Contents and raw
  exact-commit endpoints. The bytes and SHA-256 digest must agree.
- The installed `node_modules/ssai-shared/package.json` bytes must match that same digest.
- Connect reconstruction uses public HTTPS, sterile Git/npm configuration, bounded
  processes, and `--ignore-scripts`.
- Discovery and compatibility gating have only `contents: read`. Candidate files and code run
  only there, without write authority. After the full gate passes, the exact two tested files
  cross a bounded, digest-checked output boundary.
- The publisher has only `contents: write`; it performs no checkout, installs no runtime, and
  executes no candidate or repository code. Fixed inline Git data API calls create
  `automation/ssai-shared-<shared-sha>-<connect-base-sha>` as one single-parent commit. It
  never force-pushes or writes protected `main`.
- A separate pre-PR job has only `contents: read` and `actions: write`; it checks out and
  executes no code. It explicitly dispatches `Validate Connect app` on the exact automation
  branch/candidate SHA with a deterministic Shared/candidate correlation, waits for terminal
  green, and revalidates the canonical tree and current base. The gate accepts only the first
  immutable attempt and never reruns a terminal failure or creates a second correlated run.
  Its 45-minute job budget bounds dispatch discovery and the single-attempt terminal monitor.
  With read-only pull-request access, it also requires zero open
  PRs for the exact immutable branch immediately before gate dispatch or recovery and again
  after terminal success, closing the race between discovery and review publication.
- Only after that exact gate succeeds, an isolated job with `actions: read`, `contents: read`,
  and `pull-requests: write` independently inventories the same gate run and requires its
  exact workflow, branch, SHA, title, terminal-success state, and Actions-bot actor pair. It
  checks out and executes no code, creates or verifies exactly one **non-draft** open PR per
  immutable Shared target, and fails closed on branch, parent, base, head, file-set, pin, or
  gate drift. It never calls GraphQL or attempts a draft-to-ready mutation.
- The explicitly dispatched full gate fails closed unless both GitHub's immutable initiating
  actor and current triggering actor are `github-actions[bot]`. A manual human dispatch or a
  human re-run cannot become branch-gate release evidence. The post-merge proof independently
  requires the same actor pair on the exact correlated run.
- Discovery derives the canonical candidate tree from trusted current Connect main before
  it accepts any reused branch or PR. A reused ref must be exactly one single-parent commit
  with that tree and exactly the two dependency files. Matching filenames or pins alone never
  establish trust.
- Before source discovery or candidate work, a metadata-only REST preflight binds repository
  variable `SSAI_CONNECT_PROTECTED_MAIN_RULESET_ID` to ruleset `20183470`, named
  `SSAI Connect protected main`, in this exact repository and
  `refs/heads/main`. It then reads the effective branch rules and requires deletion and
  non-fast-forward rejection, linear history, stale-review dismissal, last-push approval,
  resolved review threads, at least one approval, and strict `validate` and `Cloudflare Pages`
  checks pinned to their exact GitHub App integration IDs. Missing
  API visibility, a different ruleset identity, or any weaker effective control fails closed.
  GitHub intentionally omits ruleset bypass actors from read-only responses, so the empty
  bypass list and `current_user_can_bypass=never` are independently verified when the ruleset
  is provisioned or changed; the workflow never receives Administration permission.
- Repository Settings > Actions > General must allow GitHub Actions to create and approve
  pull requests. The isolated job uses that setting only to create the exact PR and makes no
  review API call. If the setting is disabled, the job reports the exact recovery setting and
  fails closed. The repository token cannot satisfy its own protected-branch approval: a
  distinct person with write or admin access supplies the required one approving human review
  and a human merges it.
- A PR created by `GITHUB_TOKEN` starts one `pull_request` full-gate run in
  `action_required` state. The workflow records that run as expected but non-authoritative;
  an authorized human should approve it and require terminal green before merge. The
  separately dispatched, exact-SHA/correlation full gate remains the sole branch-gate release
  evidence.
- The normal human merge, not the repository-token branch/PR events, emits the protected-main
  push workflows. `prove-shared-update-release.yml` is entirely read-only, checks out and
  executes no repository code, requires a human merger and the latest decisive exact-head
  approval from a current write/maintain/admin human who is not the PR author, and monitors
  the exact merged SHA through the normal `validate` push run, the Cloudflare Pages check, and
  the live build identity at `connect.scalesmall.ai`. The approver may also perform the merge;
  this contract does not invent a two-maintainer requirement. Its 70-minute budget exceeds the
  five-minute push-run
  discovery bound plus the 50-minute completion-monitor bound, leaving explicit API/step
  overhead. Review chronology includes `APPROVED`, `CHANGES_REQUESTED`, and `DISMISSED`
  before selecting each reviewer's latest exact-head decision, so a later dismissal or change
  request can never resurrect an older approval.
- The hosted proof reads the fixed, nonsecret `build-identity.json` contract and waits for the
  exact merged SHA at `connect.scalesmall.ai`. A build-only success cannot substitute for hosted
  deployment evidence.
- No PAT, GitHub App credential, deploy key, stored cross-repository credential,
  `repository_dispatch`, Checks write, or deployment write is required.
  `pull-shared-with-protected-evidence.yml` is the sole workflow with Actions write and the
  sole workflow dispatcher; that grant is
  isolated to the fixed inline exact-branch full-gate dispatcher.
- Neither workflow may write protected `main`, mutate TikTok configuration, or deploy the live
  Connect service. The post-merge proof only reads the fixed hosted build-identity contract.

Shared currently has no published GitHub release or tag. Until Shared adopts a reviewed
signed/tagged release policy, the exact default-branch commit, exact tree, exact package blob,
and dual-reader package SHA-256 are its immutable release identity. A future tag or release
must not silently replace this contract.

## Schedule and replay behavior

The schedule polls once per hour at minute 23. This bounds the hosted workload to 24 cheap
discovery runs per day while keeping a one-hour propagation objective; there is no
documented need for a 15-minute SLO. `workflow_dispatch` exists only for a controlled
current-definition UAT. The fixed concurrency group never cancels an in-flight run.

If Connect already pins the exact Shared commit, discovery reports `mode=no_change`; no
write-capable job runs. This is a cheap idempotent no-op.

If one open review already exists for the same immutable Shared commit and its encoded source
base is still the exact current Connect main commit, discovery reconstructs the canonical
candidate tree from that trusted base and validates the remote commit's exact parent/tree,
exact two-file diff, PR file set, exact Shared manifest/lock pin, and exactly one completed
successful explicit gate with both actors bound to `github-actions[bot]`. Only a successful,
non-draft candidate reports `mode=pending_review`. A legacy draft cannot be transitioned by
the repository Actions token and fails closed with an explicit human recovery message.
Compatibility tests and publication skip, preventing an unattended review from generating
repeated heavy runs. If that open review encodes an older Connect base, discovery fails red
with both SHAs and requires the stale immutable review to be closed through the normal human
workflow. It must never report a stale review as green or reuse its old gate.

If branch publication succeeded but PR creation did not, a later run recognizes only the
exact branch whose name includes both the Shared SHA and the current Connect base SHA,
reports `mode=branch_ready`, inventories or dispatches the one deterministic exact gate, and
resumes PR publication only after that gate is terminal green. If the gate already succeeded
but PR creation or its response was interrupted, a fresh run reuses the gate and creates or
finds the same exact ready PR without duplication. Because the base is part of the branch key,
a later main commit does not turn every future poll red. Stale,
unassociated branches never block a new current-base branch, are never overwritten, and must
be retired through reviewed cleanup.

If Connect or Shared advances during reconstruction, publication, PR creation, or branch
gate dispatch, the exact-boundary comparison fails closed. The next fresh schedule evaluates
the new state using a new base-qualified branch name. Never rerun a historical workflow
attempt: a rerun executes its stored historical definition.

## Protected-main boundary

Connect ruleset `20183470` currently requires linear history and one approving review,
dismisses stale approvals, requires approval of the last push and resolved threads, rejects
force pushes and deletion, requires strict `validate` and `Cloudflare Pages` checks pinned to
GitHub App integrations `15368` and `85455`, and has an empty bypass
list. The rollout workflow verifies the exact ruleset identity and effective Metadata-visible
controls before any source read. Zero bypass is an independently reviewed provisioning
control because GitHub does not disclose bypass actors to a read-only workflow token. Those
are release requirements, not obstacles to remove.

The generated branch changes only `package.json` and `package-lock.json`. A PR created by the
  ephemeral repository token starts an approval-required `pull_request` validation run. The isolated
  Actions-write job also explicitly dispatches `Validate Connect app` on the exact immutable
head because the approval-required run cannot be used as unattended release evidence. The
workflow records both run IDs, but trusts only the uniquely correlated dispatch. That
dispatch finishes green before the ready PR exists. An authorized human approves the
automatic workflow run, requires it to finish green, and a write/maintain/admin human approves
the exact head before a human merge. The approver and merger may be the same person, but
neither can be the bot PR author. Do not enable a bypass, weaken review, allow force pushes,
or add a PAT/App/admin credential. Do not add a PAT, App key, or other persistent credential
as a shortcut.

The human merge causes ordinary `push` runs. The read-only post-merge proof takes its sole
release identity from `pull_request.merge_commit_sha`, requires the refreshed PR API and the
event base SHA to match it, binds the refreshed PR head and tree to the exact explicit
branch-gate correlation, requires a human merger plus the latest decisive exact-head eligible
human approval, requires the merge tree to equal the reviewed candidate tree, and then binds
  the PR file set, merged manifest/lock, current live ruleset/effective controls, the exact
  `validate` workflow ID, and the Cloudflare Pages App ID to that SHA. It fails unless the
  reviewed gate, merged-SHA validation, Cloudflare check, and hosted identity all reach terminal
  success and the merged commit remains in main history. GitHub does not expose
historical ruleset snapshots through this read-only event, so ruleset proof is explicitly
live-at-proof rather than a claim about hidden historical state; any current weakening fails
closed.

## Controlled release and retirement

1. Confirm legacy workflow identity `247016074` remains `disabled_manually`, has zero
   nonterminal runs, and its checked-in `update-shared.yml` definition is inert. Confirm live
   ruleset `20183470` is the one active repository ruleset named
   `SSAI Connect protected main` for `refs/heads/main`. Confirm its empty bypass list and
   effective one-approval, stale-review, last-push, resolved-thread, strict `validate` and
   `Cloudflare Pages`, linear-history, deletion, and non-fast-forward rules.
2. Merge the reviewed Connect-local branch publisher at
   `pull-shared-with-protected-evidence.yml` and the read-only post-merge proof while the
   legacy consumer remains disabled.
3. Confirm current main contains:
   - schedule/manual triggers only on the consumer;
   - no Shared dispatch event or stored credential;
   - independent public commit/package readers;
   - read-only reconstruction and complete compatibility gates;
   - one contents-only, checkout-free Git data branch publisher;
   - one checkout-free pre-PR Actions gate and one checkout-free ready-PR writer;
   - exact pending-review suppression;
   - a read-only human-merge proof for exact-SHA validation, Cloudflare deployment, and live identity.
4. Reconfirm zero nonterminal historical consumer runs.
5. Confirm `SSAI_SHARED_PULL_SCHEDULE_ENABLED` is absent or not `true`, then dispatch exactly
   one fresh current-main run of
   `pull-shared-with-protected-evidence.yml`. Do not enable or rerun legacy workflow
   `247016074`, and do not rerun an old attempt.
6. Require the run to finish green and retain Connect base, Shared commit/tree, package
   blob/SHA-256, tested tree, lock SHA-256, review branch, candidate commit, parent, and
   run-attempt evidence.
7. Confirm the workflow created or idempotently reused exactly one PR for the Shared target,
   that it changes only `package.json` and `package-lock.json`, pins the attested Shared SHA,
   and has the attested parent/tree. If creation fails with the GitHub Actions permission
   message, enable **Allow GitHub Actions to create and approve pull requests** under
   Repository Settings > Actions > General and start one fresh current-definition run.
8. Require the uniquely correlated exact-branch `Validate Connect app` run to finish green before
   the PR is published, then confirm the PR is created non-draft without any readiness
   mutation. A GITHUB_TOKEN-created PR also has one non-authoritative approval-required
   automatic gate; an authorized human approves that workflow and requires it to finish
   green. A person with
   write, maintain, or admin access then supplies the exact-head PR approval and a human
   merges; the same eligible human may do both. Read-only collaborator approvals do not
   satisfy the protected-main requirement.
9. Require `Prove Shared update release` to finish green. Retain the PR number, merged SHA,
   reviewed candidate/tree, target Shared SHA, exact branch-gate run, and exact merged-SHA
    Connect validation run and Cloudflare Pages check IDs. Confirm the merged tree equals the
    reviewed tree and the hosted identity observed the exact live build SHA.
10. Dispatch one second fresh manual UAT. It must report `mode=no_change`, create no branch or
    commit, and start no downstream work.
11. After both changed and unchanged witnesses pass, set
    `SSAI_SHARED_PULL_SCHEDULE_ENABLED=true`. Confirm the next hourly run performs the same
    current-definition discovery path; remove or set the variable away from `true` to pause
    scheduled polling without reactivating legacy workflow `247016074`.
12. Only after successful UAT and an empty-run drain, delete obsolete Connect/Shared
    propagation PAT or App secrets. Verify names are absent without printing, hashing, or
    decoding secret values.

## Failure interpretation

- Reader disagreement: source/API inconsistency; no publication.
- Package digest disagreement: artifact-integrity failure; no publication.
- Scripts-disabled install failure: dependency is not reconstructible; no publication.
- Full gate failure: candidate is incompatible; no publication.
- Existing review branch validation failure: branch collision or tampering; fail red.
- Existing PR validation failure: duplicate target, stale base, head drift, or file drift;
  fail red without merge. A stale open PR must be human-closed before a current-base
  candidate can proceed.
- Exact ruleset failure: ruleset identity or effective protection changed; restore the
  reviewed ruleset instead of granting the workflow Administration access.
- GitHub Actions PR permission failure: enable the repository's create/approve-PR workflow
  setting; do not substitute a PAT or App.
- Automatic PR gate is `action_required`: an authorized human approves the workflow; this
  run never substitutes for the exact correlated branch gate.
- Connect base changed or branch-create race lost: no overwrite; evaluate a fresh run.
- Shared changed at a later read: evidence is superseded; evaluate a fresh run.
- Exact branch gate or human review missing: do not merge.
- Exact branch gate has more than one deterministic match, its bounded same-run retry fails,
  or any PR appears before exact terminal gate success: fail closed and diagnose; never
  dispatch a replacement.
- Exact merged-SHA validation or Cloudflare Pages check red: release is not validated.
- Missing or stale hosted build identity: exact merged commit is not proven live.
- Missing push run: human-merge release evidence did not materialize; diagnose current state.

Every current failure must be diagnosed from a fresh current-definition run. Historical red
entries remain immutable evidence and must not be rerun or hidden.
