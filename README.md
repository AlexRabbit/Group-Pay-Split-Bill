# Group Pay — Split the Bill

<p align="center">
  <strong>No math at the table.</strong><br>
  Mobile-first bill splitter · hacker terminal UI · zero backend
</p>

<p align="center">
  <a href="https://alexrabbit.github.io/Group-Pay-Split-Bill/">Live demo</a> ·
  <a href="https://github.com/AlexRabbit/Group-Pay-Split-Bill">GitHub</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/▶_start-run.bat-00ff41?style=for-the-badge&labelColor=050805" alt="Start with run.bat">
  <img src="https://img.shields.io/badge/mobile-first-yes-00ff41?style=flat-square&labelColor=050805" alt="Mobile first">
  <img src="https://img.shields.io/badge/backend-none-static-00ff41?style=flat-square&labelColor=050805" alt="Static">
  <img src="https://img.shields.io/badge/lang-EN_|_ES-00ff41?style=flat-square&labelColor=050805" alt="i18n">
</p>

---

## ▶ START HERE — Windows (double-click)

> **Before anything else:** double-click **`run.bat`** in the project folder.

```
Group-Pay-Split-Bill/
└── run.bat   ← double-click this
```

**What `run.bat` does:**

1. Checks if Node.js is installed
2. Runs the bill-split math tests automatically
3. Starts a local server at **http://localhost:8080**
4. Keeps the window open so you can see errors

If Node.js is missing, it opens `index.html` directly (some features need the local server).

**No install. No npm. No build step.** The web app is plain HTML/CSS/JS.

---

## The problem

The check lands. Everyone ordered different things. Someone shared the fish sticks. Now you're doing napkin math while the waiter stares.

**Group Pay** splits the bill in under two minutes on your phone — each person logs what they ate, shared items divide automatically, and the total reconciles against the receipt.

---

## 60-second walkthrough

```
 STEP 1   Enter bill total          $500.00   (stays pinned at top)
 STEP 2   Enter names                Alex, Carlos, Cesar, Manuel
 STEP 3   Each person adds items:
            Alex    lemonade           $45
                    cocktail          $130
                    fish sticks       $140  → split with Manuel
                    (shows $70)                 (Manuel gets $70 auto)
 STEP 4   Summary                    ✓ totals must match the bill
```

---

## Full tutorial

### Step 0 — Open the app

| Method | How |
|--------|-----|
| **Windows (recommended)** | Double-click **`run.bat`** |
| **Manual server** | `npx serve .` then open `http://localhost:3000` |
| **GitHub Pages** | Visit [alexrabbit.github.io/Group-Pay-Split-Bill](https://alexrabbit.github.io/Group-Pay-Split-Bill/) |

> **Tip:** Use a local server (`run.bat` or `npx serve`) so language files and QR load correctly. Opening `index.html` directly may block some features in certain browsers.

---

### Step 1 — Bill total

1. Type the **full amount** on the receipt (e.g. `500`)
2. Press **CONFIRM**
3. The total locks to the top bar and stays visible

---

### Step 2 — Who's splitting?

1. Enter names separated by commas: `Alex, Carlos, Cesar, Manuel`
2. Press **START SPLIT**

---

### Step 3 — One person at a time

For each diner:

1. Type **item name** + **price**
2. Press **ADD ITEM** ← required; the app won't let you skip this
3. Repeat for every dish they ordered
4. Press **NEXT PERSON** (or **VIEW RESULTS** on the last person)

**Validation rules:**

- You must tap **ADD ITEM** before advancing (unfinished fields block you)
- Each person needs **at least one item** with a price **above $0**
- Phone vibrates on errors (mobile)

**BACK** works on every step — fix bill total, names, or previous people's items anytime.

---

### Step 4 — Split shared food

Sharing fish sticks? Do this:

1. Enter the **full price** (`140`, not half)
2. Check **Split with** → select who shares (e.g. Manuel)
3. Tap **ADD ITEM**

| You see | They see (on their turn) |
|---------|--------------------------|
| `fish sticks` **$70** `[split]` | `fish sticks` **$70** `[auto-split]` |

The system divides cents fairly — no floating-point drift.

---

### Step 5 — Summary & reconcile

| Indicator | Meaning |
|-----------|---------|
| **Green ✓** | Assigned totals = bill total |
| **Amber ⚠** | Difference — review items or receipt |

**On the summary screen:**

| Action | What it does |
|--------|--------------|
| **Tap name** | Jump back to edit that person's items |
| **Tap amount** | Expand/collapse their full item list |
| **Copy Link** | Copy compressed session URL to clipboard |
| **Share** | Native mobile share (link + PDF when supported) |
| **Create a PDF** | Download itemized receipt-style PDF |
| **Show QR** | Display scannable session QR (green terminal style) |

The orange hint line explains: **TAP NAME TO EDIT · TAP AMOUNT TO SEE ITEMS**

---

## Features

| Feature | Details |
|---------|---------|
| **Hacker UI** | Dark mode, terminal green `#00ff41`, monospace fonts, scanlines |
| **Cent-precision math** | All amounts stored in cents — no `$0.01` drift |
| **Short session URLs** | Minified JSON + LZ-String compression (`#p=b:...`) |
| **`?lang=es`** | Spanish shareable links — language in URL |
| **PDF export** | Full breakdown with split tags + session QR |
| **QR code** | Scan to restore session at the table |
| **How to Use** | Context-aware guided tour (GUIDE button — never auto-runs) |
| **i18n** | English + Spanish (`i18n/en`, `i18n/es`) |
| **Offline-ready** | No server after load — pure static files |
| **Privacy** | Data stays in your browser / URL — nothing sent to us |

---

## Language

Use the **EN / ES** selector in the header. Choice is saved and added to shared links:

```
https://alexrabbit.github.io/Group-Pay-Split-Bill/?lang=es#p=b:...
```

To add a language: copy `i18n/en/strings.json` → `i18n/<code>/strings.json` and open a PR.

---

## Deploy to GitHub Pages

You host it — we don't deploy for you.

1. Push this repo to GitHub
2. **Settings → Pages**
3. **Source:** branch `main`, folder `/ (root)`
4. Live at: `https://<username>.github.io/Group-Pay-Split-Bill/`

Included: `.nojekyll` (Jekyll bypass) · auto base-path detection for `/Group-Pay-Split-Bill/`

**Never commit:** `.env`, tokens, `node_modules/`, `__pycache__/`, log files.

---

## Project structure

```
Group-Pay-Split-Bill/
├── run.bat                 ← ▶ DOUBLE-CLICK FIRST (Windows)
├── index.html              # App entry
├── .nojekyll               # GitHub Pages
├── .gitignore
├── css/
│   └── style.css           # Hacker terminal theme
├── js/
│   ├── split-engine.js     # Pure bill math (testable)
│   ├── url-state.js        # Compressed session URLs
│   ├── app.js              # UI flow + validation
│   ├── pdf.js              # PDF export
│   ├── qr.js               # QR generation
│   ├── tour.js             # Guided tour (Driver.js)
│   └── logger.js           # Client debug logs (localStorage)
├── i18n/
│   ├── en/strings.json
│   └── es/strings.json
└── tests/
    └── run-tests.js        # Run: node tests/run-tests.js
```

**17 files. Zero build step. Works on GitHub Pages.**

---

## Run tests manually

```bash
node tests/run-tests.js
```

`run.bat` runs this automatically before starting the server.

---

## Session URL format

Sessions are encoded in the URL hash — bookmark or share to restore:

```
https://yoursite/Group-Pay-Split-Bill/?lang=es#p=b:H4sI...
```

| Part | Meaning |
|------|---------|
| `?lang=es` | Spanish UI (omitted for English) |
| `#p=b:` | Compressed payload (LZ-String Base64) |
| Legacy `#s:` / `#d:` | Still supported |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Language not loading | Use `run.bat` or `npx serve .` — not `file://` |
| QR won't show | Hard-refresh (Ctrl+F5) — needs network for QR library CDN |
| PDF fails | Hard-refresh — jsPDF loads from CDN |
| Can't advance to next person | Tap **ADD ITEM** first; each person needs ≥1 item |
| Totals don't match bill | Amber warning — check prices or receipt total |
| Link too long | Normal for big groups — use **Show QR** instead |

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | Vanilla HTML/CSS/JS |
| Math | Custom cent-based engine |
| Compression | [LZ-String](https://github.com/pieroxy/lz-string) |
| Tour | [Driver.js](https://driverjs.com/) |
| PDF | [jsPDF](https://github.com/parallax/jsPDF) |
| QR | [qrcodejs](https://github.com/davidshimjs/qrcodejs) |
| Hosting | GitHub Pages (static) |

---

## Contributing

1. Fork the repo
2. `node tests/run-tests.js` — all tests must pass
3. Match the hacker terminal aesthetic
4. Add i18n strings for any new UI text (EN + ES)
5. Open a PR

---

## License

MIT — use freely, split fairly.

---

<p align="center">
  <code>Group Pay by <a href="https://github.com/AlexRabbit/Group-Pay-Split-Bill">AlexRabbit</a></code><br>
  <sub>no more napkin math</sub>
</p>
