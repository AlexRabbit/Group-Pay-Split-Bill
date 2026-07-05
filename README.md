# Group Pay — Split the Bill

> **No math at the table.** A mobile-first bill splitter for dining with friends — each person logs what they ordered, shared items split automatically, totals reconcile against the receipt.

**Live demo:** [alexrabbit.github.io/Group-Pay-Split-Bill](https://alexrabbit.github.io/Group-Pay-Split-Bill/) *(deploy via GitHub Pages)*

![Theme: dark terminal green hacker aesthetic](https://img.shields.io/badge/theme-terminal%20green-00ff41?style=flat-square&logo=terminal&logoColor=black)
![Mobile first](https://img.shields.io/badge/mobile-first-yes?style=flat-square)
![No backend required](https://img.shields.io/badge/backend-none-static?style=flat-square)

---

## The problem

The check arrives. Everyone ordered different things. Someone shared the fish sticks. Now you're doing mental math on a napkin while the waiter waits.

**Group Pay** fixes that in under two minutes on your phone.

---

## How it works

```
1. Enter bill total     →  $500.00  (stays pinned at top)
2. Enter names          →  Alex, Carlos, Cesar, Manuel
3. Each person adds items:
      lemonade     $45
      cocktail    $130
      fish sticks $140  ← split with Manuel → Alex pays $70, Manuel gets $70 auto
4. Summary              →  Everyone's share must equal the bill total
```

### Split items (shared food)

1. Add the item with the **full price** (e.g. fish sticks **$140**)
2. Check who you're sharing with (e.g. **Manuel**)
3. Your list shows **$70** with a `split` badge
4. When it's Manuel's turn, **fish sticks $70** appears automatically as `auto-split`

---

## Features

| Feature | Description |
|---------|-------------|
| **Mobile-first** | Large tap targets, safe areas, numeric keyboards |
| **Hacker UI** | Dark mode, terminal green (`#00ff41`), monospace fonts |
| **Split logic** | Cent-precision math — no floating-point drift |
| **Reconciliation** | Green when assigned = bill; amber when something's off |
| **URL bookmark** | Whole session encoded in `#s=...` — bookmark to restore |
| **Import / Export** | JSON backup file, versioned format |
| **How to Use** | [Driver.js](https://driverjs.com/) tour — button only, never auto-runs |
| **i18n-ready** | Strings in `i18n/en/` — PR your language in a new folder |
| **Debug logs** | Client-side logger in `localStorage` (`js/logger.js`) |
| **Telegram bot** | Optional guided bot in `/bot` (self-hosted) |

---

## Quick start (local)

### Windows

Double-click **`run.bat`** — runs tests, starts a local server on port 8080.

### Any OS

```bash
# Run tests
node tests/run-tests.js

# Serve locally (any static server)
npx serve .
# open http://localhost:3000
```

Or open `index.html` directly (fetch for i18n may need a server).

---

## Deploy to GitHub Pages

1. Push this repo to GitHub
2. **Settings → Pages → Source:** Deploy from branch **`main`**, folder **`/` (root)**
3. Your URL: `https://<username>.github.io/Group-Pay-Split-Bill/`

The app auto-detects the `/Group-Pay-Split-Bill/` base path. A `.nojekyll` file is included.

> **Do not commit** `.env`, bot tokens, or `bot/data/`. They're in `.gitignore`.

---

## Project structure

```
Group-Pay-Split-Bill/
├── index.html          # App shell
├── css/style.css       # Hacker terminal theme
├── js/
│   ├── split-engine.js # Pure bill math (testable)
│   ├── app.js          # UI flow
│   ├── tour.js         # Driver.js guide
│   └── logger.js       # Debug logging
├── i18n/en/strings.json
├── tests/
│   ├── run-tests.js    # Unit tests
│   └── TESTING.md      # Test protocol
├── bot/                # Optional Telegram bot
│   ├── bot.py
│   ├── .env.example
│   └── LIMITS.md
├── run.bat
└── README.md
```

Minimal by design — no build step, no npm install for the web app.

---

## Telegram bot (optional)

Self-hosted companion bot with the same split flow.

```bash
cd bot
cp .env.example .env   # add TELEGRAM_BOT_TOKEN + OWNER_USER_ID
pip install -r requirements.txt
python bot.py
```

**Owner commands:** `/auth`, `/unauth`, `/users`, `/broadcast`, `/restartbot`  
**User flow:** `/split` → bill → names → items → summary  
**Rate limits:** 5s delay between actions, FIFO queue — see `bot/LIMITS.md`

For 24/7 on a VPS, use `group-pay-split-bot.service.example` with systemd.

---

## Backup format

```json
{
  "format": "group-pay-split-bill",
  "version": 1,
  "exportedAt": "2026-07-05T...",
  "data": { "billTotalCents": 50000, "payers": [...], "splits": [...] }
}
```

Backward-compatible via `version` field.

---

## Contributing

1. Fork the repo
2. Add tests in `tests/run-tests.js` for any logic change
3. For translations: copy `i18n/en/` → `i18n/<lang>/` and open a PR

---

## License

MIT — use freely, split fairly.

---

<p align="center"><code>GROUP_PAY v1 // no more napkin math</code></p>
