If this helped you, consider starring the repo ⭐

# SPLIT BILL - Group Pay

<p align="center">
  <strong>No math at the table.</strong><br>
  Mobile-first bill splitter
</p>

<p align="center">
  <a href="https://alexrabbit.github.io/Group-Pay-Split-Bill/">▶USE IT</a> 
</p>

<img width="799" height="1290" alt="image" src="https://github.com/user-attachments/assets/f7c4d182-3f6f-4bba-a26f-9dfbddaf2499" />


---

## The problem

The check lands. Everyone ordered different things. Someone shared the fish sticks. Now you're doing napkin math while the waiter stares.

**Group Pay** splits the bill in under two minutes on your phone — each person logs what they ate, shared items divide automatically, and the total reconciles against the receipt.

---

## 60-second walkthrough

```
 STEP 1   Enter bill total          $500.00   (stays pinned at top)
 STEP 2   Enter names                Alex, Dakota, Carlos, Etc..
 STEP 3   Each person adds items:
            Alex    lemonade           $45
                    cocktail          $130
                    fish sticks       $140  → split with Manuel
                    (shows $70)                 (Manuel gets $70 auto)
 STEP 4   Summary                    ✓ totals must match the bill
```

---

## Full tutorial

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
4. Press **NEXT PERSON** (or **VIEW RESULTS**)

**Validation rules**

---

### Step 4 — Split shared food

Sharing fish sticks? Do this:

1. Enter the **full price** (not half)
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
| **Cent-precision math** | All amounts stored in cents — no `$0.01` drift |
| **PDF export** | Full breakdown with split tags + session QR |
| **QR code** | Scan to restore session at the table |
| **i18n** | English + Spanish (`i18n/en`, `i18n/es`) |
| **Offline-ready** | No server after load — pure static files |
| **Privacy** | Data stays in your browser / URL — nothing sent to us |

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

## License

MIT — use freely, split fairly.

---

<p align="center">
  <code>Group Pay by <a href="https://github.com/AlexRabbit/Group-Pay-Split-Bill">AlexRabbit</a></code><br>
  <sub>no more napkin math</sub>
</p>
