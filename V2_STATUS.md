# TNGC Scoring V2 — Rebuild Status

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

Latest local artifact SHA-256:
26a0b50f6c72d8c394d8d7469612a0aec1efe748e28af931d7751a6fa5b3feb9

All current regression suites and release preflight pass.

Do not merge to main or connect this branch to production until isolated Cloudflare V2 beta acceptance testing is complete.
