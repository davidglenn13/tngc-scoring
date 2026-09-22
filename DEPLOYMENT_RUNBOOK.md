# TNGC Scoring V2 Deployment Runbook

## V2 Beta
Use a V2-specific beta deployment and a V2-specific D1 database. Do not reuse the current TNGC beta database for the first V2 deployment.

Bindings:
- `DB` -> `tngc-scoring-v2-beta`
- `TNGC_ENV=beta`
- `TNGC_DB_NAME=tngc-scoring-v2-beta`

Apply migrations in this exact order:
1. `0002_v2_platform.sql`
2. `0003_ballyhack_game_parity.sql`
3. `0004_confirmation_recovery.sql`
4. `0005_release_hardening.sql`
5. `0006_game_config_parity.sql`
6. `0007_security_offline.sql`
7. `0008_live_round_guards.sql`

Run `node scripts/preflight.mjs` before deployment.

## Live two-phone acceptance
Create an 8-player mixed-tee outing; open it on two phones; enter different scores simultaneously; then edit the same score on both phones and confirm a visible conflict instead of silent overwrite. Test Nassau 5-5-5-1-1-1 with Press and Press the Press, Nassau 6-6-6, manual 40 Ball at exactly 40 selections per foursome, Ledger/chits, card confirmation/unlock, backup/reset/restore, offline score recovery, and scorer resume.

## Production
Only after every live-beta acceptance item passes. Production gets a separate D1 database and `TNGC_ENV=production`.
