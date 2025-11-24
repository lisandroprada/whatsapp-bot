# Guía de Integración Frontend para Autenticación de WhatsApp

## 1. Introducción

Este documento detalla el proceso para integrar el flujo de autenticación de WhatsApp en una aplicación frontend (React/Vite). Describe los endpoints de la API REST, los eventos de WebSocket y la lógica de cliente necesaria para mostrar un código QR, gestionar el estado de la conexión y asegurar la comunicación con el backend.

## 2. Visión General del Flujo de Autenticación

El proceso de autenticación permite al usuario vincular una sesión de WhatsApp con el backend escaneando un código QR.

1.  **Inicio de la Conexión**: El usuario inicia el proceso en el frontend (ej. haciendo clic en un botón "Conectar").
2.  **Petición al Backend**: El frontend realiza una petición `POST` al endpoint `POST /whatsapp/session/connect`.
3.  **Generación del QR**: El backend recibe la petición, inicia una nueva conexión con los servidores de WhatsApp y genera un código QR.
4.  **Transmisión del QR**:
    *   **Método Recomendado (WebSocket)**: El backend emite un evento `qr` a través de un WebSocket con el código QR en formato de imagen (Data URL).
    *   **Método Alternativo (Polling)**: El QR se puede obtener consultando periódicamente el endpoint `GET /whatsapp/session/status`.
5.  **Escaneo por el Usuario**: El usuario escanea el código QR mostrado en el frontend con la aplicación de WhatsApp de su teléfono.
6.  **Conexión Exitosa**: Una vez escaneado, el backend establece una conexión segura y persistente. Emite un evento `status` con el valor `open`.
7.  **Operación Normal**: Con la sesión activa, el frontend puede usar otros endpoints protegidos (ej. para enviar mensajes) incluyendo una API Key en las cabeceras.

## 3. API del Backend

La comunicación se realiza a través de una combinación de API REST y WebSockets.

### 3.1. Configuración Inicial

-   **URL del Backend**: `http://localhost:3000` (o la URL correspondiente en producción).
-   **Prefijo de API**: Las rutas principales de la API de WhatsApp se encuentran bajo `/whatsapp`.

### 3.2. Endpoints de la API REST

Estos son los endpoints HTTP disponibles en `whatsapp.controller.ts`.

| Método | Ruta                        | ¿Protegido? | Descripción                                                                                                                            |
| :----- | :-------------------------- | :---------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/whatsapp/session/connect` | **No**      | Inicia el proceso de conexión en el backend. Esto dispara la generación del código QR. Es el punto de partida de todo el flujo.            |
| `GET`  | `/whatsapp/session/status`  | **No**      | Devuelve el estado actual de la conexión (`closed`, `connecting`, `open`) y el último QR generado en formato base64. Útil para polling. |
| `POST` | `/whatsapp/session/disconnect`| **Sí**      | Cierra la sesión de WhatsApp activa.                                                                                                   |
| `POST` | `/whatsapp/message/send/text` | **Sí**      | Envía un mensaje de texto.                                                                                                             |
| `POST` | `/whatsapp/message/send/media`| **Sí**      | Envía un archivo multimedia (imagen, video, documento).                                                                                |
| `GET`  | `/chats`                    | **Sí**      | Obtiene la lista de chats.                                                                                                             |
| `GET`  | `/messages/:jid`            | **Sí**      | Obtiene los mensajes de un chat específico.                                                                                            |
| `GET`  | `/api/health`               | **No**      | Endpoint de salud para verificar que el backend está en funcionamiento. Devuelve `{ "status": "ok", ... }`.                            |

### 3.3. Uso de la API Key

Todos los endpoints marcados como **"Sí"** en la columna "¿Protegido?" requieren una API Key para ser utilizados.

-   **Cabecera**: `x-api-key`
-   **Valor por defecto (para desarrollo)**: `my-secret-api-key` (definido en `src/whatsapp/guards/api-key.guard.ts`)

**Ejemplo de petición protegida:**

```javascript
fetch('/whatsapp/chats', {
  headers: {
    'x-api-key': 'my-secret-api-key'
  }
});
```

## 4. Comunicación en Tiempo Real (WebSockets)

**Este es el método recomendado para una experiencia de usuario fluida y eficiente.** El backend utiliza Socket.IO para emitir eventos en tiempo real, eliminando la necesidad de hacer polling constante al endpoint `/whatsapp/session/status`.

-   **URL del Servidor de Sockets**: `http://localhost:3000`
-   **Librería de Cliente**: `socket.io-client`

### 4.1. Eventos Emitidos por el Servidor (Backend -> Frontend)

El cliente debe escuchar los siguientes eventos:

| Evento         | Payload (Datos)                               | Descripción                                                                                                                                 |
| :------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `qr`           | `{ qr: string }`                              | Se emite cuando se genera un nuevo código QR. El `payload.qr` es una imagen en formato Data URL (`data:image/png;base64,...`) lista para ser usada en el `src` de una etiqueta `<img>`. |
| `status`       | `{ status: 'connecting' | 'open' | 'close' }` | Se emite cada vez que el estado de la conexión cambia. Permite actualizar la UI para reflejar si se está conectando, conectado o desconectado. |
| `log`          | `{ message: string }`                         | Emite mensajes de log informativos desde el backend (ej. "Iniciando conexión...", "Credenciales guardadas"). Útil para depuración y para mostrar un log detallado al usuario. |
| `new-message`  | `{ jid: string, fromMe: boolean, ... }`       | Se emite cuando se recibe un nuevo mensaje en la sesión de WhatsApp activa.                                                                 |

## 5. Estrategia de Implementación en React

1.  **Instalar Socket.IO Client**:
    ```bash
    npm install socket.io-client
    ```

2.  **Crear un Hook para el Socket**: Abstraer la lógica del socket en un custom hook (ej. `useWhatsappSocket`).

    ```jsx
    import { useEffect, useState } from 'react';
    import io from 'socket.io-client';

    const socket = io("http://localhost:3000");

    export const useWhatsapp = () => {
      const [status, setStatus] = useState('closed');
      const [qrCode, setQrCode] = useState(null);
      const [logs, setLogs] = useState([]);

      useEffect(() => {
        socket.on('status', (data) => setStatus(data.status));
        socket.on('qr', (data) => setQrCode(data.qr));
        socket.on('log', (data) => {
          setLogs(prevLogs => [...prevLogs, data.message]);
        });

        return () => {
          socket.off('status');
          socket.off('qr');
          socket.off('log');
        };
      }, []);

      const connect = () => {
        // Limpiar estado anterior
        setQrCode(null);
        setStatus('connecting');
        // Iniciar el proceso en el backend
        fetch('/whatsapp/session/connect', { method: 'POST' });
      };

      return { status, qrCode, logs, connect };
    };
    ```

3.  **Componente de Autenticación**: Usar el hook para renderizar la UI.

    ```jsx
    const AuthComponent = () => {
      const { status, qrCode, logs, connect } = useWhatsapp();

      return (
        <div>
          <h1>Estado: {status}</h1>
          <button onClick={connect} disabled={status === 'open'}>
            Conectar a WhatsApp
          </button>

          {status === 'connecting' && !qrCode && <p>Generando QR...</p>}
          {qrCode && status !== 'open' && <img src={qrCode} alt="Escanea el QR" />}
          {status === 'open' && <p>¡Conectado!</p>}

          <h2>Logs:</h2>
          <pre>{logs.join('\n')}</pre>
        </div>
      );
    };
    ```

## 6. Ejemplo de Referencia (Vanilla JavaScript)

El siguiente es el código completo del fichero `public/html/index.html`. Este ejemplo utiliza un método de **polling** con `fetch` para consultar el estado, que es menos eficiente que los WebSockets pero sirve como una excelente referencia funcional de la interacción con la API REST.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WhatsApp Integration</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family:
          -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
      }

      .container {
        background: white;
        padding: 2rem;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        max-width: 450px;
        width: 100%;
        text-align: center;
      }

      h1 {
        color: #128c7e;
        margin-bottom: 1.5rem;
        font-weight: 600;
      }

      .status {
        padding: 10px 20px;
        border-radius: 25px;
        font-weight: 500;
        margin: 1rem 0;
        font-size: 0.9rem;
      }

      .status.connecting {
        background: #fff3cd;
        color: #856404;
      }
      .status.open {
        background: #d4edda;
        color: #155724;
      }
      .status.closed {
        background: #f8d7da;
        color: #721c24;
      }

      .qr-section {
        margin: 2rem 0;
        padding: 1rem;
        border: 2px dashed #e0e0e0;
        border-radius: 8px;
        min-height: 250px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
      }

      .qr-code {
        max-width: 200px;
        width: 100%;
      }

      .btn {
        background: #25d366;
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 25px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 500;
        transition: all 0.3s ease;
        margin: 10px;
      }

      .btn:hover {
        background: #20b954;
        transform: translateY(-2px);
      }

      .btn:disabled {
        background: #ccc;
        cursor: not-allowed;
        transform: none;
      }

      .info {
        font-size: 0.9rem;
        color: #666;
        margin-top: 1rem;
        line-height: 1.5;
      }

      .loading {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #25d366;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>🚀 WhatsApp Integration</h1>

      <div id="status" class="status connecting">Initializing...</div>

      <div class="qr-section" id="qr-section">
        <div class="loading"></div>
        <p>Preparing connection...</p>
      </div>

      <button id="connect-btn" class="btn">Connect WhatsApp</button>

      <button
        id="disconnect-btn"
        class="btn"
        style="background: #dc3545; display: none"
      >
        Disconnect
      </button>

      <div class="info">
        <p><strong>Instructions:</strong></p>
        <p>1. Click "Connect WhatsApp"</p>
        <p>2. Scan the QR code with WhatsApp</p>
        <p>3. Start using the API!</p>
      </div>
    </div>

    <script>
      const statusEl = document.getElementById('status');
      const qrSectionEl = document.getElementById('qr-section');
      const connectBtn = document.getElementById('connect-btn');
      const disconnectBtn = document.getElementById('disconnect-btn');

      // Update status display
      function updateStatus(status, message) {
        statusEl.className = `status ${status}`;
        statusEl.textContent = message;
      }

      // Update QR section
      function updateQRSection(content) {
        qrSectionEl.innerHTML = content;
      }

      // Connect button handler
      connectBtn.addEventListener('click', async () => {
        connectBtn.disabled = true;
        updateStatus('connecting', '🔄 Connecting...');
        updateQRSection(
          '<div class="loading"></div><p>Establishing connection...</p>',
        );

        try {
          const response = await fetch('/whatsapp/session/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          const data = await response.json();
          console.log('Connection response:', data);

          // Check status periodically
          checkStatus();
        } catch (error) {
          console.error('Connection error:', error);
          updateStatus('closed', '❌ Connection Failed');
          updateQRSection('<p>❌ Failed to connect. Please try again.</p>');
          connectBtn.disabled = false;
        }
      });

      // Disconnect button handler
      disconnectBtn.addEventListener('click', async () => {
        try {
          await fetch('/whatsapp/session/disconnect', { method: 'POST' });
          updateStatus('closed', '🔌 Disconnected');
          updateQRSection('<p>Disconnected successfully</p>');
          connectBtn.style.display = 'inline-block';
          disconnectBtn.style.display = 'none';
          connectBtn.disabled = false;
        } catch (error) {
          console.error('Disconnect error:', error);
        }
      });

      // Check WhatsApp status
      async function checkStatus() {
        try {
          const response = await fetch('/whatsapp/session/status');
          const data = await response.json();

          if (data.status === 'open') {
            updateStatus('open', '✅ Connected to WhatsApp');
            updateQRSection(
              '<h2>🎉 Successfully Connected!</h2><p>WhatsApp is ready to use</p>',
            );
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
          } else if (data.status === 'connecting' && data.qr) {
            updateStatus('connecting', '📱 Scan QR Code');
            // Validate and clean QR data
            const qrData = data.qr
              .replace(/^data:image\/png;base64,/, '')
              .trim();
            if (qrData && qrData.length > 0 && !qrData.includes(',')) {
              updateQRSection(
                `<img class="qr-code" src="data:image/png;base64,${qrData}" alt="WhatsApp QR Code" onError="this.style.display='none'; this.nextElementSibling.style.display='block';">
                 <p style="display:none;">❌ QR Code format error</p>`,
              );
            } else {
              updateQRSection('<p>⏳ Generating QR code...</p>');
            }
            // Continue checking
            setTimeout(checkStatus, 2000);
          } else if (data.status === 'connecting') {
            updateStatus('connecting', '🔄 Generating QR...');
            setTimeout(checkStatus, 1000);
          } else {
            updateStatus('closed', '🔌 Disconnected');
            connectBtn.disabled = false;
          }
        } catch (error) {
          console.error('Status check error:', error);
          updateStatus('closed', '❌ Connection Error');
          connectBtn.disabled = false;
        }
      }

      // Initial status check
      checkStatus();
    </script>
  </body>
</html>
```