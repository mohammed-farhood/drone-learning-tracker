const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
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
    fs.writeFileSync(DB_PATH, JSON.stringify(newData, null, 2));
    
    // Broadcast change to all clients EXCEPT the sender
    const senderId = req.query.clientId;
    clients.forEach(client => {
      if (client.id !== senderId) {
        client.res.write(`data: ${JSON.stringify({ type: 'sync', data: newData })}\n\n`);
      }
    });

    res.json({ success: true });
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

app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 Drone Learning Tracker Server Running!`);
  console.log(`===========================================\n`);
  console.log(`Access on this computer: http://localhost:${PORT}`);
  console.log(`\nTo share securely over the internet:`);
  console.log(`1. Run this command in another terminal: ngrok http ${PORT}`);
  console.log(`2. Send the funny-looking ngrok link to your team.`);
  console.log(`\nData is saved to: ${DB_PATH}`);
  console.log(`===========================================\n`);
});
