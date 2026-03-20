const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ── MongoDB Connection ──
mongoose.connect('mongodb://localhost:27017/docsapp')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err));

// ── Document Schema ──
const docSchema = new mongoose.Schema({
  _id: String,
  content: { type: String, default: '' },
  title: { type: String, default: 'Untitled Document' },
  updatedAt: { type: Date, default: Date.now }
});

const Document = mongoose.model('Document', docSchema);

// ── Serve Frontend ──
app.use(express.static(path.join(__dirname)));
// ── Socket.io Logic ──
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Load or create document
  socket.on('get-document', async (docId) => {
    let doc = await Document.findById(docId);
    if (!doc) {
      doc = await Document.create({ _id: docId, content: '', title: 'Untitled Document' });
    }
    socket.join(docId);
    socket.emit('load-document', { content: doc.content, title: doc.title });

    // Receive and broadcast content changes
    socket.on('send-changes', (delta) => {
      socket.to(docId).emit('receive-changes', delta);
    });

    // Save content to MongoDB
    socket.on('save-document', async ({ content, title }) => {
      await Document.findByIdAndUpdate(docId, { content, title, updatedAt: Date.now() });
      socket.to(docId).emit('document-saved');
    });

    // Update title
    socket.on('update-title', async (title) => {
      await Document.findByIdAndUpdate(docId, { title });
      socket.to(docId).emit('title-updated', title);
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(4000, () => {
  console.log('Server running at http://localhost:4000');
});