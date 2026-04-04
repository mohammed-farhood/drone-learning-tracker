const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// Ensure db.json exists
if (!fs.existsSync(DB_PATH)) {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH));
  }
  fs.writeFileSync(DB_PATH, JSON.stringify({}));
}

// Store connected SSE clients
let clients = [];

// Endpoint to get all data
app.get('/api/data', (req, res) => {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Error reading DB:', err);
    res.status(500).json({ error: 'Failed to read database' });
  }
});

// Endpoint to save all data
app.post('/api/data', (req, res) => {
  try {
    const newData = req.body;
    let currentData = {};
    if (fs.existsSync(DB_PATH)) {
      try { currentData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch(e){}
    }

    const mergedData = { ...currentData };

    if (newData.team_name && !mergedData.team_name) mergedData.team_name = newData.team_name;
    if (newData.start_date && !mergedData.start_date) mergedData.start_date = newData.start_date;

    if (newData.users && Array.isArray(newData.users)) {
      let usersMap = new Map();
      (mergedData.users || []).forEach(u => usersMap.set(u.id, u));
      newData.users.forEach(u => usersMap.set(u.id, u));
      mergedData.users = Array.from(usersMap.values());
    }

    if (newData.resources && Array.isArray(newData.resources)) {
      let resMap = new Map();
      (mergedData.resources || []).forEach(r => resMap.set(r.id, r));
      newData.resources.forEach(r => resMap.set(r.id, r));
      mergedData.resources = Array.from(resMap.values());
    }

    if (newData.announcements && Array.isArray(newData.announcements)) {
      let annMap = new Map();
      (mergedData.announcements || []).forEach(a => annMap.set(a.id, a));
      newData.announcements.forEach(a => annMap.set(a.id, a));
      mergedData.announcements = Array.from(annMap.values());
    }

    if (newData.manager_notes) {
      if (!mergedData.manager_notes) mergedData.manager_notes = {};
      Object.keys(newData.manager_notes).forEach(userId => {
        let notesMap = new Map();
        (mergedData.manager_notes[userId] || []).forEach(n => notesMap.set(n.id, n));
        (newData.manager_notes[userId] || []).forEach(n => notesMap.set(n.id, n));
        mergedData.manager_notes[userId] = Array.from(notesMap.values());
      });
    }

    if (newData.progress) {
      if (!mergedData.progress) mergedData.progress = {};
      Object.keys(newData.progress).forEach(userId => {
        if (!mergedData.progress[userId]) mergedData.progress[userId] = {};
        
        Object.keys(newData.progress[userId]).forEach(day => {
          const clientDay = newData.progress[userId][day];
          const serverDay = mergedData.progress[userId][day];
          
          if (!serverDay) {
            mergedData.progress[userId][day] = clientDay;
          } else {
            const clientTime = new Date(clientDay.updatedAt || clientDay.completedAt || 0).getTime();
            const serverTime = new Date(serverDay.updatedAt || serverDay.completedAt || 0).getTime();
            
            if (clientTime > serverTime) {
              mergedData.progress[userId][day] = clientDay;
            }
          }
        });
      });
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(mergedData, null, 2));
    
    // Broadcast change to all clients EXCEPT the sender
    const senderId = req.query.clientId;
    clients.forEach(client => {
      if (client.id !== senderId) {
        client.res.write(`data: ${JSON.stringify({ type: 'sync', data: mergedData })}\n\n`);
      }
    });

    res.json({ success: true, mergedData });
  } catch (err) {
    console.error('Error writing DB:', err);
    res.status(500).json({ error: 'Failed to write database' });
  }
});

// Endpoint for Server-Sent Events (SSE)
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // flush the headers to establish SSE

  const clientId = req.query.clientId || Date.now().toString();

  const newClient = {
    id: clientId,
    res
  };
  clients.push(newClient);

  req.on('close', () => {
    clients = clients.filter(client => client.id !== clientId);
  });
});

const HOST = '0.0.0.0'; 
app.listen(PORT, HOST, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 Penguin Tracker Server Running!`);
  console.log(`===========================================\n`);
  console.log(`Access on this computer: http://localhost:${PORT}`);
  console.log(`Access over Tailscale: http://100.104.114.34:${PORT}`);
  console.log(`\nIMPORTANT for users:`);
  console.log(`1. Ensure Tailscale is "Connected".`);
  console.log(`2. Use EXACTLY: http://100.104.114.34:${PORT}`);
  console.log(`3. MUST use 'http', not 'https'.`);
  console.log(`\nData is saved to: ${DB_PATH}`);
  console.log(`===========================================\n`);
});
