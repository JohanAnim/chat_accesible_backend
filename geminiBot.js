const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let chatHistory = [];

// Iniciar una nueva sesión de chat
const startChat = () => {
  chatHistory = [];
};

// Enviar un mensaje al modelo
const sendMessage = async (userMessage) => {
  try {
    // Agregar el mensaje del usuario al historial (sin el campo username)
    chatHistory.push({ role: "user", parts: [{ text: userMessage }] });

    // Configurar la sesión de chat
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: { maxOutputTokens: 150 }
    });

    // Enviar el mensaje al modelo y obtener la respuesta
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    
    const responseText = response.text();
    chatHistory.push({ role: "model", parts: [{ text: responseText }] });

    return responseText;
  } catch (error) {
    console.error("Error al enviar el mensaje al modelo:", error);

    // Si ocurre un error, reiniciar el bot y conservar el historial del chat
    startChat(); // Reiniciar la sesión de chat
    return "Lo siento, no puedo procesar tu solicitud en este momento. El bot ha sido reiniciado.";
  }
};

// Obtener el historial de chat
const getChatHistory = () => {
  return chatHistory;
};

module.exports = {
  startChat,
  sendMessage,
  getChatHistory,
};
