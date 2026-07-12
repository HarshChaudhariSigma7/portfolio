import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Trash2, UserPlus, Info, Check, Sparkles, X } from 'lucide-react';
import IngestPanel from './components/IngestPanel';
import ContactWeb from './components/ContactWeb';
import SuggestionsPanel from './components/SuggestionsPanel';
import QueryPanel from './components/QueryPanel';
import SettingsModal from './components/SettingsModal';
import { 
  parseUnstructuredText, 
  getProactiveSuggestions, 
  askQuestion 
} from './utils/geminiService';

// Sample data for initial load
const MOCK_INITIAL_LOGS = [
  { id: 'log-1', text: "Met John Doe at a Stripe coffee mixer. He is a Tech Lead there. He mentioned he is looking for a UI designer and works closely with Sarah Connor.", timestamp: Date.now() - 86400000 * 3 },
  { id: 'log-2', text: "Sarah Connor is a Product Manager at Stripe. John's coworker. She is really passionate about AI safety and works with Miles Dyson on a research project.", timestamp: Date.now() - 86400000 * 2 },
  { id: 'log-3', text: "Miles Dyson is the Director of Systems at Cyberdyne. Sarah Connor works with him. He's leading the neural net processor project.", timestamp: Date.now() - 86400000 * 1 },
  { id: 'log-4', text: "Alice Smith works at Vercel in DevRel. Met her at JS Conf. She knows John Doe from college and is a genius at frontend performance.", timestamp: Date.now() - 86400000 * 0.5 }
];

const MOCK_INITIAL_CONTACTS = [
  { name: "John Doe", company: "Stripe", role: "Tech Lead", notes: "Loves hiking, looking for a UI designer. Friends with Sarah Connor." },
  { name: "Sarah Connor", company: "Stripe", role: "Product Manager", notes: "John's coworker. Passionate about AI safety. Works with Miles Dyson." },
  { name: "Miles Dyson", company: "Cyberdyne", role: "Director of Systems", notes: "Sarah's contact. Leading the neural net processor project." },
  { name: "Alice Smith", company: "Vercel", role: "DevRel", notes: "Met at JS Conf. Expert in frontend perf. Knows John Doe from college." }
];

const MOCK_INITIAL_CONNECTIONS = [
  { from: "John Doe", to: "Sarah Connor", type: "Colleague" },
  { from: "Sarah Connor", to: "Miles Dyson", type: "Collaborator" },
  { from: "Alice Smith", to: "John Doe", type: "College Friend" }
];

export default function App() {
  // Theme and UI layout states
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('network'); // 'network', 'logs', 'assistant' (mobile responsive tabs)
  
  // Data states
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [rawTexts, setRawTexts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [connections, setConnections] = useState([]);
  
  // Selection/Interaction states
  const [selectedContact, setSelectedContact] = useState(null);
  
  // Gemini status states
  const [suggestions, setSuggestions] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Save changes to Express database backend
  const saveToBackend = async (newLogs, newContacts, newConnections, newApiKey = apiKey) => {
    try {
      const res = await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTexts: newLogs,
          contacts: newContacts,
          connections: newConnections,
          apiKey: newApiKey
        })
      });
      if (!res.ok) throw new Error("Save request failed");
    } catch (err) {
      console.warn("Failed to write to Express backend database:", err);
    }
  };

  // 1. Initialize data from backend database, fallback to localstorage or mock
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error("Backend API returned error status");
        
        const data = await res.json();
        
        // If backend database exists but is completely empty (e.g. brand new DB file)
        // check if we have localStorage we can import/sync, otherwise populate initial mocks
        if (data.rawTexts.length === 0 && data.contacts.length === 0) {
          const storedLogs = localStorage.getItem('crm_raw_texts');
          const storedContacts = localStorage.getItem('crm_contacts');
          const storedConnections = localStorage.getItem('crm_connections');
          const storedApiKey = localStorage.getItem('gemini_api_key');
          
          if (storedLogs && storedContacts && storedConnections) {
            const localRaw = JSON.parse(storedLogs);
            const localContacts = JSON.parse(storedContacts);
            const localConns = JSON.parse(storedConnections);
            const localKey = storedApiKey || '';
            
            setRawTexts(localRaw);
            setContacts(localContacts);
            setConnections(localConns);
            setApiKey(localKey);
            
            // Sync to backend database immediately so it populates
            saveToBackend(localRaw, localContacts, localConns, localKey);
          } else {
            // First run, populate mock
            setRawTexts(MOCK_INITIAL_LOGS);
            setContacts(MOCK_INITIAL_CONTACTS);
            setConnections(MOCK_INITIAL_CONNECTIONS);
            saveToBackend(MOCK_INITIAL_LOGS, MOCK_INITIAL_CONTACTS, MOCK_INITIAL_CONNECTIONS, apiKey);
          }
        } else {
          // Set state from backend database
          setRawTexts(data.rawTexts);
          setContacts(data.contacts);
          setConnections(data.connections);
          setApiKey(data.apiKey || '');
          if (data.apiKey) {
            localStorage.setItem('gemini_api_key', data.apiKey);
          }
        }
        
        showToast("Connected to local database file");
      } catch (err) {
        console.warn("Could not connect to database backend, falling back to local storage:", err);
        // Standard localStorage fallback
        const storedLogs = localStorage.getItem('crm_raw_texts');
        const storedContacts = localStorage.getItem('crm_contacts');
        const storedConnections = localStorage.getItem('crm_connections');
        const storedApiKey = localStorage.getItem('gemini_api_key');

        if (storedLogs && storedContacts && storedConnections) {
          setRawTexts(JSON.parse(storedLogs));
          setContacts(JSON.parse(storedContacts));
          setConnections(JSON.parse(storedConnections));
          setApiKey(storedApiKey || '');
        } else {
          setRawTexts(MOCK_INITIAL_LOGS);
          setContacts(MOCK_INITIAL_CONTACTS);
          setConnections(MOCK_INITIAL_CONNECTIONS);
        }
        showToast("Offline mode (LocalStorage active)");
      }
      
      // Load suggestions / chat cache
      const storedSuggestions = localStorage.getItem('crm_suggestions');
      const storedChat = localStorage.getItem('crm_chat_history');
      if (storedSuggestions) setSuggestions(JSON.parse(storedSuggestions));
      if (storedChat) setChatHistory(JSON.parse(storedChat));
    }
    
    loadData();
  }, []);

  // 2. React to theme settings
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // 3. Proactive suggestions on load
  useEffect(() => {
    if (rawTexts.length > 0 && suggestions.length === 0) {
      triggerSuggestions(rawTexts);
    }
  }, [rawTexts.length]);

  // Toast notification helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Trigger Proactive Suggestions API
  const triggerSuggestions = async (currentTexts = rawTexts) => {
    setSuggestionsLoading(true);
    try {
      const result = await getProactiveSuggestions(apiKey, currentTexts);
      setSuggestions(result);
      localStorage.setItem('crm_suggestions', JSON.stringify(result));
    } catch (err) {
      showToast("Suggestions update failed");
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // Ingest new unstructured text log
  const handleIngest = async (text) => {
    setIngestLoading(true);
    showToast("Processing text details...");
    try {
      const parsed = await parseUnstructuredText(apiKey, text, contacts, connections);
      
      const newLog = {
        id: `log-${Date.now()}`,
        text: text,
        timestamp: Date.now()
      };
      
      const updatedLogs = [...rawTexts, newLog];
      
      // Merge parsed contacts and deduplicate names
      const updatedContacts = [...contacts];
      parsed.contacts.forEach(newC => {
        const idx = updatedContacts.findIndex(c => c.name.toLowerCase() === newC.name.toLowerCase());
        if (idx !== -1) {
          updatedContacts[idx] = {
            ...updatedContacts[idx],
            company: newC.company !== "Unknown" && newC.company ? newC.company : updatedContacts[idx].company,
            role: newC.role !== "Unknown" && newC.role ? newC.role : updatedContacts[idx].role,
            notes: `${updatedContacts[idx].notes} | ${newC.notes}`
          };
        } else {
          updatedContacts.push(newC);
        }
      });

      // Merge connections, avoid exact duplicates
      const updatedConnections = [...connections];
      parsed.connections.forEach(newConn => {
        const exists = updatedConnections.some(conn => 
          (conn.from.toLowerCase() === newConn.from.toLowerCase() && conn.to.toLowerCase() === newConn.to.toLowerCase()) ||
          (conn.from.toLowerCase() === newConn.to.toLowerCase() && conn.to.toLowerCase() === newConn.from.toLowerCase())
        );
        if (!exists) {
          updatedConnections.push(newConn);
        }
      });

      // Update state and localStorage
      setRawTexts(updatedLogs);
      setContacts(updatedContacts);
      setConnections(updatedConnections);
      
      localStorage.setItem('crm_raw_texts', JSON.stringify(updatedLogs));
      localStorage.setItem('crm_contacts', JSON.stringify(updatedContacts));
      localStorage.setItem('crm_connections', JSON.stringify(updatedConnections));

      // Sync to Express database backend
      saveToBackend(updatedLogs, updatedContacts, updatedConnections, apiKey);

      showToast("Context successfully ingested!");

      // Update proactive suggestions dynamically based on new context
      triggerSuggestions(updatedLogs);
    } catch (err) {
      console.error(err);
      showToast("Ingestion failed: " + err.message);
    } finally {
      setIngestLoading(false);
    }
  };

  // Delete specific log entry
  const handleDeleteLog = (id) => {
    const updatedLogs = rawTexts.filter(l => l.id !== id);
    setRawTexts(updatedLogs);
    localStorage.setItem('crm_raw_texts', JSON.stringify(updatedLogs));
    
    // Sync to Express database backend
    saveToBackend(updatedLogs, contacts, connections, apiKey);
    
    triggerSuggestions(updatedLogs);
    showToast("Log deleted");
  };

  // Submit search query chat
  const handleChatQuery = async (query) => {
    setChatLoading(true);
    const newChatMsg = {
      role: 'user',
      content: query,
      timestamp: Date.now()
    };
    
    const updatedHistory = [...chatHistory, newChatMsg];
    setChatHistory(updatedHistory);
    localStorage.setItem('crm_chat_history', JSON.stringify(updatedHistory));

    try {
      const response = await askQuestion(apiKey, query, rawTexts, contacts, connections);
      const systemMsg = {
        role: 'system',
        content: response,
        timestamp: Date.now()
      };
      const finalHistory = [...updatedHistory, systemMsg];
      setChatHistory(finalHistory);
      localStorage.setItem('crm_chat_history', JSON.stringify(finalHistory));
    } catch (err) {
      showToast("Chat query failed");
    } finally {
      setChatLoading(false);
    }
  };

  // Save Settings
  const handleSaveApiKey = (key) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gemini_api_key', key);
      showToast("API Key Saved");
    } else {
      localStorage.removeItem('gemini_api_key');
      showToast("Switched to Offline Demo Mode");
    }
    
    // Sync API Key to Express database backend
    saveToBackend(rawTexts, contacts, connections, key);
    
    setTimeout(() => triggerSuggestions(), 200);
  };

  // Wipe databases
  const handleResetData = () => {
    localStorage.removeItem('crm_raw_texts');
    localStorage.removeItem('crm_contacts');
    localStorage.removeItem('crm_connections');
    localStorage.removeItem('crm_suggestions');
    localStorage.removeItem('crm_chat_history');
    setRawTexts([]);
    setContacts([]);
    setConnections([]);
    setSuggestions([]);
    setChatHistory([]);
    setSelectedContact(null);
    
    // Sync wipe to Express database backend
    saveToBackend([], [], [], apiKey);
    
    showToast("Database completely reset");
  };

  // Export CRM JSON
  const handleExportData = () => {
    const exportObj = {
      rawTexts,
      contacts,
      connections
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `crm_web_backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("Data exported");
  };

  // Import CRM JSON
  const handleImportData = (importedJson) => {
    setRawTexts(importedJson.rawTexts);
    setContacts(importedJson.contacts);
    setConnections(importedJson.connections);
    localStorage.setItem('crm_raw_texts', JSON.stringify(importedJson.rawTexts));
    localStorage.setItem('crm_contacts', JSON.stringify(importedJson.contacts));
    localStorage.setItem('crm_connections', JSON.stringify(importedJson.connections));
    
    setChatHistory([]);
    localStorage.removeItem('crm_chat_history');
    
    // Sync to Express database backend
    saveToBackend(importedJson.rawTexts, importedJson.contacts, importedJson.connections, apiKey);
    
    triggerSuggestions(importedJson.rawTexts);
    showToast("Database successfully imported!");
  };

  return (
    <div className="app-container">
      
      {/* Top Header Navigation */}
      <header className="app-header select-none">
        <div className="header-logo-group">
          <h1 className="header-logo">
            CONTACT.WEB
          </h1>
          <span className="header-tagline">
            B&W MINIMAL CRM SYSTEM
          </span>
        </div>

        {/* Database Quick Stats */}
        <div className="header-stats">
          <span>LOGS: {rawTexts.length}</span>
          <span className="header-stats-divider">|</span>
          <span>CONTACTS: {contacts.length}</span>
          <span className="header-stats-divider">|</span>
          <span>CONNECTIONS: {connections.length}</span>
        </div>

        {/* Action Controls */}
        <div className="header-actions">
          {!apiKey && (
            <span className="mode-badge">
              Demo Mode
            </span>
          )}

          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="btn-icon"
            title="Toggle theme"
          >
            {darkMode ? <Sun size={12} /> : <Moon size={12} />}
          </button>

          <button 
            onClick={() => setSettingsOpen(true)}
            className="btn-icon"
            title="Open settings"
          >
            <Settings size={12} />
          </button>
        </div>
      </header>

      {/* Mobile Responsive Navigation Tabs */}
      <div className="mobile-tabs font-mono">
        <button 
          onClick={() => setActiveTab('network')}
          className={`tab-btn ${activeTab === 'network' ? 'active' : ''}`}
        >
          Network Map
        </button>
        <button 
          onClick={() => setActiveTab('logs')}
          className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
        >
          Logs ({rawTexts.length})
        </button>
        <button 
          onClick={() => setActiveTab('assistant')}
          className={`tab-btn ${activeTab === 'assistant' ? 'active' : ''}`}
        >
          Intelligence
        </button>
      </div>

      {/* Main Content Workspace Layout */}
      <main className="app-main">
        
        {/* LEFT COLUMN: Ingest & History logs */}
        <div className={`sidebar-left ${activeTab === 'logs' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <IngestPanel 
            onIngest={handleIngest} 
            rawTexts={rawTexts} 
            onDeleteLog={handleDeleteLog}
            loading={ingestLoading}
          />
        </div>

        {/* CENTER COLUMN: Contact Relationship Canvas */}
        <div className={`canvas-wrapper ${activeTab === 'network' ? 'mobile-visible' : 'mobile-hidden'}`}>
          <ContactWeb 
            contacts={contacts} 
            connections={connections} 
            onSelectContact={setSelectedContact}
          />
        </div>

        {/* RIGHT COLUMN: Intelligence Assistant Sidebar */}
        <div className={`sidebar-right ${activeTab === 'assistant' ? 'mobile-visible' : 'mobile-hidden'}`}>
          
          {/* Selected Contact Card */}
          {selectedContact && (
            <div className="profile-card">
              <div className="profile-card-header">
                <span>Selected Profile</span>
                <button 
                  onClick={() => setSelectedContact(null)} 
                  className="modal-close-btn"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="profile-card-body">
                <div>
                  <div className="profile-name">{selectedContact.name}</div>
                  <div className="profile-meta">
                    {selectedContact.role || "No Role"} {selectedContact.company ? `@ ${selectedContact.company}` : ''}
                  </div>
                </div>
                {selectedContact.notes && (
                  <div className="profile-notes-box">
                    <span className="profile-notes-label">Extracted Details:</span>
                    <p className="profile-notes-text">{selectedContact.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Suggestions Panel */}
          <SuggestionsPanel 
            suggestions={suggestions} 
            loading={suggestionsLoading} 
            onRefresh={() => triggerSuggestions()}
            hasTexts={rawTexts.length > 0}
          />

          {/* Query QA Chat Panel */}
          <QueryPanel 
            onQuery={handleChatQuery} 
            chatHistory={chatHistory} 
            loading={chatLoading}
          />
        </div>
      </main>

      {/* Global Status/Toast Notification Banner */}
      {toastMessage && (
        <div className="toast">
          <Check size={12} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Settings Modal Overlay */}
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={handleSaveApiKey}
        onResetData={handleResetData}
        onExportData={handleExportData}
        onImportData={handleImportData}
      />
    </div>
  );
}
