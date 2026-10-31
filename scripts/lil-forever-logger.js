/**
 * lil-forever-logger.js - Logs all interactions forever into SQLite and JSONL
 * This script creates a permanent archive of all chats between Lil and users
 */

import express from 'express';
import Database from 'better-sqlite3';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const app = express();
app.use(express.json({ limit: '50mb' }));

// 1. Setup permanent archive directory on your Ubuntu machine
const ARCHIVE_DIR = process.env.LIL_ARCHIVE_DIR || path.join(os.homedir(), '.lil_archive');
await fs.mkdir(ARCHIVE_DIR, { recursive: true });
const JSONL_PATH = process.env.LIL_JSONL_PATH || path.join(ARCHIVE_DIR, 'forever_log.jsonl');
const DB_PATH = process.env.LIL_DB_PATH || path.join(ARCHIVE_DIR, 'lil_memory.db');

// 2. Setup VS Code handoff file location (update this to your actual path)
// For the littlables project, this is at /home/katie/repos/littlables.github.io/HANDOFF.md
const HANDOFF_MD = process.env.HANDOFF_MD || '/home/katie/repos/littlables.github.io/LIL_HANDOFF.md';

// 3. Initialize SQLite with Full-Text Search (FTS5)
const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    source TEXT,        -- 'web-lil' or 'vscode'
    role TEXT,          -- 'user', 'assistant', 'system'
    model TEXT,
    content TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content, content='messages', content_rowid='id'
  );
  CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
  END;
`);

const insertMsg = db.prepare(
  'INSERT INTO messages (session_id, source, role, model, content) VALUES (?, ?, ?, ?, ?)'
);

// Helper: Save to both SQLite and Append-Only JSONL
async function recordForever(sessionId, source, role, model, content) {
  insertMsg.run(sessionId, source, role, model, content);
  const entry = JSON.stringify({ 
    ts: new Date().toISOString(), 
    sessionId, 
    source, 
    role, 
    model, 
    content 
  });
  await fs.appendFile(JSONL_PATH, entry + '\n');
}

app.post('/api/lil-chat', async (req, res) => {
  const { prompt, sessionId = 'default', source = 'web-lil', model = 'qwen3.5:4b' } = req.body;
  
  try {
    // 1. Log user prompt forever
    await recordForever(sessionId, source, 'user', model, prompt);
    
    // 2. Search ancient history for relevant past snippets (FTS5 keyword match)
    const keywords = prompt.replace(/[^a-zA-Z0-9 ]/g, '').split(' ').filter(w => w.length > 4).join(' OR ');
    let recalledContext = '';
    if (keywords && keywords !== '||') {
      const pastHits = db.prepare(`
        SELECT m.timestamp, m.role, m.content 
        FROM messages_fts f JOIN messages m ON f.rowid = m.id
        WHERE messages_fts MATCH ? ORDER BY rank LIMIT 5
      `).all(keywords);
      if (pastHits.length > 0) {
        recalledContext = 'Relevant past logs:\n' + 
          pastHits.map(h => `[${h.timestamp}] ${h.role}: ${h.content}`).join('\n');
      }
    }
    
    // 3. Pull the last 20 messages for active sliding-window context
    const recentRows = db.prepare(`
      SELECT role, content FROM (
        SELECT id, role, content FROM messages ORDER BY id DESC LIMIT 20
      ) ORDER BY id ASC
    `).all();
    
    const messagesForOllama = [
      { role: 'system', content: `You are Lil. ${recalledContext}` },
      ...recentRows
    ];
    
    // 4. Call local Ollama
    const ollamaRes = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model, 
        messages: messagesForOllama, 
        stream: false 
      })
    });
    
    if (!ollamaRes.ok) {
      throw new Error(`Ollama returned ${ollamaRes.status}: ${await ollamaRes.text()}`);
    }
    
    const data = await ollamaRes.json();
    const reply = data.message.content;
    
    // 5. Log assistant response forever
    await recordForever(sessionId, source, 'assistant', model, reply);
    
    // 6. Update VS Code Handoff file with the latest active window
    const mdContent = recentRows.concat([{ role: 'assistant', content: reply }])
      .map(m => `### ${m.role.toUpperCase()}\n${m.content}\n`).join('\n---\n');
    await fs.writeFile(HANDOFF_MD, mdContent);
    
    // 7. Log to console for debugging
    console.log(`[${new Date().toISOString()}] Lil response: ${reply.substring(0, 100)}...`);
    
    res.json({ reply });
  } catch (error) {
    // Still log the error for archive purposes
    await recordForever(sessionId, source, 'system', model, `Error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.LIL_API_PORT || 3010, () => {
  console.log(`Forever Logger Bridge active on port ${process.env.LIL_API_PORT || 3010}`);
  console.log(`Archive location: ${ARCHIVE_DIR}`);
  console.log(`SQLite database: ${DB_PATH}`);
  console.log(`JSONL log: ${JSONL_PATH}`);
  console.log(`Handoff file: ${HANDOFF_MD}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await db.close();
  process.exit(0);
});
