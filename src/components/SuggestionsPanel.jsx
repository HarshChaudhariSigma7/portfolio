import React from 'react';
import { RefreshCw, Lightbulb, AlertCircle } from 'lucide-react';

export default function SuggestionsPanel({ suggestions, loading, onRefresh, hasTexts }) {
  return (
    <div className="panel select-none">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-header-title">
          <Lightbulb size={13} />
          <span className="panel-title-text">INSIGHTS</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="btn-icon"
          title="Refresh Insights"
        >
          <RefreshCw 
            size={12} 
            className={loading ? 'animate-spin' : ''} 
          />
        </button>
      </div>

      {/* Suggestions List */}
      <div className="panel-body" style={{ minHeight: '140px', justifyContent: 'center' }}>
        {loading ? (
          <div className="suggestions-empty">
            <RefreshCw size={18} className="animate-spin" />
            <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Analyzing relationship graph...</span>
          </div>
        ) : !hasTexts ? (
          <div className="suggestions-empty">
            <AlertCircle size={16} />
            <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>No logs uploaded yet</span>
            <span style={{ fontSize: '9px', opacity: 0.7, maxWidth: '200px' }}>Add unstructured contact logs to receive proactive network recommendations.</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="suggestions-empty">
            <span style={{ fontSize: '10px', textTransform: 'uppercase' }}>No suggestions available. Click refresh to query.</span>
          </div>
        ) : (
          <div className="suggestions-list">
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="suggestion-card">
                <span className="suggestion-card-num">{String(idx + 1).padStart(2, '0')}</span>
                <p className="suggestion-card-text">{suggestion}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      

    </div>
  );
}
