import React, { useState } from 'react';
import { X, Key, ShieldCheck, ShieldAlert, RotateCcw, Download, Upload } from 'lucide-react';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  apiKey, 
  onSaveApiKey, 
  onResetData, 
  onExportData, 
  onImportData 
}) {
  const [keyInput, setKeyInput] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [importError, setImportError] = useState('');

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    onSaveApiKey(keyInput.trim());
    onClose();
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json.rawTexts || !json.contacts || !json.connections) {
          throw new Error("Invalid structure. Missing rawTexts, contacts, or connections.");
        }
        onImportData(json);
        setImportError('');
        onClose();
      } catch (err) {
        setImportError(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-title">
            <Key size={16} />
            <span>SETTINGS</span>
          </div>
          <button 
            onClick={onClose} 
            className="modal-close-btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="modal-body">
          {/* API Mode Indicator */}
          <div className="status-indicator-box">
            {apiKey ? (
              <>
                <ShieldCheck style={{ color: 'var(--text-primary)', strokeWidth: 1.5, marginTop: '2px' }} size={20} />
                <div className="status-indicator-content">
                  <span className="status-indicator-title">GEMINI API ACTIVE</span>
                  <span className="status-indicator-desc">All text uploads and queries are processed live using gemini-2.5-flash.</span>
                </div>
              </>
            ) : (
              <>
                <ShieldAlert style={{ color: 'var(--text-muted)', strokeWidth: 1.5, marginTop: '2px' }} size={20} />
                <div className="status-indicator-content">
                  <span className="status-indicator-title" style={{ color: 'var(--text-muted)' }}>OFFLINE MODE ACTIVE</span>
                  <span className="status-indicator-desc">No API Key configured. The CRM is running offline with simulated heuristics. Enter a key below to connect live.</span>
                </div>
              </>
            )}
          </div>

          {/* API Key Form */}
          <form onSubmit={handleSave} className="form-field">
            <label className="form-label">GEMINI API KEY</label>
            <div className="key-input-row">
              <input
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="text-input"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="btn"
              >
                {showKey ? "HIDE" : "SHOW"}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary">
                SAVE KEY
              </button>
            </div>
          </form>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-muted)' }} />

          {/* Backup & Tools */}
          <div className="form-field">
            <span className="modal-section-title">DATABASE MANAGEMENT</span>
            
            <div className="grid-2">
              {/* Export */}
              <button onClick={onExportData} className="btn">
                <Download size={14} />
                <span>Export JSON</span>
              </button>

              {/* Import */}
              <label className="btn" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                <span>Import JSON</span>
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImport} 
                  className="file-input-hidden" 
                />
              </label>
            </div>

            {importError && (
              <span style={{ fontSize: '9px', color: '#ef4444', fontWeight: 'bold' }}>{importError}</span>
            )}

            {/* Reset */}
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to wipe all contacts, logs, and connection files? This cannot be undone.")) {
                  onResetData();
                  onClose();
                }
              }}
              className="btn"
              style={{ borderStyle: 'dashed', color: 'var(--text-muted)', marginTop: '8px' }}
            >
              <RotateCcw size={14} />
              <span>Reset Database</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          ALL KNOWLEDGE STORED LOCALLY IN BROWSER
        </div>

      </div>
    </div>
  );
}
