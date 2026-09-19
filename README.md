# TNGC Scoring

Independent scoring app for Trump National Golf Club Charlotte.

## V1 scope
- Up to 8 players / two groups
- Players entered per outing
- Handicap Index entered per player
- Player-specific tee selection / mixed tees
- Shared-link access; no player PINs
- Mobile-first scoring
- Cloudflare D1 shared scoring
- Hole 1 backward navigation locked until Hole 18 is visited, then circular navigation

## Current beta architecture
The frontend creates an outing through `/api/outings` and receives a short outing ID. The share URL includes `?outing=<id>`. Every phone using that link reads/writes the same D1-backed outing. Phones poll for score updates every 3 seconds while visible.

Browser localStorage remains only as a resilience fallback.

## Cloudflare beta setup
1. Create a Cloudflare Pages project named `tngc-scoring-beta`.
2. Create a D1 database named `tngc-scoring-beta`.
3. Bind it to the Pages project with variable name `DB`.
4. Apply `migrations/0001_init.sql`.
5. Deploy from Git or Wrangler. Pages Functions require Git/Wrangler deployment rather than dashboard Direct Upload.
6. Keep production separate: create a later `tngc-scoring` Pages project with its own D1 database and binding.

## Data isolation
Do not reuse Ballyhack environment variables, databases, URLs, or Cloudflare resources.

## Before production
- Verify current TNGC tee/rating/slope/course data against authoritative club/USGA data.
- Add the selected side games and settlement views.
- Add organizer-only controls if needed.
- Run multi-device concurrency and score-edit tests.


## Local validation status
The current build includes deterministic tests for:
- 8-player cap
- mixed tees and course handicap differentiation
- two-group scoring
- score editing
- incomplete-round handling
- Nassau Front 9 / Back 9 / Overall
- 40 Ball scoring
- settlement balancing
- shared-outing Cloudflare API contracts
- explicit Nassau team assignments
- organizer mode

## Remaining before deployment-ready beta
- Verify TNGC tee/rating/slope/hole handicap values against the current authoritative scorecard.
- Decide whether Nassau presses belong in TNGC V1 and, if yes, add the live press workflow.
- Add final mobile spacing/visual polish.
- Perform browser/device QA once deployed to Cloudflare.


## V1 feature freeze
TNGC Scoring V1 is intentionally limited to:
- Up to 8 players / two groups
- Six active men's tee choices: Black, Gold, Gold/Blue Hybrid, Blue, Blue/White Hybrid, White
- Manual player/index/tee/group setup
- No player PINs
- Nassau: Front 9 / Back 9 / Overall
- Explicit Nassau sides and manual presses
- 40 Ball
- Gross scorecard
- The Ledger / who-pays-who
- Organizer Mode

Do not add additional games before live beta validation.

## Final Cloudflare beta deployment checklist
1. Create a separate Cloudflare Pages project: `tngc-scoring-beta`.
2. Create a separate D1 database: `tngc-scoring-beta`.
3. Bind D1 to Pages as `DB`.
4. Apply `migrations/0001_init.sql`.
5. Deploy this exact package from Git or Wrangler so Pages Functions are active.
6. Open one shared outing on two phones.
7. Enter Group 1 and Group 2 scores simultaneously.
8. Confirm each phone receives the other group's scores without lost writes.
9. Test one score edit, one Nassau press, 40 Ball, and The Ledger.
10. Only after beta passes, create a separate production Pages project and separate production D1 database.

## Concurrency design
Score entry uses a granular PATCH request for each player/hole score. This prevents unrelated scores from two simultaneous phones from replacing one another through whole-outing last-write-wins updates. Setup/game configuration changes still use the full outing update path because those are organizer-controlled and infrequent.
