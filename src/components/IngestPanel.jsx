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
    <div className="panel h-full" style={{ height: '100%' }}>
      <div className="panel-header">
        <div className="panel-header-title">
          <Upload size={13} />
          <span className="panel-title-text">INGEST</span>
        </div>
      </div>

      {/* Upload Input Area */}
      <form onSubmit={handleSubmit} className="panel-body" style={{ borderBottom: '1px solid var(--border-color)', gap: '12px' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          placeholder="Type or paste unstructured text about your contacts here... (e.g. 'Met John Doe today at Starbucks, he is Stripe Tech Lead and knows Sarah Connor...')"
          rows={5}
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

      <div className="logs-list-header">
        <BookOpen size={12} style={{ color: 'var(--text-secondary)' }} />
        <span className="panel-title-text" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          LOGS ({rawTexts.length})
        </span>
      </div>

      {/* Historical List */}
      <div className="logs-list-container">
        {rawTexts.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            No history. Upload a log above to begin building context.
          </div>
        ) : (
          [...rawTexts].reverse().map((log) => (
            <div key={log.id} className="log-item">
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
  );
}
