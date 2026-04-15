import Hyperswarm from 'hyperswarm';
import crypto from 'crypto';
import b4a from 'b4a';
import { EventEmitter } from 'events';

const APP_PREFIX = 'claude-chat-v1-';
const MAX_TEXT_LEN = 2000;
const MAX_NAME_LEN = 32;
const MAX_CHANNEL_LEN = 32;
const RATE_LIMIT_WINDOW = 5000; // 5 seconds
const RATE_LIMIT_MAX = 15;      // max messages per window

function sanitizeStr(str, maxLen) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLen).replace(/[\x00-\x1f]/g, '');
}

export class ChatNetwork extends EventEmitter {
  constructor(username, userId) {
    super();
    this.username = username;
    this.userId = userId;
    this.swarm = new Hyperswarm();
    this.channels = new Map();       // channelName -> { topic, conns: Set }
    this.peers = new Map();          // peerId -> { username, conn, channels }
    this.allConns = new Set();
    this._rateLimits = new Map();    // peerId -> { count, resetAt }

    this.swarm.on('connection', (conn, info) => this._onConnection(conn, info));
  }

  _isRateLimited(peerId) {
    const now = Date.now();
    let entry = this._rateLimits.get(peerId);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
      this._rateLimits.set(peerId, entry);
    }
    entry.count++;
    return entry.count > RATE_LIMIT_MAX;
  }

  _topicHash(channelName) {
    return crypto.createHash('sha256')
      .update(APP_PREFIX + channelName)
      .digest();
  }

  async joinChannel(channelName) {
    if (this.channels.has(channelName)) return;

    const topic = this._topicHash(channelName);
    const discovery = this.swarm.join(topic, { client: true, server: true });
    await discovery.flushed();

    this.channels.set(channelName, {
      topic,
      discovery,
      conns: new Set()
    });

    this.emit('channel-joined', channelName);
  }

  async leaveChannel(channelName) {
    const ch = this.channels.get(channelName);
    if (!ch) return;
    ch.discovery.destroy();
    this.channels.delete(channelName);
    this.emit('channel-left', channelName);
  }

  _onConnection(conn, info) {
    this.allConns.add(conn);
    let remotePeerId = null;

    // Send our identity
    this._send(conn, {
      type: 'hello',
      userId: this.userId,
      username: this.username,
      channels: [...this.channels.keys()]
    });

    conn.on('data', (rawData) => {
      try {
        // Reject oversized payloads
        if (rawData.length > 10000) return;
        const messages = rawData.toString().split('\n').filter(Boolean);
        for (const raw of messages) {
          const msg = JSON.parse(raw);
          if (!msg || typeof msg.type !== 'string') continue;
          // Rate limit per peer
          if (remotePeerId && this._isRateLimited(remotePeerId)) continue;
          this._handleMessage(conn, msg);
          if (msg.type === 'hello') {
            remotePeerId = msg.userId;
          }
        }
      } catch (e) {
        // ignore malformed
      }
    });

    conn.on('close', () => {
      this.allConns.delete(conn);
      if (remotePeerId && this.peers.has(remotePeerId)) {
        const peer = this.peers.get(remotePeerId);
        this.peers.delete(remotePeerId);
        this.emit('peer-left', { userId: remotePeerId, username: peer.username });
      }
    });

    conn.on('error', () => {
      this.allConns.delete(conn);
    });
  }

  _handleMessage(conn, msg) {
    switch (msg.type) {
      case 'hello': {
        const userId = sanitizeStr(msg.userId, 64);
        const uname = sanitizeStr(msg.username, MAX_NAME_LEN);
        const channels = Array.isArray(msg.channels)
          ? msg.channels.slice(0, 20).map(c => sanitizeStr(c, MAX_CHANNEL_LEN)).filter(Boolean)
          : [];
        if (!userId || !uname) break;
        this.peers.set(userId, {
          username: uname,
          conn,
          channels: new Set(channels)
        });
        for (const ch of channels) {
          if (this.channels.has(ch)) {
            this.channels.get(ch).conns.add(conn);
          }
        }
        this.emit('peer-joined', { userId, username: uname, channels });
        break;
      }

      case 'chat': {
        const text = sanitizeStr(msg.text, MAX_TEXT_LEN);
        const channel = sanitizeStr(msg.channel, MAX_CHANNEL_LEN);
        if (!text || !channel) break;
        this.emit('message', {
          channel,
          userId: sanitizeStr(msg.userId, 64),
          username: sanitizeStr(msg.username, MAX_NAME_LEN),
          text,
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now()
        });
        break;
      }

      case 'dm': {
        const dmText = sanitizeStr(msg.text, MAX_TEXT_LEN);
        if (!dmText) break;
        this.emit('dm', {
          userId: sanitizeStr(msg.userId, 64),
          username: sanitizeStr(msg.username, MAX_NAME_LEN),
          text: dmText,
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now()
        });
        break;
      }

      case 'username-change': {
        const uid = sanitizeStr(msg.userId, 64);
        const newName = sanitizeStr(msg.username, MAX_NAME_LEN);
        if (!uid || !newName) break;
        if (this.peers.has(uid)) {
          this.peers.get(uid).username = newName;
        }
        this.emit('peer-updated', { userId: uid, username: newName });
        break;
      }
    }
  }

  sendMessage(channelName, text) {
    const msg = {
      type: 'chat',
      channel: channelName,
      userId: this.userId,
      username: this.username,
      text,
      timestamp: Date.now()
    };

    // Send to all connected peers (they filter by channel)
    for (const conn of this.allConns) {
      this._send(conn, msg);
    }

    return msg;
  }

  sendDM(targetUserId, text) {
    const peer = this.peers.get(targetUserId);
    if (!peer) return null;

    const msg = {
      type: 'dm',
      userId: this.userId,
      username: this.username,
      text,
      timestamp: Date.now()
    };

    this._send(peer.conn, msg);
    return msg;
  }

  _send(conn, msg) {
    try {
      conn.write(JSON.stringify(msg) + '\n');
    } catch (e) {
      // connection dead
    }
  }

  getOnlinePeers(channelName) {
    if (!channelName) {
      return [...this.peers.values()].map(p => ({
        userId: p.userId,
        username: p.username
      }));
    }
    return [...this.peers.entries()]
      .filter(([_, p]) => p.channels.has(channelName))
      .map(([id, p]) => ({ userId: id, username: p.username }));
  }

  getPeerCount() {
    return this.peers.size;
  }

  async destroy() {
    await this.swarm.destroy();
  }
}
