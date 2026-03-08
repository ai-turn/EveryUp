# Notification Channel Setup Guide

> Korean version: [NOTIFICATION_SETUP.ko.md](./NOTIFICATION_SETUP.ko.md)

EveryUp supports **Telegram** and **Discord** as notification channels. This guide walks you through obtaining the required credentials and configuring each channel.

---

## Telegram

### Step 1 — Create a Bot via BotFather

1. Open Telegram and search for **@BotFather** (look for the blue verified checkmark).
2. Send `/newbot` to start the bot creation wizard.
3. Enter a **display name** for your bot (e.g., `EveryUp Alerts`).
4. Enter a **username** — must be unique and end with `bot` (e.g., `everyup_alerts_bot`).
5. BotFather will respond with your **Bot Token**. Save it — you'll need it in EveryUp.

> **Example Token:** `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`

---

### Step 2 — Get the Chat ID

The Chat ID tells EveryUp where to deliver messages. It works for private chats, groups, and channels.

#### Private Chat (1:1 with your bot)

1. Find your bot in Telegram and send it any message (e.g., `/start`).
2. In your browser, open:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Find `"chat":{"id": 123456789}` in the JSON. That number is your Chat ID.

#### Group Chat

1. Add your bot to the group.
2. Send any message in the group.
3. Visit the `getUpdates` URL above.
4. Find `"chat":{"id": -100123456789}` — group IDs always start with `-100`.

#### Channel

1. Add your bot as an **Administrator** of the channel (with "Post Messages" permission).
2. Send a message in the channel.
3. Check `getUpdates` — the channel's Chat ID will appear, starting with `-100`.

---

### Step 3 — Configure in EveryUp

1. Go to **Alerts → Add Channel → Telegram**.
2. Enter a display name, paste the **Bot Token** and **Chat ID**.
3. Click **Save** — a test notification is sent automatically to verify the connection.

---

### Troubleshooting

| Symptom | Cause & Fix |
|---------|-------------|
| `getUpdates` returns empty `[]` | The bot hasn't received any messages yet. Send it a message and try again. |
| Bot doesn't respond in a group | Enable group access: in BotFather, send `/mybots` → select your bot → Bot Settings → Group Privacy → Turn off. |
| `401 Unauthorized` | Bot Token is invalid or revoked. Generate a new one via `/token` in BotFather. |
| Test notification not delivered | Double-check the Chat ID. For groups/channels, make sure the bot has been added and has send permission. |

---

## Discord

### Step 1 — Create a Webhook

1. In your Discord server, go to **Server Settings** → **Integrations** → **Webhooks**.
2. Click **New Webhook**.
3. Give it a name (e.g., `EveryUp Alerts`) and select the **target channel**.
4. Optionally upload a custom avatar.
5. Click **Copy Webhook URL** and save it.

> **Example URL:** `https://discord.com/api/webhooks/1234567890/ABCdefGHIjklMNOpqrSTUvwxYZ`

> **Tip:** You can also create a webhook per-channel without server-wide Admin rights — you only need the **Manage Webhooks** permission on that channel.

---

### Step 2 — Configure in EveryUp

1. Go to **Alerts → Add Channel → Discord**.
2. Enter a display name and paste the **Webhook URL**.
3. Click **Save** — a test notification is sent automatically.

---

### Troubleshooting

| Symptom | Cause & Fix |
|---------|-------------|
| `Invalid Webhook Token` error | The URL is incomplete or malformed. Paste the full URL starting with `https://discord.com/api/webhooks/`. |
| Test notification not received | The webhook may have been deleted. Verify it still exists under Server Settings → Integrations → Webhooks. |
| `404 Unknown Webhook` | Webhook was deleted. Create a new one and update the URL in EveryUp. |
| Rate limited | Discord enforces per-webhook rate limits. This is temporary — EveryUp will retry automatically. |

---

## General Notes

- EveryUp sends a **test notification** automatically whenever a new channel is saved. Use the **Test** button on any channel card to re-send it at any time.
- Channels can be **toggled on/off** independently without deleting them.
- Multiple channels can be assigned to a single **Alert Rule** for simultaneous delivery.
- Alert Rules define the conditions (CPU threshold, error rate, etc.) and which channels receive the notification.
