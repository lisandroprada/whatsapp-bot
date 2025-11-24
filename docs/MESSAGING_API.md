# Guía de API de Mensajería en Tiempo Real

## 1. Introducción

Este documento está dirigido al equipo de frontend y describe cómo interactuar con el backend para implementar una funcionalidad de chat completa, similar a la de WhatsApp. La guía cubre la obtención de chats y mensajes, el envío de nuevos mensajes y la recepción de actualizaciones en tiempo real.

**Requisito previo:** La aplicación frontend ya debe tener un cliente de WhatsApp conectado y autenticado, siguiendo la `FRONTEND_INTEGRATION.md`.

## 2. Visión General del Flujo de Mensajería

1.  **Cargar la Lista de Chats**: Al iniciar la sección de mensajería, el frontend debe solicitar la lista completa de chats del usuario.
2.  **Seleccionar un Chat**: El usuario selecciona un chat de la lista.
3.  **Cargar Historial de Mensajes**: El frontend solicita todos los mensajes históricos para el chat seleccionado.
4.  **Enviar un Mensaje**: El usuario escribe y envía un mensaje. El frontend envía esta información al backend a través de una petición `POST`.
5.  **Recibir un Mensaje (Tiempo Real)**: Cuando un contacto envía un mensaje, el backend lo recibe y lo retransmite inmediatamente a todos los clientes frontend conectados a través de un evento de WebSocket. El frontend debe "escuchar" este evento y añadir el mensaje a la conversación correspondiente sin necesidad de recargar la página.

## 3. API de Mensajería (REST)

Todos los endpoints de esta sección están protegidos y requieren la cabecera `x-api-key` para ser utilizados. Consulta la guía de autenticación para más detalles.

### 3.1. Obtener Lista de Chats

Este endpoint devuelve un array con todos los chats del usuario, ordenados por el mensaje más reciente.

-   **Método**: `GET`
-   **Ruta**: `/whatsapp/chats`
-   **Respuesta Exitosa (200 OK)**: `Array<Chat>`

**Estructura del objeto `Chat`:**

```json
{
  "_id": "64f8c6e3a3b5e3e3a3b5e3e3",
  "jid": "5491122334455@s.whatsapp.net", // ID único del chat/usuario
  "name": "Nombre del Contacto",
  "unreadCount": 2, // Número de mensajes no leídos
  "lastMessage": { ... }, // Objeto del último mensaje (ver estructura abajo)
  "createdAt": "2023-09-06T15:43:23.996Z",
  "updatedAt": "2023-09-06T15:55:10.123Z"
}
```

### 3.2. Obtener Historial de Mensajes de un Chat

Devuelve un array con todos los mensajes de un chat específico, ordenados por fecha.

-   **Método**: `GET`
-   **Ruta**: `/whatsapp/messages/:jid`
-   **Parámetro de URL**:
    -   `:jid`: El `jid` del chat que se quiere consultar (obtenido del objeto `Chat`).
-   **Respuesta Exitosa (200 OK)**: `Array<Message>`

**Estructura del objeto `Message`:**

El contenido de los campos `type` y `content` varía según el tipo de mensaje.

**Ejemplo de Mensaje de Texto:**
```json
{
  "_id": "64f8c6a0a3b5e3e3a3b5e3a0",
  "fromMe": false,
  "type": "conversation",
  "content": "Hola, ¿cómo estás?",
  // ...otros campos
}
```

**Ejemplo de Mensaje de Imagen:**
```json
{
  "_id": "64f8c7b3a3b5e3e3a3b5e3b1",
  "fromMe": false,
  "type": "imageMessage",
  "content": "/media/1662492833.jpeg", // URL local al archivo servido por el backend
  // ...otros campos
}
```

**Ejemplo de Mensaje de Audio (¡Nuevo!):**
```json
{
  "_id": "64f8c8a3a3b5e3e3a3b5e3c2",
  "fromMe": false,
  "type": "audioMessage",
  "content": "/media/1662493844.ogg", // URL local al archivo de audio
  // ...otros campos
}
```

### 3.3. Enviar un Mensaje de Texto

-   **Método**: `POST`
-   **Ruta**: `/whatsapp/message/send/text`
-   **Cuerpo de la Petición (Body)**: `SendMessageDto`

    ```json
    {
      "to": "5491122334455@s.whatsapp.net", // El `jid` del destinatario
      "text": "Este es mi mensaje de prueba."
    }
    ```

### 3.4. Enviar un Archivo Multimedia

-   **Método**: `POST`
-   **Ruta**: `/whatsapp/message/send/media`
-   **Cuerpo de la Petición (Body)**: `SendMediaDto`

    ```json
    {
      "to": "5491122334455@s.whatsapp.net",
      "caption": "Mira esta foto",
      "mediaUrl": "https://example.com/image.jpg", // URL pública del archivo
      "mediaType": "image" // Puede ser 'image', 'video', o 'document'
    }
    ```

## 4. Gestión de Sesión (Desconexión y Cierre)

El backend ofrece dos maneras de manejar el cierre de una sesión. Ambos endpoints están protegidos y requieren la cabecera `x-api-key`.

### 4.1. Desconexión Temporal

Esta opción desconecta la sesión de WhatsApp pero **conserva las credenciales** en la base de datos. Permite una reconexión rápida en el futuro sin necesidad de escanear el QR de nuevo.

-   **Método**: `POST`
-   **Ruta**: `/whatsapp/session/disconnect`

### 4.2. Cierre de Sesión Completo (Logout)

Esta opción **cierra la sesión y borra las credenciales** de la base de datos. La próxima vez que el usuario quiera conectarse, deberá escanear un nuevo código QR. Este es el método que se debe usar para una funcionalidad de "Cerrar Sesión" o "Logout".

-   **Método**: `POST`
-   **Ruta**: `/whatsapp/session/clear`

## 5. Recepción de Mensajes en Tiempo Real (WebSockets)

Para una UI reactiva, es fundamental escuchar los eventos del servidor. Cuando un nuevo mensaje es recibido por el backend, este lo emite inmediatamente a través del evento `new-message`.

-   **Evento a escuchar**: `new-message`
-   **Payload (Datos)**: `Message` (El mismo objeto `Message` descrito en la sección 3.2, incluyendo los nuevos tipos de media)

El frontend debe tener un listener activo para este evento. Al recibirlo, debe:
1.  Identificar a qué chat (`jid`) pertenece el mensaje.
2.  Si el usuario está viendo ese chat, añadir el mensaje a la lista de mensajes visibles.
3.  Actualizar la lista de chats para mostrar el nuevo `lastMessage` y, si es necesario, incrementar el `unreadCount`.

## 6. Estrategia de Implementación en React

A continuación se presenta un ejemplo conceptual de cómo renderizar diferentes tipos de mensajes y manejar la lógica en un componente de React.

**Componente para renderizar un solo mensaje:**
```jsx
const MessageBubble = ({ message }) => {
  const isImage = message.type === 'imageMessage';
  const isVideo = message.type === 'videoMessage';
  const isAudio = message.type === 'audioMessage';

  const renderContent = () => {
    const mediaUrl = `http://localhost:3000${message.content}`;

    if (isImage) {
      return <img src={mediaUrl} alt="Imagen adjunta" style={{ maxWidth: '300px', borderRadius: '8px' }} />;
    }
    if (isVideo) {
      return <video src={mediaUrl} controls style={{ maxWidth: '300px' }} />;
    }
    if (isAudio) {
      return <audio src={mediaUrl} controls />;
    }
    // Por defecto, renderizar como texto
    return <p>{message.content}</p>;
  };

  // Estilo para diferenciar mensajes enviados y recibidos
  const bubbleStyle = {
    padding: '10px',
    borderRadius: '12px',
    margin: '5px 0',
    maxWidth: '70%',
    alignSelf: message.fromMe ? 'flex-end' : 'flex-start',
    background: message.fromMe ? '#dcf8c6' : '#fff',
  };

  return (
    <div style={bubbleStyle}>
      {renderContent()}
    </div>
  );
};
```

**Hook de Lógica (actualizado):**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

const API_KEY = 'my-secret-api-key'; // Almacenar de forma segura
const socket = io("http://localhost:3000");

// Hook para manejar la lógica de mensajería
function useMessaging() {
  const [chats, setChats] = useState([]);
  const [activeChatJid, setActiveChatJid] = useState(null);
  const [messages, setMessages] = useState([]);

  // 1. Cargar la lista inicial de chats
  useEffect(() => {
    fetch('/whatsapp/chats', { headers: { 'x-api-key': API_KEY } })
      .then(res => res.json())
      .then(data => setChats(data));
  }, []);

  // 2. Cargar mensajes cuando se selecciona un chat
  useEffect(() => {
    if (!activeChatJid) return;
    fetch(`/whatsapp/messages/${activeChatJid}`, { headers: { 'x-api-key': API_KEY } })
      .then(res => res.json())
      .then(data => setMessages(data));
  }, [activeChatJid]);

  // 3. Escuchar nuevos mensajes en tiempo real
  useEffect(() => {
    const handleNewMessage = (newMessage) => {
      // Actualizar la lista de chats
      setChats(prevChats => prevChats.map(chat => 
        chat.jid === newMessage.jid 
          ? { ...chat, lastMessage: newMessage, unreadCount: (chat.unreadCount || 0) + 1 } 
          : chat
      ));

      // Si el mensaje pertenece al chat activo, añadirlo a la lista de mensajes
      if (newMessage.jid === activeChatJid) {
        setMessages(prevMessages => [...prevMessages, newMessage]);
      }
    };

    socket.on('new-message', handleNewMessage);
    return () => socket.off('new-message', handleNewMessage);
  }, [activeChatJid]); // Re-enlazar si el chat activo cambia

  // 4. Función para enviar un mensaje
  const sendMessage = useCallback(async (jid, text) => {
    await fetch('/whatsapp/message/send/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify({ to: jid, text }),
    });
    // La actualización llegará por el evento 'new-message' del socket.
  }, []);

  // 5. Función para cerrar la sesión por completo
  const logout = useCallback(async () => {
    await fetch('/whatsapp/session/clear', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY },
    });
    // Aquí el frontend debería redirigir a la página de login
    // y limpiar cualquier estado local.
    window.location.href = '/'; // O la ruta de login
  }, []);

  return { chats, messages, activeChatJid, setActiveChatJid, sendMessage, logout };
}
```

## 7. Preguntas para el Equipo Frontend

Para poder refinar estos ejemplos y ofrecer una ayuda más específica, sería útil conocer:

-   **Gestión de Estado**: ¿Están utilizando alguna librería de gestión de estado como Redux, Zustand, o planean usar `React.Context` y `useState` para manejar el estado de los chats y mensajes?
-   **UI Components**: ¿Tienen alguna librería de componentes UI de preferencia (ej. Material-UI, Ant Design)?

Conocer esto nos permitirá crear ejemplos más alineados con vuestro stack tecnológico.
