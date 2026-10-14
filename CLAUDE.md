# Yoyo Travel — Claude Code Instructions

## Source of truth
Before implementing or changing the product, read `YOYO_TRAVEL_SPEC.md`. It is the primary product and acceptance specification.

## Working rules
- Work directly in this repository. Inspect existing files before changing anything; never delete unrelated work.
- Implement, run, test, and fix the app; do not stop at planning or mockups.
- Prioritize Core Beta in `YOYO_TRAVEL_SPEC.md` before Extended Beta.
- Keep the app usable when optional API keys are missing. Add/update `.env.example` and setup documentation.
- Never expose secrets in client code or claim an integration works until configured and tested.
- Never fabricate real places, prices, menus, images, rankings, reviews, URLs, citations, or test results.
- Respect provider APIs, licenses, attribution, privacy, and rate limits.
- Keep user data private and enforce server-side authorization/RLS.
- Use Thai for user-facing copy and final status reports unless the user requests otherwise.
- Run available type checks, lint, tests, and production build. Fix errors before finishing.
- Make reasonable decisions independently; ask only when blocked by an essential secret, irreversible action, or genuinely ambiguous requirement.

## Commands
The user may ask:
- `เริ่มทำ Yoyo Travel ตามสเปก` — implement Core Beta.
- `ทำต่อจากงานล่าสุดตามสเปก` — inspect current status and continue unfinished work.
- `ตรวจสอบโปรเจกต์ตาม Definition of Done` — run checks, test the main flows, fix defects, and report remaining gaps.
- `เพิ่มฟีเจอร์: <description>` — read the spec and current implementation, then implement the feature consistently.
- `ประหยัดค่า API และ Token` — inspect usage and architecture, reduce redundant context and API calls, and keep essential functionality.

## End-of-task report
In Thai, report:
1. What changed
2. How to run locally
3. Environment variables still needed
4. Features actually working
5. Features blocked by missing credentials
6. Build/test commands and real results
7. Known limitations and next priority

Do not repeat the entire spec in chat. Refer to the relevant section when useful.
