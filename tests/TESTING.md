# Group Pay — Testing Protocol (self-evolving)

## Run on every change

```bash
node tests/run-tests.js
```

## Coverage map

| ID | Area | Test location |
|----|------|---------------|
| U01 | Correctness, edges, cents math | `tests/run-tests.js` |
| U03 | Idempotency, backup roundtrip | `tests/run-tests.js` |
| U06 | XSS | `escapeHtml()` in `js/app.js` — manual: inject `<script>` in item name |
| U11 | Privacy | No server; data in URL/localStorage only |
| U30 | Regression | Add test per bug fix to `run-tests.js` |

## Manual mobile checklist

- [ ] Bill input on iOS/Android numeric keyboard
- [ ] Split checkbox tap targets ≥ 48px
- [ ] Sticky header shows bill after confirm
- [ ] Auto-split items appear on partner turn (read-only)
- [ ] Summary shows balanced / unbalanced correctly
- [ ] Share URL restores session
- [ ] Import/export JSON roundtrip
- [ ] Driver.js tour — manual via ? button only

## Bot tests (when `.env` configured)

```bash
cd bot && pip install -r requirements.txt && python -m py_compile bot.py
```

## APEX security gate (static site)

- No secrets in repo ✓
- No `innerHTML` with unsanitized user input ✓ (escapeHtml)
- CDN: driver.js from jsdelivr — pin version in index.html
- Fail closed on invalid import/backup

## Update rule

Every bug fix → add assertion in `tests/run-tests.js` before merge.
