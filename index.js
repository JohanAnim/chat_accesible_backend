const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');  // Para manejar rutas de archivos

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Crear el servidor HTTP
const server = http.createServer(app);

// Configurar Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const messages = [];
const activeUsers = {};

const MAX_MESSAGES = 1000;
const MESSAGE_LIFETIME = 5 * 60 * 1000; // 5 minutos en milisegundos

// Endpoint de prueba
app.get('/test', (req, res) => {
  res.send('Servidor de chat funcionando');
});

// Limpiar mensajes antiguos
const cleanupOldMessages = () => {
  const now = Date.now();
  while (messages.length > 0 && now - messages[0].timestamp > MESSAGE_LIFETIME) {
    messages.shift();
  }
};

setInterval(cleanupOldMessages, 60 * 1000);

// Manejar la conexión de los sockets
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  socket.on('setUser', (username) => {
    activeUsers[socket.id] = { username, id: socket.id };
    socket.emit('userId', socket.id);
    io.emit('updateUsers', Object.values(activeUsers));

    // Emitir evento de usuario conectado para todos los clientes
    socket.broadcast.emit('userConnected', username);

    // Emitir mensaje específico al usuario que se conecta
    socket.emit('userConnectedSelf', 'Te has conectado al chat.');
  });

  socket.emit('loadMessages', messages);

  socket.on('message', (msg) => {
    console.log('Mensaje recibido del cliente:', msg);

    const formattedMsg = {
      user: activeUsers[socket.id]?.username || 'Anónimo',
      id: activeUsers[socket.id]?.id || socket.id,
      text: msg.text || '',
      timestamp: Date.now()
    };

    if (messages.length >= MAX_MESSAGES) {
      messages.shift();
    }
    messages.push(formattedMsg);

    io.emit('message', formattedMsg);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    
    const username = activeUsers[socket.id]?.username;
    delete activeUsers[socket.id];
    io.emit('updateUsers', Object.values(activeUsers));

    // Emitir evento de usuario desconectado para todos los clientes
    if (username) {
      io.emit('userDisconnected', username);
    }
  });
});

// Redirigir a 'index.html' si no se encuentra ninguna ruta
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar el servidor en el puerto 80
const PORT = 80;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
