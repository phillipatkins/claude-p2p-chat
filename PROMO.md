# Where to post + copy-paste ready posts

---

## 1. Reddit — r/ClaudeAI

**Title:** I built a P2P terminal chat for Claude Code users — no server, no signup, just `npx claude-p2p-chat`

**Body:**

Been using Claude Code a lot and thought — why isn't there a way to chat with other people using it, right from the terminal?

So I built one. It's a peer-to-peer chat that uses Hyperswarm (distributed hash table) for peer discovery. No server, no accounts, no cost. Everyone who runs it automatically joins #lobby and can see each other.

**One command to try it:**

```
npx claude-p2p-chat
```

Features:
- Public lobby + custom channels (`/join whatever`)
- Direct messages (`/dm username hey`)
- Beautiful TUI with channel list, user list, message area
- Chat history saved locally
- Works on Linux, macOS, Windows (WSL)
- Fully decentralized — if my computer explodes, it still works

It's basically IRC but for the Claude Code community, built on top of the same tech that powers Keet and Pear.

GitHub: https://github.com/phillipatkins/claude-p2p-chat

Would love to see some of you in #lobby!

---

## 2. Reddit — r/commandline

**Title:** P2P terminal chat built with Hyperswarm + Blessed — no server needed

**Body:**

Built a terminal chat app that uses Hyperswarm's DHT for peer discovery instead of a central server. Everyone who joins the same topic hash finds each other automatically through the distributed hash table.

```
npx claude-p2p-chat
```

Stack:
- **Hyperswarm** for P2P networking + NAT traversal
- **Blessed** for the TUI (channels, user list, messages, input)
- **Local JSONL files** for chat history

It was originally built for Claude Code users but works for anyone who wants a serverless terminal chat. Think IRC but without needing to host anything.

GitHub: https://github.com/phillipatkins/claude-p2p-chat

---

## 3. Twitter/X

Just shipped a P2P terminal chat for Claude Code users.

No server. No signup. No cost. One command:

npx claude-p2p-chat

Hyperswarm DHT handles peer discovery. Messages go directly between users. Chat history stays on your machine.

Come hang out in #lobby

https://github.com/phillipatkins/claude-p2p-chat

---

## 4. Hacker News (Show HN)

**Title:** Show HN: P2P Terminal Chat Using Hyperswarm – No Server Required

**URL:** https://github.com/phillipatkins/claude-p2p-chat

**Comment:**

I built a terminal chat that uses Hyperswarm's DHT for peer discovery and NAT traversal. No central server, no accounts, no hosting costs.

Run `npx claude-p2p-chat` and you're in a public lobby with anyone else running it. You can create channels, DM people, and everything is end-to-end between peers.

The TUI is built with blessed and has channel lists, user lists, and scrollable message history stored locally as JSONL.

Originally built it for the Claude Code community but it works for anyone.

---

## 5. Discord — Claude/Anthropic Discord, dev tool servers

Hey! Built a terminal chat for Claude Code users — fully P2P, no server needed.

`npx claude-p2p-chat`

Everyone running it connects through Hyperswarm DHT. Public lobby + custom channels + DMs. All in a TUI that looks like IRC.

Repo: https://github.com/phillipatkins/claude-p2p-chat

Would be cool to get a few people in #lobby at the same time!

---

## 6. Reddit — r/node

**Title:** Built a P2P chat with Hyperswarm + Blessed — zero infrastructure

**Body:**

Wanted to experiment with Hyperswarm for something practical, so I built a terminal chat where peers discover each other through the DHT. No server, no WebSocket relay, no Firebase — just direct connections between nodes.

```
npx claude-p2p-chat
```

The interesting bits technically:
- Hyperswarm handles peer discovery + NAT traversal via DHT
- Each "channel" is a SHA-256 hash that peers join as a topic
- Messages are JSON over encrypted streams
- Blessed renders the TUI (channels sidebar, user list, message log)
- History is local JSONL per channel

Happy to answer questions about the Hyperswarm experience — it was surprisingly easy to get working.

GitHub: https://github.com/phillipatkins/claude-p2p-chat
