import React, { useState } from 'react';
import { Upload, BookOpen, Trash2, Calendar, Plus } from 'lucide-react';

export default function IngestPanel({ onIngest, rawTexts, onDeleteLog, loading }) {
  const [text, setText] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || loading) return;
    onIngest(text.trim());
    setText('');
  };

  return (
    <div className="ingest-grid" style={{ height: '100%', padding: 0 }}>
      {/* Column 1: Ingest Form Card */}
      <div className="panel select-none" style={{ height: 'fit-content' }}>
        <div className="panel-header">
          <div className="panel-header-title">
            <Upload size={13} />
            <span className="panel-title-text">LOG INGEST</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="panel-body" style={{ gap: '12px' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={loading}
            placeholder="Type or paste unstructured text about your contacts here... (e.g. 'Met John Doe today at Starbucks, he is Stripe Tech Lead and knows Sarah Connor...')"
            rows={7}
            className="textarea-input"
          />
          <button
            type="submit"
            disabled={!text.trim() || loading}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {loading ? (
              <span className="animate-pulse">PARSING WITH GEMINI...</span>
            ) : (
              <>
                <Plus size={12} />
                <span>INGEST LOG</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Column 2: Log History Timeline Card */}
      <div className="panel" style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-header-title">
            <BookOpen size={13} />
            <span className="panel-title-text">HISTORICAL LOGS ({rawTexts.length})</span>
          </div>
        </div>

        {/* Historical List */}
        <div className="logs-list-container" style={{ flex: 1, overflowY: 'auto' }}>
          {rawTexts.length === 0 ? (
            <div style={{ padding: '48px 32px', textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              No history. Ingest a log on the left to start mapping.
            </div>
          ) : (
            [...rawTexts].reverse().map((log) => (
              <div key={log.id} className="log-item fade-in-up">
                {/* Date & Delete Button */}
                <div className="log-item-header">
                  <div className="log-item-date">
                    <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                  </div>
                  <button
                    onClick={() => onDeleteLog(log.id)}
                    disabled={loading}
                    className="btn-danger-link"
                    title="Delete Log"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
                
                {/* Text */}
                <p className="log-item-text select-text">
                  {log.text}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
