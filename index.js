const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { startChat, sendMessage } = require('./geminiBot'); // Importa la lógica del bot

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Crear el servidor HTTP
const server = http.createServer(app);

// Configurar Socket.IO con soporte de CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const messages = [];
const activeUsers = {};

// Añadir el bot a los usuarios activos
const botUsername = "Bot"; // Nombre del bot
const botId = "bot"; // ID del bot
activeUsers[botId] = { username: botUsername, id: botId };

// Iniciar el chat del bot
startChat();


// Endpoint de prueba
app.get('/test', (req, res) => {
  res.send('Servidor de chat funcionando');
});

// Ruta para vaciar todos los mensajes
app.delete('/messages', (req, res) => {
  messages.length = 0; // Vaciar el array de mensajes
  io.emit('messagesCleared'); // Emitir evento a todos los clientes
  res.sendStatus(204); // Sin contenido
});

// Manejar la conexión de los sockets
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  // Registrar un nuevo usuario y asignar un ID
  socket.on('setUser', (username) => {
    activeUsers[socket.id] = { username, id: socket.id };
    socket.emit('userId', socket.id);
    io.emit('updateUsers', Object.values(activeUsers));

    // Emitir evento de usuario conectado para todos los clientes
    socket.broadcast.emit('userConnected', username);
    socket.emit('userConnectedSelf', 'Te has conectado al chat.');
  });

  // Cargar los mensajes existentes
  socket.emit('loadMessages', messages);

  // Manejar el envío de un mensaje
  socket.on('message', async (msg) => {
    console.log('Mensaje recibido del cliente:', msg);

    const formattedMsg = {
      user: activeUsers[socket.id]?.username || 'Anónimo',
      id: activeUsers[socket.id]?.id || socket.id,
      text: msg.text || '',
      timestamp: Date.now()
    };

    // Agregar el mensaje al historial
    messages.push(formattedMsg);

    // Emitir evento de mensaje enviado al propio usuario
    socket.emit('messageSent', formattedMsg);
    // Emitir evento de mensaje recibido para todos los demás usuarios
    socket.broadcast.emit('messageReceived', formattedMsg);

    // Verificar si hay mensajes de otros usuarios
    const lastUserMsg = messages[messages.length - 1]?.user !== botUsername ? messages[messages.length - 1] : null;

    if (lastUserMsg && (msg.text.includes(botUsername) || msg.text.endsWith("?"))) {
      try {
        // Preparar el historial del chat para el bot
        const context = messages.map(m => `${m.user}: ${m.text}`).join('\n');

        // Obtener los usuarios activos para pasarlos al bot
        const activeUsersList = Object.values(activeUsers)
          .map(user => `@${user.username || "Anónimo"}`)
          .join(", ");

        // Crear un prompt para que el bot actúe como un humano
        const prompt = `
          Eres un usuario humano en un chat público. 
          Debes responder como un humano normal y jamás debes decir que eres un bot o una IA. 
          Eres un experto en programación y puedes hablar sobre tus gustos, como tu comida favorita y dónde vives.
          Estos son los mensajes previos en el chat:
          ${context}
          
          Los usuarios activos son: ${activeUsersList}. 
          Debes recordar estos nombres y tratarlos de forma natural. 
          Aquí está el nuevo mensaje que debes responder: "${msg.text}".
        `;

        // Revisar si el usuario mencionó su nombre para que el bot lo recuerde
        if (msg.text.toLowerCase().includes("me llamo")) {
          const name = msg.text.split("me llamo")[1].trim();
          activeUsers[socket.id].username = name;
          const botResponse = {
            user: botUsername,
            id: botId,
            text: `¡Gracias, @${name}! A partir de ahora, recordaré tu nombre.`,
            timestamp: Date.now()
          };
          messages.push(botResponse);
          io.emit('messageReceived', botResponse);
          return;
        }

        // Pasar el nuevo prompt al bot
        const userInfo = activeUsers[socket.id]?.username || "Anónimo";
        const responseText = await sendMessage(prompt, context, userInfo);

        // Crear la respuesta del bot
        const botResponse = {
          user: botUsername,
          id: botId,
          text: responseText.replace(/@/g, "@"), // Asegurarse de que el bot use @ antes de los nombres
          timestamp: Date.now()
        };

        messages.push(botResponse);
        io.emit('messageReceived', botResponse); // Emitir el mensaje del bot a todos los clientes
      } catch (error) {
        console.error("Error en la respuesta del bot:", error);
      }
    }
  });

  // Manejar la desconexión de un cliente
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);

    const username = activeUsers[socket.id]?.username;
    delete activeUsers[socket.id];
    io.emit('updateUsers', Object.values(activeUsers));

    // Emitir evento de usuario desconectado
    if (username) {
      socket.broadcast.emit('userDisconnected', username);
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
