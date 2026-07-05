"""
Group Pay Split Bill — Telegram bot (guided bill splitter).
FIFO global queue, 5s action delay, owner-only admin commands.
Run: python bot.py  |  Requires .env from .env.example
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from aiogram import Bot, Dispatcher, F, Router
from aiogram.enums import ParseMode
from aiogram.filters import Command
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from dotenv import load_dotenv

load_dotenv()

# ── Config ──────────────────────────────────────────────────────────────────
TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
OWNER_ID = int(os.getenv("OWNER_USER_ID") or "0")
DELAY = max(5, int(os.getenv("ACTION_DELAY_SECONDS", "5")))
DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
WEB_URL = os.getenv("WEB_APP_URL", "https://alexrabbit.github.io/Group-Pay-Split-Bill/")
USE_LOCAL = os.getenv("USE_LOCAL_BOT_API", "false").lower() == "true"
LOCAL_URL = os.getenv("LOCAL_BOT_API_URL", "http://127.0.0.1:8081")
PREMIUM_ON = os.getenv("PREMIUM_EMOJI_ENABLED", "true").lower() == "true"

DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_PATH = DATA_DIR / "bot.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("gps-bot")

# ── Telegram limits (see bot/LIMITS.md) ─────────────────────────────────────
MAX_MSG = 4096
MAX_CALLBACK = 64
MAX_BUTTONS_ROW = 2

# ── DB helpers ──────────────────────────────────────────────────────────────
def db(path: Path) -> sqlite3.Connection:
    c = sqlite3.connect(path, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c

AUTH_DB = db(DATA_DIR / "auth.db")
SESS_DB = db(DATA_DIR / "sessions.db")
QUEUE_DB = db(DATA_DIR / "queue.db")

AUTH_DB.execute("CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY, username TEXT, added_at TEXT)")
AUTH_DB.execute("CREATE TABLE IF NOT EXISTS started (user_id INTEGER PRIMARY KEY, username TEXT, at TEXT)")
AUTH_DB.commit()

SESS_DB.execute("""
CREATE TABLE IF NOT EXISTS sessions (
  user_id INTEGER PRIMARY KEY,
  step TEXT,
  data TEXT,
  updated_at TEXT
)
""")
SESS_DB.commit()

QUEUE_DB.execute("""
CREATE TABLE IF NOT EXISTS queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT,
  payload TEXT,
  created_at REAL,
  done INTEGER DEFAULT 0
)
""")
QUEUE_DB.commit()

# ── Auth ────────────────────────────────────────────────────────────────────
def is_owner(uid: int) -> bool:
    return uid == OWNER_ID

def is_authorized(uid: int) -> bool:
    if is_owner(uid):
        return True
    row = AUTH_DB.execute("SELECT 1 FROM users WHERE user_id=?", (uid,)).fetchone()
    return row is not None

def auth_required(handler):
    async def wrap(event, *args, **kwargs):
        uid = event.from_user.id
        if not is_authorized(uid):
            msg = event if isinstance(event, Message) else event.message
            if msg:
                await enqueue_send(msg.chat.id, "⛔ Access denied. Ask the owner for /auth.")
            return
        return await handler(event, *args, **kwargs)
    return wrap

# ── Global FIFO queue ───────────────────────────────────────────────────────
_queue_lock = asyncio.Lock()
_last_send = 0.0

_bot: Bot | None = None


async def enqueue_send(chat_id: int, text: str, reply_markup=None, parse_mode=ParseMode.HTML):
    async with _queue_lock:
        global _last_send
        now = time.monotonic()
        wait = DELAY - (now - _last_send)
        if wait > 0:
            await asyncio.sleep(wait)
        if _bot is None:
            raise RuntimeError("Bot not initialized")
        await _bot.send_message(chat_id, text[:MAX_MSG], reply_markup=reply_markup, parse_mode=parse_mode)
        _last_send = time.monotonic()

def progress_bar(current: int, total: int, labels: list[str]) -> str:
    dots = []
    for i in range(total):
        if i < current:
            dots.append("●")
        elif i == current:
            dots.append("◉")
        else:
            dots.append("○")
    line = "─".join(dots)
    body = f"{current + 1}/{total}\n{line}\n\n"
    for i, lb in enumerate(labels):
        if i < current:
            body += f"🗹 {lb}\n"
        elif i == current:
            body += f"↪ {lb}\n"
        else:
            body += f"   {lb}\n"
    return body

# ── Split logic (mirrors js/split-engine.js) ────────────────────────────────
def to_cents(v: float) -> int:
    return round(float(v) * 100)

def divide(full: int, n: int) -> list[int]:
    base, rem = divmod(full, n)
    return [base + (1 if i < rem else 0) for i in range(n)]

def empty_session() -> dict:
    return {"bill": 0, "names": [], "payers": [], "splits": [], "idx": 0}

def get_session(uid: int) -> dict:
    row = SESS_DB.execute("SELECT data FROM sessions WHERE user_id=?", (uid,)).fetchone()
    if row:
        return json.loads(row["data"])
    return empty_session()

def save_session(uid: int, data: dict, step: str):
    SESS_DB.execute(
        "INSERT OR REPLACE INTO sessions (user_id, step, data, updated_at) VALUES (?,?,?,?)",
        (uid, step, json.dumps(data), datetime.now(timezone.utc).isoformat()),
    )
    SESS_DB.commit()

def payer_total(payer: dict) -> int:
    return sum(i.get("cents", 0) for i in payer.get("items", []))

# ── Router ──────────────────────────────────────────────────────────────────
router = Router()

CANCEL_KB = InlineKeyboardMarkup(inline_keyboard=[
    [InlineKeyboardButton(text="❌ Cancel", callback_data="cancel")]
])

@router.message(Command("start"))
async def cmd_start(msg: Message):
    AUTH_DB.execute(
        "INSERT OR IGNORE INTO started (user_id, username, at) VALUES (?,?,?)",
        (msg.from_user.id, msg.from_user.username or "", datetime.now(timezone.utc).isoformat()),
    )
    AUTH_DB.commit()
    if not is_authorized(msg.from_user.id):
        await enqueue_send(msg.chat.id, "👋 <b>Group Pay Bot</b>\n\nSplit bills with friends.\n⛔ You need owner authorization.")
        return
    save_session(msg.from_user.id, empty_session(), "idle")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🍽 New split", callback_data="new_split")],
        [InlineKeyboardButton(text="🌐 Open web app", url=WEB_URL)],
    ])
    await enqueue_send(
        msg.chat.id,
        "👋 <b>Group Pay Bot</b>\n\nGuided bill splitting — no math at the table.\n\nTap <b>New split</b> or use /split",
        reply_markup=kb,
    )

@router.message(Command("help"))
@auth_required
async def cmd_help(msg: Message):
    text = (
        "📖 <b>Commands</b> (A→Z)\n\n"
        "🆕 /cancel — abort current flow\n"
        "📤 /export — backup session JSON\n"
        "❓ /help — this list\n"
        "🍽 /split — start bill split\n"
        "🌐 Web: " + WEB_URL + "\n"
    )
    if is_owner(msg.from_user.id):
        text += (
            "\n<b>Owner only</b>\n"
            "🔑 /auth &lt;id|@user&gt;\n"
            "🚫 /unauth &lt;id&gt;\n"
            "👥 /users\n"
            "📢 /broadcast &lt;msg&gt;\n"
            "📢 /broadcastall &lt;msg&gt;\n"
            "🔄 /restartbot\n"
        )
    await enqueue_send(msg.chat.id, text)

@router.message(Command("split"))
@auth_required
async def cmd_split(msg: Message):
    save_session(msg.from_user.id, empty_session(), "bill")
    await enqueue_send(msg.chat.id, "💵 Enter the <b>total bill amount</b> (e.g. 500.00):", reply_markup=CANCEL_KB)

@router.message(Command("cancel"))
@auth_required
async def cmd_cancel(msg: Message):
    save_session(msg.from_user.id, empty_session(), "idle")
    await enqueue_send(msg.chat.id, "❌ Cancelled. /split to start again.")

@router.message(Command("export"))
@auth_required
async def cmd_export(msg: Message):
    data = get_session(msg.from_user.id)
    payload = json.dumps({"format": "group-pay-split-bill", "data": data}, indent=2)
    path = DATA_DIR / f"export_{msg.from_user.id}.json"
    path.write_text(payload, encoding="utf-8")
    await msg.answer_document(path.open("rb"), caption="📤 Session backup")

# Owner commands
@router.message(Command("auth"))
async def cmd_auth(msg: Message):
    if not is_owner(msg.from_user.id):
        return
    parts = (msg.text or "").split(maxsplit=1)
    if len(parts) < 2:
        await enqueue_send(msg.chat.id, "Usage: /auth &lt;user_id&gt; or /auth @username")
        return
    target = parts[1].strip().lstrip("@")
    try:
        uid = int(target)
    except ValueError:
        await enqueue_send(msg.chat.id, "Use numeric user_id for now.")
        return
    AUTH_DB.execute("INSERT OR REPLACE INTO users (user_id, username, added_at) VALUES (?,?,?)",
                    (uid, target, datetime.now(timezone.utc).isoformat()))
    AUTH_DB.commit()
    await enqueue_send(msg.chat.id, f"✅ Authorized user {uid}")

@router.message(Command("unauth"))
async def cmd_unauth(msg: Message):
    if not is_owner(msg.from_user.id):
        return
    parts = (msg.text or "").split(maxsplit=1)
    if len(parts) < 2:
        return
    uid = int(parts[1])
    AUTH_DB.execute("DELETE FROM users WHERE user_id=?", (uid,))
    AUTH_DB.commit()
    await enqueue_send(msg.chat.id, f"🚫 Removed {uid}")

@router.message(Command("users"))
async def cmd_users(msg: Message):
    if not is_owner(msg.from_user.id):
        return
    rows = AUTH_DB.execute("SELECT user_id, username FROM users").fetchall()
    if not rows:
        await enqueue_send(msg.chat.id, "No authorized users.")
        return
    lines = [f"• {r['user_id']} @{r['username']}" for r in rows]
    await enqueue_send(msg.chat.id, "👥 <b>Authorized</b>\n" + "\n".join(lines))

@router.message(Command("restartbot"))
async def cmd_restart(msg: Message):
    if not is_owner(msg.from_user.id):
        return
    await enqueue_send(msg.chat.id, "🔄 Restarting…")
    os._exit(0)

@router.callback_query(F.data == "cancel")
async def cb_cancel(cq: CallbackQuery):
    save_session(cq.from_user.id, empty_session(), "idle")
    await cq.answer("Cancelled")
    await enqueue_send(cq.message.chat.id, "❌ Flow cancelled.")

@router.callback_query(F.data == "new_split")
async def cb_new(cq: CallbackQuery):
    if not is_authorized(cq.from_user.id):
        await cq.answer("Not authorized", show_alert=True)
        return
    await cq.answer()
    save_session(cq.from_user.id, empty_session(), "bill")
    await enqueue_send(cq.message.chat.id, "💵 Enter the <b>total bill amount</b>:", reply_markup=CANCEL_KB)

@router.message(F.text)
@auth_required
async def on_text(msg: Message):
    uid = msg.from_user.id
    row = SESS_DB.execute("SELECT step FROM sessions WHERE user_id=?", (uid,)).fetchone()
    step = row["step"] if row else "idle"
    data = get_session(uid)
    text = (msg.text or "").strip()

    if step == "bill":
        try:
            cents = to_cents(float(text.replace(",", "")))
            if cents <= 0:
                raise ValueError
        except ValueError:
            await enqueue_send(msg.chat.id, "⚠ Invalid amount. Try again:", reply_markup=CANCEL_KB)
            return
        data["bill"] = cents
        save_session(uid, data, "names")
        await enqueue_send(msg.chat.id, "👥 Enter payer names separated by commas:\n<i>Alex, Carlos, Manuel</i>", reply_markup=CANCEL_KB)
        return

    if step == "names":
        names = [n.strip() for n in text.replace(";", ",").split(",") if n.strip()]
        if not names:
            await enqueue_send(msg.chat.id, "⚠ Add at least one name:", reply_markup=CANCEL_KB)
            return
        data["names"] = names
        data["payers"] = [{"id": f"p{i}", "name": n, "items": []} for i, n in enumerate(names)]
        data["idx"] = 0
        save_session(uid, data, "items")
        await show_payer_prompt(msg.chat.id, uid, data)
        return

    if step == "items":
        await handle_item_input(msg, data)
        return

async def show_payer_prompt(chat_id: int, uid: int, data: dict):
    idx = data["idx"]
    payer = data["payers"][idx]
    total = payer_total(payer)
    labels = [p["name"] for p in data["payers"]]
    bar = progress_bar(idx, len(data["payers"]), labels)
    others = [p for i, p in enumerate(data["payers"]) if i != idx]
    split_hint = ""
    if others:
        split_hint = "\n\nTo <b>split</b> an item: <code>fish sticks | 140 split Manuel</code>"
    await enqueue_send(
        chat_id,
        f"{bar}\n🧾 <b>{payer['name']}</b> — ${total/100:.2f}\n\n"
        f"Add item: <code>name | price</code>{split_hint}",
        reply_markup=CANCEL_KB,
    )

async def handle_item_input(msg: Message, data: dict):
    uid = msg.from_user.id
    text = msg.text.strip()
    idx = data["idx"]
    payer = data["payers"][idx]

    if "|" not in text:
        await enqueue_send(msg.chat.id, "Format: <code>lemonade | 45</code>", reply_markup=CANCEL_KB)
        return

    left, right = text.split("|", 1)
    name = left.strip()
    rest = right.strip()
    split_names: list[str] = []
    if " split " in rest.lower():
        price_part, split_part = rest.lower().split(" split ", 1)
        split_names = [s.strip() for s in split_part.split(",") if s.strip()]
        rest = price_part

    try:
        cents = to_cents(float(rest.replace(",", "")))
    except ValueError:
        await enqueue_send(msg.chat.id, "⚠ Invalid price.", reply_markup=CANCEL_KB)
        return

    if split_names:
        id_map = {p["name"].lower(): p["id"] for p in data["payers"]}
        partners = []
        for sn in split_names:
            pid = id_map.get(sn.lower())
            if pid and pid != payer["id"]:
                partners.append(pid)
        if partners:
            participants = [payer["id"]] + partners
            shares = divide(cents, len(participants))
            sid = f"split_{time.time_ns()}"
            payer["items"].append({"name": name, "cents": shares[0], "splitId": sid, "autoAdded": False})
            for i, pid in enumerate(participants[1:], 1):
                for p in data["payers"]:
                    if p["id"] == pid:
                        p["items"].append({"name": name, "cents": shares[i], "splitId": sid, "autoAdded": True})
            data.setdefault("splits", []).append({"id": sid, "name": name, "fullCents": cents, "participants": participants})
        else:
            payer["items"].append({"name": name, "cents": cents})
    else:
        payer["items"].append({"name": name, "cents": cents})

    save_session(uid, data, "items")

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="➕ Add another", callback_data="add_more"),
            InlineKeyboardButton(text="➡️ Next person", callback_data="next_person"),
        ]
    ])
    await enqueue_send(msg.chat.id, f"✅ Added <b>{name}</b> ${cents/100:.2f}", reply_markup=kb)

@router.callback_query(F.data == "add_more")
async def cb_add_more(cq: CallbackQuery):
    await cq.answer()
    data = get_session(cq.from_user.id)
    await show_payer_prompt(cq.message.chat.id, cq.from_user.id, data)

@router.callback_query(F.data == "next_person")
async def cb_next(cq: CallbackQuery):
    await cq.answer()
    uid = cq.from_user.id
    data = get_session(uid)
    data["idx"] += 1
    if data["idx"] >= len(data["payers"]):
        await show_summary(cq.message.chat.id, data)
        save_session(uid, data, "done")
    else:
        save_session(uid, data, "items")
        await show_payer_prompt(cq.message.chat.id, uid, data)

async def show_summary(chat_id: int, data: dict):
    assigned = sum(payer_total(p) for p in data["payers"])
    bill = data["bill"]
    diff = bill - assigned
    lines = [f"• <b>{p['name']}</b>: ${payer_total(p)/100:.2f}" for p in data["payers"]]
    status = "✅ Balanced!" if diff == 0 else f"⚠ Diff: ${abs(diff)/100:.2f} ({'unassigned' if diff > 0 else 'over'})"
    await enqueue_send(
        chat_id,
        f"📊 <b>RECONCILE</b>\n\n{status}\n\n" + "\n".join(lines) +
        f"\n\nBill: ${bill/100:.2f} | Assigned: ${assigned/100:.2f}\n\n/split for new bill",
    )

async def main():
    global _bot
    if not TOKEN:
        log.error("Set TELEGRAM_BOT_TOKEN in .env")
        return
    if USE_LOCAL:
        from aiogram.client.session.aiohttp import AiohttpSession
        from aiogram.client.telegram import TelegramAPIServer
        session = AiohttpSession(api=TelegramAPIServer.from_base(LOCAL_URL))
        _bot = Bot(token=TOKEN, session=session)
    else:
        _bot = Bot(token=TOKEN)
    dp = Dispatcher()
    dp.include_router(router)
    log.info("Bot starting (delay=%ss)", DELAY)
    await dp.start_polling(_bot)

if __name__ == "__main__":
    asyncio.run(main())
