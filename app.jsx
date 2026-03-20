const { useState, useEffect, useRef, useCallback } = React;

// Generate a random doc ID or get from URL
function getDocId() {
  const path = window.location.pathname.slice(1);
  if (path) return path;
  const id = Math.random().toString(36).substring(2, 10);
  window.history.pushState({}, '', `/${id}`);
  return id;
}

function App() {
  const [socket, setSocket] = useState(null);
  const [title, setTitle] = useState('Untitled Document');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(true);
  const [users, setUsers] = useState(1);
  const [docId] = useState(getDocId);
  const editorRef = useRef(null);
  const isRemoteChange = useRef(false);
  const saveTimer = useRef(null);

  // Connect socket
  useEffect(() => {
    const s = io();
    setSocket(s);
    s.emit('get-document', docId);

    s.on('load-document', ({ content, title }) => {
      setContent(content);
      setTitle(title);
      if (editorRef.current) editorRef.current.value = content;
    });

    s.on('receive-changes', (newContent) => {
      isRemoteChange.current = true;
      setContent(newContent);
      if (editorRef.current) {
        const pos = editorRef.current.selectionStart;
        editorRef.current.value = newContent;
        editorRef.current.selectionStart = pos;
        editorRef.current.selectionEnd = pos;
      }
    });

    s.on('title-updated', (newTitle) => setTitle(newTitle));
    s.on('document-saved', () => setSaved(true));

    return () => s.disconnect();
  }, [docId]);

  // Handle content change
  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    setSaved(false);
    if (socket) socket.emit('send-changes', val);

    // Auto-save after 1.5s of inactivity
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (socket) {
        socket.emit('save-document', { content: val, title });
        setSaved(true);
      }
    }, 1500);
  };

  // Handle title change
  const handleTitle = (e) => {
    setTitle(e.target.value);
    setSaved(false);
    if (socket) socket.emit('update-title', e.target.value);
  };

  // Manual save
  const handleSave = () => {
    if (socket) {
      socket.emit('save-document', { content, title });
      setSaved(true);
    }
  };

  // Share link
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Link copied! Share it to collaborate in real-time.');
  };

  // Word & char count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">📄 CollabDocs</div>
          <input
            className="title-input"
            value={title}
            onChange={handleTitle}
            placeholder="Untitled Document"
          />
        </div>
        <div className="header-right">
          <span className={`save-status ${saved ? 'saved' : 'unsaved'}`}>
            {saved ? '✓ Saved' : '● Unsaved'}
          </span>
          <button className="btn btn-outline" onClick={handleSave}>Save</button>
          <button className="btn btn-primary" onClick={handleShare}>Share</button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="doc-id">Doc ID: <code>{docId}</code></span>
        </div>
        <div className="toolbar-right">
          <span className="stat">{wordCount} words</span>
          <span className="stat">{charCount} chars</span>
        </div>
      </div>

      {/* Editor */}
      <div className="editor-wrap">
        <div className="page">
          <textarea
            ref={editorRef}
            className="editor"
            value={content}
            onChange={handleChange}
            placeholder="Start typing to collaborate in real-time..."
            spellCheck={true}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        Real-time collaborative editing · Changes sync instantly across all users
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);