import React, { useState, useRef, useEffect } from 'react';
import { Send, Terminal, Loader2, ArrowRight } from 'lucide-react';

export default function QueryPanel({ onQuery, chatHistory, loading }) {
  const [query, setQuery] = useState('');
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, loading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    onQuery(query.trim());
    setQuery('');
  };

  const handleQuickPrompt = (promptText) => {
    if (loading) return;
    onQuery(promptText);
  };

  const quickPrompts = [
    "Who is connected to John?",
    "Find Stripe employees",
    "Summarize hiking interests"
  ];

  return (
    <div className="panel" style={{ flex: 1, minHeight: '300px' }}>
      {/* Header */}
      <div className="panel-header" style={{ userSelect: 'none' }}>
        <div className="panel-header-title">
          <Terminal size={13} />
          <span className="panel-title-text">CONTACT ASSISTANT</span>
        </div>
        <span style={{ fontSize: '8px', padding: '2px 6px', backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
          QA SHELL
        </span>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages-container">
        {chatHistory.length === 0 ? (
          <div className="chat-empty-state">
            <span style={{ fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold' }}>
              Interactive Query Shell
            </span>
            <span style={{ fontSize: '9px', opacity: 0.7, maxWidth: '220px', marginBottom: '16px' }}>
              Ask questions about relationships, job titles, or details from your notes.
            </span>
            
            {/* Quick Prompts */}
            <div className="quick-prompts-list">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickPrompt(p)}
                  className="btn-quick-prompt"
                >
                  <span>{p}</span>
                  <ArrowRight size={10} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatHistory.map((msg, idx) => (
            <div 
              key={idx} 
              className={`chat-message ${msg.role === 'user' ? 'chat-message-user' : ''}`}
            >
              <div className="chat-message-meta">
                <span>{msg.role === 'user' ? '↳ USER QUERY' : '↴ GEMINI RESPONSE'}</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
              <p className="chat-message-text">{msg.content}</p>
            </div>
          ))
        )}
        {loading && (
          <div className="chat-loading">
            <Loader2 size={12} className="animate-spin" />
            <span>Querying Database...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="chat-input-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your contacts..."
          disabled={loading}
          className="chat-text-input"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="chat-send-btn"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}
