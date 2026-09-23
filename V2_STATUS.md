# TNGC Scoring V2 — Rebuild Status

## Current pickup checkpoint — September 23, 2026

- Active branch: `v2-platform-rebuild`
- Release candidate: `beta4`
- Active beta: `https://tngc-scoring-v2-beta.pages.dev/?v=beta4`
- Deployment: GitHub Actions publishes this isolated branch after the V2 regression suite passes
- Setup navigation: Details → Players → Games → Review
- Mobile fix: step buttons are wired and the browser-compatible course module replaces the JSON import
- Environment: isolated V2 beta project and isolated `tngc-scoring-v2-beta` D1 database
- Database status at checkpoint: healthy and empty
- Trump National Charlotte visual theme applied without fabricating a club logo
- Setup boxes now read Step 1: Details through Step 4: Review
- Saved-golfer menu added to Step 2 using device-local history
- Nassau Format(s) copy, complete live match/press presentation, and Press the Press controls restored
- 40 Ball live tracker/results and counted-score controls restored
- Score / Games / Ledger tabs moved to the top and switch views
- Unique game sharing plus guest join-by-name added
- Shared-link guests are locked to their own foursome's individual scorecard

Continue only from this checkpoint. The September 19 checkout is archived and must not be used.

This branch is isolated from main and the current TNGC beta.

Current validated V2 checkpoint:
- Ballyhack-production Nassau 5-5-5-1-1-1 and 6-6-6 behavior
- Original Press and Press the Press logic
- Manual 40 Ball selection: exactly 40 net hole scores per foursome
- Combined zero-sum Ledger and chronological player chits
- Per-foursome Nassau configuration; 40 Ball is round-wide
- Scorecard confirm / organizer unlock correction workflow
- Backup, reset and restore safeguards
- Exact scorer resume and next-missing navigation
- Multi-device score conflict handling
- Organizer capability token: only SHA-256 hash stored server-side
- Atomic score revision compare-and-swap with deletion tombstones
- Durable local score outbox for offline / failed writes
- Explicit Keep Mine / Use Cloud conflict resolution
- Nassau eligibility requires exactly four golfers in that foursome
- 40 Ball eligibility requires two complete foursomes of four
- No fabricated TNGC logo asset

All current regression suites and release preflight pass.

Do not merge to main or connect this branch to production until isolated Cloudflare V2 beta acceptance testing is complete.
