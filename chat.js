#!/usr/bin/env node

import blessed from 'blessed';
import { ChatNetwork } from './network.js';
import { loadConfig, saveConfig, appendHistory, loadHistory } from './store.js';
import { createInterface } from 'readline';

// ─── Config & Identity ───────────────────────────────────────────────
const config = loadConfig();
let currentChannel = 'lobby';

// ─── Username (CLI arg, saved config, or auto-generate) ──────────────
function getUsername() {
  // Accept --name=foo or --name foo from CLI
  const args = process.argv.slice(2);
  const nameIdx = args.indexOf('--name');
  const nameArg = nameIdx !== -1 ? args[nameIdx + 1] : args.find(a => a.startsWith('--name='))?.split('=')[1];

  if (nameArg) {
    config.username = nameArg;
    saveConfig(config);
    return nameArg;
  }
  if (config.username) return config.username;

  // Auto-generate on first run (use /nick to change later)
  const name = 'anon-' + config.userId.slice(0, 6);
  config.username = name;
  saveConfig(config);
  return name;
}

const username = getUsername();

// ─── Blessed Screen ──────────────────────────────────────────────────
const screen = blessed.screen({
  smartCSR: true,
  title: 'Claude Chat',
  fullUnicode: true
});

// Color scheme — dark theme matching Claude terminal
const COLORS = {
  bg: 'black',
  fg: '#cccccc',
  border: '#555555',
  accent: '#b48ead',    // soft purple
  highlight: '#5e81ac',  // blue
  dim: '#666666',
  self: '#a3be8c',       // green for own messages
  system: '#ebcb8b',     // yellow for system
  header: '#2e3440'
};

// ─── Layout ──────────────────────────────────────────────────────────

// Header bar
const header = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: 1,
  content: `  CLAUDE CHAT  │  #${currentChannel}  │  ${username}  │  /help for commands`,
  style: {
    fg: COLORS.accent,
    bg: '#1a1a2e',
    bold: true
  }
});

// Channel list (left sidebar)
const channelList = blessed.list({
  parent: screen,
  top: 1,
  left: 0,
  width: 20,
  bottom: 3,
  label: ' channels ',
  border: { type: 'line' },
  style: {
    fg: COLORS.fg,
    bg: COLORS.bg,
    border: { fg: COLORS.border },
    label: { fg: COLORS.accent },
    selected: {
      fg: 'white',
      bg: COLORS.highlight
    }
  },
  keys: false,
  mouse: true,
  items: ['# lobby']
});

// User list (right sidebar)
const userList = blessed.list({
  parent: screen,
  top: 1,
  right: 0,
  width: 22,
  bottom: 3,
  label: ' online ',
  border: { type: 'line' },
  style: {
    fg: COLORS.fg,
    bg: COLORS.bg,
    border: { fg: COLORS.border },
    label: { fg: COLORS.accent },
    selected: {
      fg: 'white',
      bg: COLORS.highlight
    }
  },
  keys: false,
  mouse: true,
  items: [`  ${username} (you)`]
});

// Messages area (center)
const messages = blessed.log({
  parent: screen,
  top: 1,
  left: 20,
  right: 22,
  bottom: 3,
  label: ` #${currentChannel} `,
  border: { type: 'line' },
  style: {
    fg: COLORS.fg,
    bg: COLORS.bg,
    border: { fg: COLORS.border },
    label: { fg: COLORS.accent }
  },
  scrollable: true,
  alwaysScroll: true,
  scrollbar: {
    style: { bg: COLORS.border }
  },
  mouse: true,
  keys: true,
  tags: true
});

// Input box
const input = blessed.textbox({
  parent: screen,
  bottom: 0,
  left: 0,
  width: '100%',
  height: 3,
  label: ` message #${currentChannel} `,
  border: { type: 'line' },
  style: {
    fg: 'white',
    bg: COLORS.bg,
    border: { fg: COLORS.accent },
    label: { fg: COLORS.accent }
  },
  inputOnFocus: true,
  keys: true,
  mouse: true
});

// ─── Helper Functions ────────────────────────────────────────────────

function addSystemMessage(text) {
  const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  messages.log(`{${COLORS.dim}-fg}${time}{/} {${COLORS.system}-fg}*** ${text}{/}`);
}

function addChatMessage(msg) {
  const time = new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const isSelf = msg.userId === config.userId;
  const nameColor = isSelf ? COLORS.self : COLORS.accent;
  const nameStr = isSelf ? 'you' : msg.username;
  messages.log(`{${COLORS.dim}-fg}${time}{/} {${nameColor}-fg}${nameStr}{/}  ${blessed.escape(msg.text)}`);
}

function updateHeader() {
  const peerCount = network ? network.getPeerCount() : 0;
  header.setContent(`  CLAUDE CHAT  │  #${currentChannel}  │  ${username}  │  ${peerCount} online  │  /help`);
  screen.render();
}

function updateUserList() {
  if (!network) return;
  const peers = [...network.peers.entries()];
  const items = [`  ${username} (you)`];
  for (const [id, peer] of peers) {
    items.push(`  ${peer.username}`);
  }
  userList.setItems(items);
  userList.setLabel(` online (${items.length}) `);
  screen.render();
}

function updateChannelList() {
  const items = [...(network ? network.channels.keys() : config.channels)].map(c => {
    return c === currentChannel ? `{bold}# ${c}{/bold}` : `  # ${c}`;
  });
  channelList.setItems(items);
  screen.render();
}

function switchChannel(name) {
  currentChannel = name;
  messages.setLabel(` #${currentChannel} `);
  input.setLabel(` message #${currentChannel} `);
  messages.setContent('');

  // Load history
  const history = loadHistory(currentChannel);
  for (const msg of history) {
    addChatMessage(msg);
  }

  if (history.length === 0) {
    addSystemMessage(`Joined #${currentChannel}. Say hello!`);
  }

  updateChannelList();
  updateHeader();
  screen.render();
}

function showHelp() {
  const helpText = [
    '',
    '  COMMANDS:',
    '  /join <channel>     Join or create a channel',
    '  /leave <channel>    Leave a channel',
    '  /dm <user> <msg>    Send a direct message',
    '  /nick <name>        Change your username',
    '  /who                List online users',
    '  /channels           List your channels',
    '  /clear              Clear message area',
    '  /quit               Exit chat',
    '  /help               Show this help',
    '',
    '  Click channels on the left to switch.',
    '  Tab to cycle focus. Esc to refocus input.',
    ''
  ];
  for (const line of helpText) {
    addSystemMessage(line);
  }
}

// ─── Command Handler ─────────────────────────────────────────────────

async function handleCommand(text) {
  const parts = text.split(' ');
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case '/help':
      showHelp();
      break;

    case '/join': {
      const ch = parts[1];
      if (!ch) { addSystemMessage('Usage: /join <channel>'); break; }
      await network.joinChannel(ch);
      switchChannel(ch);
      addSystemMessage(`Joined #${ch}`);
      break;
    }

    case '/leave': {
      const ch = parts[1] || currentChannel;
      if (ch === 'lobby') { addSystemMessage("Can't leave #lobby"); break; }
      await network.leaveChannel(ch);
      if (currentChannel === ch) switchChannel('lobby');
      addSystemMessage(`Left #${ch}`);
      break;
    }

    case '/dm': {
      const target = parts[1];
      const dmText = parts.slice(2).join(' ');
      if (!target || !dmText) { addSystemMessage('Usage: /dm <user> <message>'); break; }
      const peer = [...network.peers.entries()].find(([_, p]) => p.username === target);
      if (!peer) { addSystemMessage(`User "${target}" not found`); break; }
      const msg = network.sendDM(peer[0], dmText);
      if (msg) addSystemMessage(`DM to ${target}: ${dmText}`);
      break;
    }

    case '/nick': {
      const newName = parts[1];
      if (!newName) { addSystemMessage('Usage: /nick <name>'); break; }
      config.username = newName;
      saveConfig(config);
      // Notify peers
      for (const conn of network.allConns) {
        network._send(conn, { type: 'username-change', userId: config.userId, username: newName });
      }
      addSystemMessage(`You are now known as ${newName}`);
      updateHeader();
      updateUserList();
      break;
    }

    case '/who':
      addSystemMessage(`Online users (${network.getPeerCount() + 1}):`);
      addSystemMessage(`  ${username} (you)`);
      for (const [_, peer] of network.peers) {
        addSystemMessage(`  ${peer.username}`);
      }
      break;

    case '/channels':
      addSystemMessage('Your channels:');
      for (const ch of network.channels.keys()) {
        addSystemMessage(`  #${ch}${ch === currentChannel ? ' (active)' : ''}`);
      }
      break;

    case '/clear':
      messages.setContent('');
      screen.render();
      break;

    case '/quit':
      await network.destroy();
      process.exit(0);
      break;

    default:
      addSystemMessage(`Unknown command: ${cmd}. Type /help for commands.`);
  }
}

// ─── Input Handling ──────────────────────────────────────────────────

function focusInput() {
  input.focus();
  input.readInput();
  screen.render();
}

input.on('submit', async (text) => {
  input.clearValue();

  if (!text || !text.trim()) {
    focusInput();
    return;
  }

  text = text.trim();

  if (text.startsWith('/')) {
    await handleCommand(text);
  } else {
    // Regular message
    const msg = network.sendMessage(currentChannel, text);
    appendHistory(currentChannel, msg);
    addChatMessage(msg);
  }

  focusInput();
});

input.on('cancel', () => {
  focusInput();
});

// Key bindings
screen.key(['escape'], () => focusInput());
screen.key(['C-c', 'q'], async () => {
  if (screen.focused === input) return; // don't quit while typing
  await network.destroy();
  process.exit(0);
});
screen.key(['tab'], () => {
  if (screen.focused === input) {
    channelList.focus();
  } else if (screen.focused === channelList) {
    userList.focus();
  } else {
    focusInput();
  }
  screen.render();
});

channelList.on('select', (item, index) => {
  const name = item.getText().replace(/[#\s{}bold/]/g, '').trim();
  if (name && network.channels.has(name)) {
    switchChannel(name);
  }
  focusInput();
});

// ─── Network Events ──────────────────────────────────────────────────
const network = new ChatNetwork(username, config.userId);

network.on('peer-joined', (peer) => {
  addSystemMessage(`${peer.username} joined`);
  updateUserList();
  updateHeader();
});

network.on('peer-left', (peer) => {
  addSystemMessage(`${peer.username} left`);
  updateUserList();
  updateHeader();
});

network.on('peer-updated', (peer) => {
  updateUserList();
});

network.on('message', (msg) => {
  if (msg.channel === currentChannel) {
    addChatMessage(msg);
  }
  appendHistory(msg.channel, msg);
});

network.on('dm', (msg) => {
  addSystemMessage(`DM from ${msg.username}: ${msg.text}`);
});

// ─── Start ───────────────────────────────────────────────────────────

// Splash
addSystemMessage('Welcome to Claude Chat!');
addSystemMessage('Connecting to the swarm...');

await network.joinChannel('lobby');
switchChannel('lobby');

addSystemMessage('Connected! You are in #lobby.');
addSystemMessage('Type a message or /help for commands.');

focusInput();
screen.render();
