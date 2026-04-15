import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.env.HOME, '.claude-chat');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const HISTORY_DIR = path.join(DATA_DIR, 'history');

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

export function loadConfig() {
  ensureDirs();
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  // First run — generate identity
  const config = {
    userId: crypto.randomBytes(16).toString('hex'),
    username: null,
    channels: ['lobby']
  };
  saveConfig(config);
  return config;
}

export function saveConfig(config) {
  ensureDirs();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function appendHistory(channel, message) {
  ensureDirs();
  const file = path.join(HISTORY_DIR, `${sanitize(channel)}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(message) + '\n');
}

export function loadHistory(channel, limit = 50) {
  const file = path.join(HISTORY_DIR, `${sanitize(channel)}.jsonl`);
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map(l => JSON.parse(l));
}

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}
