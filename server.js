import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'db.json');

// Middlewares
app.use(express.json({ limit: '10mb' }));

// Supabase Configuration Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log(`========================================`);
  console.log(`Supabase Cloud DB Engine ACTIVE`);
  console.log(`Connecting to: ${SUPABASE_URL}`);
  console.log(`========================================`);
} else {
  console.log(`========================================`);
  console.log(`Supabase credentials missing.`);
  console.log(`Running in Local Engine mode.`);
  console.log(`Local Database File: ${DB_PATH}`);
  console.log(`========================================`);
}

// Local Database Initialization (only used if running locally)
function initLocalDatabase() {
  if (supabase) return; // Skip if Supabase is active
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
      console.log(`Created database directory at: ${DB_DIR}`);
    }

    if (!fs.existsSync(DB_PATH)) {
      const defaultState = {
        rawTexts: [],
        contacts: [],
        connections: [],
        apiKey: ''
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(defaultState, null, 2), 'utf8');
      console.log(`Created default database file at: ${DB_PATH}`);
    }
  } catch (err) {
    console.error("Local database initialization failed:", err);
  }
}

initLocalDatabase();

// 1. Fetch entire database state (Cloud Supabase or Local JSON file)
app.get('/api/data', async (req, res) => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('crm_data')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) {
        // PGRST116: Single row not found -> seed a clean starting row in the database table
        if (error.code === 'PGRST116') {
          const defaultState = {
            id: 1,
            raw_texts: [],
            contacts: [],
            connections: [],
            api_key: ''
          };
          const { error: insertErr } = await supabase
            .from('crm_data')
            .insert(defaultState);
          
          if (insertErr) throw insertErr;
          
          return res.json({
            rawTexts: [],
            contacts: [],
            connections: [],
            apiKey: ''
          });
        }
        throw error;
      }
      
      res.json({
        rawTexts: data.raw_texts || [],
        contacts: data.contacts || [],
        connections: data.connections || [],
        apiKey: data.api_key || ''
      });
    } catch (err) {
      console.error("Supabase load error:", err.message);
      res.status(500).json({ error: 'Failed to read from cloud database.' });
    }
  } else {
    // Local File DB Fallback
    try {
      if (!fs.existsSync(DB_PATH)) {
        return res.status(404).json({ error: 'Database file not found.' });
      }
      const data = fs.readFileSync(DB_PATH, 'utf8');
      res.json(JSON.parse(data));
    } catch (err) {
      console.error("Local database read error:", err);
      res.status(500).json({ error: 'Failed to read local database.' });
    }
  }
});

// 2. Overwrite / sync entire database state (Cloud Supabase or Local JSON file)
app.post('/api/save', async (req, res) => {
  try {
    const { rawTexts, contacts, connections, apiKey } = req.body;
    
    if (!Array.isArray(rawTexts) || !Array.isArray(contacts) || !Array.isArray(connections)) {
      return res.status(400).json({ error: 'Invalid database layout. Arrays required.' });
    }

    if (supabase) {
      const payload = {
        id: 1,
        raw_texts: rawTexts,
        contacts: contacts,
        connections: connections,
        api_key: typeof apiKey === 'string' ? apiKey : ''
      };

      const { error } = await supabase
        .from('crm_data')
        .upsert(payload, { onConflict: 'id' });

      if (error) throw error;
      res.json({ success: true, message: 'Cloud database saved successfully.' });
    } else {
      // Local File DB Fallback
      const payload = {
        rawTexts,
        contacts,
        connections,
        apiKey: typeof apiKey === 'string' ? apiKey : ''
      };
      fs.writeFileSync(DB_PATH, JSON.stringify(payload, null, 2), 'utf8');
      res.json({ success: true, message: 'Local database saved successfully.' });
    }
  } catch (err) {
    console.error("Database save error:", err.message || err);
    res.status(500).json({ error: 'Failed to save database state.' });
  }
});

// Serve production static frontend if it has been built
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  console.log(`Serving frontend build files from: ${distPath}`);
}

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Contact.Web database backend active!`);
  console.log(`API URL: http://localhost:${PORT}/api`);
  console.log(`========================================`);
});
