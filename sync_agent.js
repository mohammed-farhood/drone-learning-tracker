const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'db.json');
// The HuggingFace URL
const HF_URL = 'https://mohammed-farhood-penguin.hf.space';

// Ensure db.json exists
if (!fs.existsSync(DB_PATH)) {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH));
  }
  fs.writeFileSync(DB_PATH, JSON.stringify({}));
}

let isSyncing = false;

async function syncWithCloud() {
  if (isSyncing) return;
  isSyncing = true;
  
  try {
    // 1. Read local state
    let localData = {};
    if (fs.existsSync(DB_PATH)) {
      try {
        localData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      } catch (e) {
        console.error("Local JSON parse error:", e);
      }
    }

    // 2. Fetch remote State
    let remoteData = {};
    try {
      const response = await fetch(`${HF_URL}/api/data`);
      if (response.ok) {
        remoteData = await response.json();
      }
    } catch (e) {
      console.log('Unable to reach HuggingFace (Space might be asleep/restarting). Will push local data when it wakes.');
    }

    // 3. Simple merge (local overrides remote if remote sends nothing/empty, else we push local data up to remote so remote can merge it!)
    // Actually, we can just POST our local data to HF_URL, because HF server.js already has incredible merge logic!
    // And any data HF had that we don't have, it will merge and return back to us in the response!
    
    // We do send our local data to HF
    const pushResponse = await fetch(`${HF_URL}/api/data?clientId=local-sync-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(localData)
    });

    if (pushResponse.ok) {
      const result = await pushResponse.json();
      // result.mergedData now contains HF's state combined with our local state.
      // 4. Save merged state to local DB as the ultimate truth.
      if (result && result.mergedData) {
        fs.writeFileSync(DB_PATH, JSON.stringify(result.mergedData, null, 2));
      }
      console.log(`[Sync Agent] Successfully synced with HuggingFace at ${new Date().toLocaleTimeString()}`);
    } else {
      console.error(`[Sync Agent] Failed to push data. Status: ${pushResponse.status}`);
    }

  } catch (err) {
    console.error(`[Sync Agent] Sync cycle failed: ${err.message}`);
  } finally {
    isSyncing = false;
  }
}

// Run immediately on start
console.log('Starting Local-to-Cloud Sync Agent...');
syncWithCloud();

// Run every 10 seconds
setInterval(syncWithCloud, 10000);
