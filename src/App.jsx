import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Trash2, UserPlus, Info, Check, Sparkles, X, Share2, FileText, MessageSquare } from 'lucide-react';
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

  // 1. Initialize data from backend database, fallback to localstorage or empty arrays
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error("Backend API returned error status");
        
        const data = await res.json();
        
        // If backend database exists but is completely empty (e.g. brand new DB file)
        // check if we have localStorage we can import/sync, otherwise start empty
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
            // First run: start completely empty!
            setRawTexts([]);
            setContacts([]);
            setConnections([]);
            saveToBackend([], [], [], apiKey);
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
          // Start empty
          setRawTexts([]);
          setContacts([]);
          setConnections([]);
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
      {/* Background Animated Glow Orbs */}
      <div className="glow-orb orb-1" />
      <div className="glow-orb orb-2" />
      
      {/* Top Header Navigation */}
      <header className="app-header select-none">
        <div className="header-logo-group">
          <h1 className="header-logo">
            CONTACT.WEB
          </h1>
        </div>

        {/* Database Quick Stats */}
        <div className="header-stats">
          <span>{rawTexts.length} Logs</span>
          <span className="header-stats-divider">•</span>
          <span>{contacts.length} Contacts</span>
          <span className="header-stats-divider">•</span>
          <span>{connections.length} Links</span>
        </div>

        {/* Action Controls */}
        <div className="header-actions">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="btn-icon"
            title="Toggle theme"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button 
            onClick={() => setSettingsOpen(true)}
            className="btn-icon"
            title="Open settings"
          >
            <Settings size={18} />
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
        {/* Left Navigation Sidebar for Desktop */}
        <aside className="nav-sidebar mobile-hidden">
          <button
            onClick={() => setActiveTab('network')}
            className={`nav-sidebar-btn ${activeTab === 'network' ? 'active' : ''}`}
            title="Network Map"
          >
            <Share2 size={24} />
            <span className="nav-sidebar-label">Network</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`nav-sidebar-btn ${activeTab === 'logs' ? 'active' : ''}`}
            title="Logs & Ingest"
          >
            <FileText size={24} />
            <span className="nav-sidebar-label">Ingest</span>
          </button>
          <button
            onClick={() => setActiveTab('assistant')}
            className={`nav-sidebar-btn ${activeTab === 'assistant' ? 'active' : ''}`}
            title="AI Assistant"
          >
            <MessageSquare size={24} />
            <span className="nav-sidebar-label">Chat</span>
          </button>
        </aside>

        {/* Viewport for Active Tab Content */}
        <div className="viewport-content">
          {activeTab === 'network' && (
            <div className="fade-in-up" style={{ flex: 1, height: '100%' }}>
              <ContactWeb 
                contacts={contacts} 
                connections={connections} 
                onSelectContact={setSelectedContact}
              />
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="fade-in-up" style={{ height: '100%' }}>
              <IngestPanel 
                onIngest={handleIngest} 
                rawTexts={rawTexts} 
                onDeleteLog={handleDeleteLog}
                loading={ingestLoading}
              />
            </div>
          )}

          {activeTab === 'assistant' && (
            <div className="assistant-grid fade-in-up">
              <QueryPanel 
                onQuery={handleChatQuery} 
                chatHistory={chatHistory} 
                loading={chatLoading}
              />
              <SuggestionsPanel 
                suggestions={suggestions} 
                loading={suggestionsLoading} 
                onRefresh={() => triggerSuggestions()}
                hasTexts={rawTexts.length > 0}
              />
            </div>
          )}
        </div>
      </main>

      {/* Slide-out Contact Profile Drawer */}
      <div 
        className={`profile-drawer-backdrop ${selectedContact ? 'open' : ''}`} 
        onClick={() => setSelectedContact(null)}
      />
      <div className={`profile-drawer ${selectedContact ? 'open' : ''}`}>
        {selectedContact && (
          <>
            <div className="profile-card-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>PROFILE DETAIL</span>
              <button 
                onClick={() => setSelectedContact(null)} 
                className="modal-close-btn"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <X size={18} style={{ color: 'var(--text-primary)' }} />
              </button>
            </div>
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1 }} className="select-text">
              <div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '-0.02em', marginBottom: '4px', color: 'var(--text-primary)' }}>
                  {selectedContact.name}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                  {selectedContact.role || "No Role Specified"}
                  {selectedContact.company ? ` • ${selectedContact.company}` : ''}
                </div>
              </div>

              {selectedContact.notes ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Extracted Context</span>
                  <p style={{ fontSize: '12px', lineHeight: '1.6', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', backgroundColor: 'var(--bg-tertiary)', padding: '16px', border: '1px solid var(--border-muted)' }}>
                    {selectedContact.notes}
                  </p>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', fontFamily: 'var(--font-sans)' }}>
                  No additional notes extracted for this contact.
                </div>
              )}
            </div>
          </>
        )}
      </div>

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
