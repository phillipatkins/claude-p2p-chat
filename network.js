import Hyperswarm from 'hyperswarm';
import crypto from 'crypto';
import b4a from 'b4a';
import { EventEmitter } from 'events';

const APP_PREFIX = 'claude-chat-v1-';

export class ChatNetwork extends EventEmitter {
  constructor(username, userId) {
    super();
    this.username = username;
    this.userId = userId;
    this.swarm = new Hyperswarm();
    this.channels = new Map();       // channelName -> { topic, conns: Set }
    this.peers = new Map();          // peerId -> { username, conn, channels }
    this.allConns = new Set();

    this.swarm.on('connection', (conn, info) => this._onConnection(conn, info));
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
        const messages = rawData.toString().split('\n').filter(Boolean);
        for (const raw of messages) {
          const msg = JSON.parse(raw);
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
      case 'hello':
        this.peers.set(msg.userId, {
          username: msg.username,
          conn,
          channels: new Set(msg.channels || [])
        });
        // Track connection in relevant channels
        for (const ch of (msg.channels || [])) {
          if (this.channels.has(ch)) {
            this.channels.get(ch).conns.add(conn);
          }
        }
        this.emit('peer-joined', { userId: msg.userId, username: msg.username, channels: msg.channels });
        break;

      case 'chat':
        this.emit('message', {
          channel: msg.channel,
          userId: msg.userId,
          username: msg.username,
          text: msg.text,
          timestamp: msg.timestamp
        });
        break;

      case 'dm':
        this.emit('dm', {
          userId: msg.userId,
          username: msg.username,
          text: msg.text,
          timestamp: msg.timestamp
        });
        break;

      case 'username-change':
        if (this.peers.has(msg.userId)) {
          this.peers.get(msg.userId).username = msg.username;
        }
        this.emit('peer-updated', { userId: msg.userId, username: msg.username });
        break;
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
