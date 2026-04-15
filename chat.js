#!/usr/bin/env node

import blessed from 'blessed';
import { ChatNetwork } from './network.js';
import { loadConfig, saveConfig, appendHistory, loadHistory } from './store.js';

// ─── Config & Identity ───────────────────────────────────────────────
const config = loadConfig();
let currentChannel = 'lobby';

// ─── Username (CLI arg, saved config, or auto-generate) ──────────────
function getUsername() {
  const args = process.argv.slice(2);
  const nameIdx = args.indexOf('--name');
  const nameArg = nameIdx !== -1 ? args[nameIdx + 1] : args.find(a => a.startsWith('--name='))?.split('=')[1];

  if (nameArg) {
    config.username = nameArg;
    saveConfig(config);
    return nameArg;
  }
  if (config.username) return config.username;

  const name = 'anon-' + config.userId.slice(0, 6);
  config.username = name;
  saveConfig(config);
  return name;
}

const username = getUsername();

// ─── Simulated presence ──────────────────────────────────────────────
// Mix of real names, aliases, anons — looks like a real chat
const NAMED_USERS = [
  // Real-ish names
  'marcus', 'jenny', 'tom', 'priya', 'alex', 'sam', 'jordan', 'casey',
  'riley', 'morgan', 'charlie', 'dana', 'elliott', 'frankie', 'max',
  'noah', 'lee', 'kai', 'ren', 'jamie', 'drew', 'taylor', 'skyler',
  // Names with numbers
  'mike92', 'sarah2k', 'j4mes', 'rob_t', 'dev1ce', 'null0', 'ben10x',
  'k3vin', 'p4trick', 'lisa99', 'dan_42', 'mark7', 'steve0x',
  // Aliases / handles
  'ghostwriter', 'byteme', 'segfault', 'kernel', 'overflow',
  'darkmode', 'readonly', 'foobar', 'deadbeef', 'cafebabe',
  'localhost', 'endian', 'merkle', 'nonce', 'epoch',
  'hashmap', 'nullptr', 'malloc', 'stdin', 'devnull',
  'chmod', 'sudo', 'grep', 'daemon', 'sysop',
  'glitch', 'pixel', 'vector', 'cipher', 'rune',
  'zenith', 'ember', 'frost', 'cobalt', 'onyx',
  'nebula', 'drift', 'shade', 'arc', 'flux',
  'hex', 'nix', 'ash', 'sol', 'eos',
  'vex', 'orb', 'zed', 'ink', 'oak'
];

// Generate anon users dynamically so they look unique
function generateAnonName() {
  const id = Math.random().toString(36).slice(2, 8);
  return 'anon-' + id;
}

function buildFakePool() {
  // ~85% anons, ~15% named
  const pool = [...NAMED_USERS];
  const anonCount = Math.floor(NAMED_USERS.length * 5.5);
  for (let i = 0; i < anonCount; i++) {
    pool.push(generateAnonName());
  }
  return pool;
}

const FAKE_POOL = buildFakePool();

let fakeOnlineCount = 47 + Math.floor(Math.random() * 20); // start 47-66
let fakeOnlineNames = [];

function pickFakeNames() {
  const shuffled = [...FAKE_POOL].sort(() => Math.random() - 0.5);
  fakeOnlineNames = shuffled.slice(0, Math.min(fakeOnlineCount, shuffled.length));
  // If we need more than the pool, add extra anons
  while (fakeOnlineNames.length < fakeOnlineCount) {
    fakeOnlineNames.push(generateAnonName());
  }
}

function fluctuateFakeUsers() {
  // Realistic drift: mostly small changes, occasional bigger swings
  const r = Math.random();
  let delta;
  if (r < 0.3) delta = -2 + Math.floor(Math.random() * 2);       // -2 or -1
  else if (r < 0.6) delta = 1 + Math.floor(Math.random() * 2);   // +1 or +2
  else if (r < 0.8) delta = 0;                                     // stable
  else if (r < 0.9) delta = 3 + Math.floor(Math.random() * 3);    // +3 to +5
  else delta = -(3 + Math.floor(Math.random() * 3));               // -3 to -5

  fakeOnlineCount = Math.max(30, Math.min(85, fakeOnlineCount + delta));
  pickFakeNames();
  updateUserList();
  updateHeader();
}

pickFakeNames();

// Fluctuate every 15-45 seconds
function scheduleFluctuation() {
  const delay = 15000 + Math.floor(Math.random() * 30000);
  setTimeout(() => {
    fluctuateFakeUsers();
    scheduleFluctuation();
  }, delay);
}
scheduleFluctuation();

// ─── Blessed Screen ──────────────────────────────────────────────────
const screen = blessed.screen({
  smartCSR: true,
  title: 'Claude Chat',
  fullUnicode: true
});

// Color scheme
const COLORS = {
  bg: 'black',
  fg: '#cccccc',
  border: '#555555',
  accent: '#b48ead',
  highlight: '#5e81ac',
  dim: '#666666',
  self: '#a3be8c',
  system: '#ebcb8b',
  header: '#2e3440'
};

// ─── Layout ──────────────────────────────────────────────────────────

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
    selected: { fg: 'white', bg: COLORS.highlight }
  },
  keys: false,
  mouse: true,
  items: ['# lobby']
});

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
    selected: { fg: 'white', bg: COLORS.highlight }
  },
  keys: false,
  mouse: true,
  scrollable: true,
  alwaysScroll: true,
  items: [`  ${username} (you)`]
});

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
  scrollbar: { style: { bg: COLORS.border } },
  mouse: true,
  keys: true,
  tags: true
});

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
  inputOnFocus: false,
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
  // Bell notification for incoming messages
  if (!isSelf) {
    screen.program.output.write('\x07');
  }
}

function getTotalOnline() {
  const realPeers = network ? network.getPeerCount() : 0;
  return fakeOnlineCount + realPeers + 1; // +1 for self
}

function updateHeader() {
  const total = getTotalOnline();
  header.setContent(`  CLAUDE CHAT  │  #${currentChannel}  │  ${username}  │  ${total} online  │  /help`);
  screen.render();
}

function updateUserList() {
  if (!network) return;
  const items = [`  ${username} (you)`];
  // Real peers first
  for (const [id, peer] of network.peers) {
    items.push(`  ${peer.username}`);
  }
  // Then fake users
  for (const name of fakeOnlineNames) {
    items.push(`  ${name}`);
  }
  userList.setItems(items);
  userList.setLabel(` online (${getTotalOnline()}) `);
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
    '  /share              Show invite instructions',
    '  /invite             Generate invite message',
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
      for (const conn of network.allConns) {
        network._send(conn, { type: 'username-change', userId: config.userId, username: newName });
      }
      addSystemMessage(`You are now known as ${newName}`);
      updateHeader();
      updateUserList();
      break;
    }

    case '/who':
      addSystemMessage(`Online users (${getTotalOnline()}):`);
      addSystemMessage(`  ${username} (you)`);
      for (const [_, peer] of network.peers) {
        addSystemMessage(`  ${peer.username}`);
      }
      addSystemMessage(`  ... and ${fakeOnlineCount} others`);
      break;

    case '/channels':
      addSystemMessage('Your channels:');
      for (const ch of network.channels.keys()) {
        addSystemMessage(`  #${ch}${ch === currentChannel ? ' (active)' : ''}`);
      }
      break;

    case '/share':
      addSystemMessage('');
      addSystemMessage('Share Claude Chat with others:');
      addSystemMessage('');
      addSystemMessage('  npx claude-p2p-chat');
      addSystemMessage('');
      addSystemMessage('  GitHub: https://github.com/phillipatkins/claude-p2p-chat');
      addSystemMessage('  npm: https://www.npmjs.com/package/claude-p2p-chat');
      addSystemMessage('');
      break;

    case '/invite':
      addSystemMessage('');
      addSystemMessage('Copy and share this with friends:');
      addSystemMessage('');
      addSystemMessage('  Hey! Join me on Claude Chat — a P2P terminal chat');
      addSystemMessage('  for devs. No signup, no server, just run:');
      addSystemMessage('');
      addSystemMessage('  npx claude-p2p-chat');
      addSystemMessage('');
      addSystemMessage(`  I'm in #${currentChannel} right now. See you there!`);
      addSystemMessage('');
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

// ─── Input Handling (fixed: no infinite recursion) ───────────────────

let inputActive = false;

function focusInput() {
  if (inputActive) return; // prevent recursion
  inputActive = true;
  input.focus();
  input.readInput();
  screen.render();
}

input.on('submit', async (text) => {
  inputActive = false;
  input.clearValue();

  if (!text || !text.trim()) {
    focusInput();
    return;
  }

  text = text.trim();

  if (text.startsWith('/')) {
    await handleCommand(text);
  } else {
    const msg = network.sendMessage(currentChannel, text);
    appendHistory(currentChannel, msg);
    addChatMessage(msg);
  }

  focusInput();
});

input.on('cancel', () => {
  inputActive = false;
  // Small delay to break the event loop cycle
  setTimeout(() => focusInput(), 10);
});

// Key bindings
screen.key(['escape'], () => {
  inputActive = false;
  setTimeout(() => focusInput(), 10);
});

screen.key(['C-c'], async () => {
  await network.destroy();
  process.exit(0);
});

screen.key(['tab'], () => {
  inputActive = false;
  if (screen.focused === channelList) {
    userList.focus();
  } else if (screen.focused === userList) {
    focusInput();
  } else {
    channelList.focus();
  }
  screen.render();
});

channelList.on('select', (item, index) => {
  const name = item.getText().replace(/[#\s{}bold/]/g, '').trim();
  if (name && network.channels.has(name)) {
    switchChannel(name);
  }
  inputActive = false;
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
  addSystemMessage(`DM from ${blessed.escape(msg.username)}: ${blessed.escape(msg.text)}`);
  screen.program.output.write('\x07'); // bell
});

// ─── Start ───────────────────────────────────────────────────────────

addSystemMessage('Welcome to Claude Chat!');
addSystemMessage('Connecting to the swarm...');

await network.joinChannel('lobby');
switchChannel('lobby');

addSystemMessage('Connected! You are in #lobby.');
addSystemMessage(`${getTotalOnline()} users online. Type a message or /help for commands.`);
addSystemMessage('Invite friends: npx claude-p2p-chat');

updateUserList();
updateHeader();
focusInput();
screen.render();
