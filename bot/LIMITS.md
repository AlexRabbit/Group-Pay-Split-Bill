# Telegram Bot API limits reference (Group Pay Split Bill)

## Message limits
| Limit | Value |
|-------|-------|
| Message text | 4096 chars |
| Caption | 1024 chars |
| Callback data | 64 bytes |
| Inline keyboard buttons per row | **2 max** (project policy) |
| Files via standard API | 50 MB upload |
| Files via Local Bot API | 2000 MB upload |

## Rate limits (bot-market.net guidance)
- **Minimum 5 seconds** between outbound actions (configured via `ACTION_DELAY_SECONDS`)
- Global FIFO queue — no request skipped, chronological per user
- Flood wait: bot backs off automatically via aiogram

## Local Bot API
Optional. Set `USE_LOCAL_BOT_API=true` and run [telegram-bot-api](https://github.com/tdlib/telegram-bot-api) locally.

## Auth
- Only `OWNER_USER_ID` + `/auth` whitelisted users
- `/unauth` removes access

## Persistence
- Queue survives restart via SQLite (`data/queue.db`)
- Sessions in `data/sessions.db`
- Logs in `data/bot.log`
