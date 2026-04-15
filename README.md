# claude-p2p-chat

**Peer-to-peer terminal chat for Claude Code users.**
No server. No signup. No cost. Just open a terminal and talk.

```
npx claude-p2p-chat
```

```
┌──────────────────────────────────────────────────────────────────────────┐
│  CLAUDE CHAT  │  #lobby  │  phil  │  3 online  │  /help                 │
├──────────┬───────────────────────────────────────────────┬──────────────┤
│channels  │ #lobby                                       │ online (3)   │
│          │                                              │              │
│ # lobby  │ 18:42  *** Welcome to Claude Chat!           │  phil (you)  │
│ # dev    │ 18:42  *** Connected! You are in #lobby.     │  alice       │
│          │ 18:42  alice  hey everyone!                   │  bob         │
│          │ 18:43  bob    yo, anyone working on agents?   │              │
│          │ 18:43  you    just shipped a new MCP server   │              │
│          │ 18:44  alice  nice! what does it do?          │              │
│          │                                              │              │
├──────────┴───────────────────────────────────────────────┴──────────────┤
│ message #lobby                                                         │
│ > _                                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

## Why?

You're in your terminal. You're using Claude Code. Wouldn't it be cool to chat with other people doing the same thing? No browser tab, no Electron app, no account creation — just a terminal chat that connects you with other devs through the magic of distributed hash tables.

## Features

- **Zero infrastructure** — Uses [Hyperswarm](https://github.com/holepunchto/hyperswarm) DHT for peer discovery. No servers to run or pay for.
- **Public lobby** — Everyone lands in `#lobby` automatically
- **Custom channels** — `/join anything` to create/join topic channels
- **Direct messages** — `/dm username hey there`
- **Local history** — Chat history saved to `~/.claude-chat/`
- **Cross-platform** — Works on Linux, macOS, and Windows (WSL)
- **Beautiful TUI** — Channels, user list, message area — all in your terminal

## Install

**Run without installing:**
```bash
npx claude-p2p-chat
```

**Install globally:**
```bash
npm install -g claude-p2p-chat
claude-p2p-chat
```

**Set your username:**
```bash
claude-p2p-chat --name yourname
```
Or change it anytime in chat with `/nick yourname`.

## Commands

| Command | Description |
|---------|-------------|
| `/join <channel>` | Join or create a channel |
| `/leave <channel>` | Leave a channel |
| `/dm <user> <msg>` | Send a direct message |
| `/nick <name>` | Change your username |
| `/who` | List online users |
| `/channels` | List your channels |
| `/clear` | Clear message area |
| `/quit` | Exit chat |
| `/help` | Show help |

## Keyboard

- **Tab** — Cycle between channels, users, and input
- **Esc** — Refocus the input box
- **Scroll** — Mouse wheel in the message area
- **Ctrl+C** — Quit (when not typing)

## How it works

Every user joins the same [Hyperswarm](https://github.com/holepunchto/hyperswarm) topic (a SHA-256 hash of the channel name). The DHT handles NAT traversal and peer discovery — no signaling server, no relay, no middleman. Messages go directly between peers over encrypted connections.

```
You ←──encrypted──→ Peer A
 ↕                    ↕
Peer B ←──────────→ Peer C
```

Chat history is stored locally in `~/.claude-chat/history/`. There's no cloud — if you weren't online when a message was sent, you won't see it (just like IRC).

## Claude Code Integration

Add this as a Claude Code skill so you can launch it with `/chat`:

1. Create `~/.claude/skills/chat/SKILL.md`:

```markdown
---
name: chat
description: Open P2P Chat
---

Run via Bash: `npx claude-p2p-chat`
```

## Requirements

- Node.js 18+
- A terminal that supports Unicode and 256 colors

## License

MIT
