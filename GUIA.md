Entendido. Aquí tienes el documento en formato Markdown, listo para ser copiado y compartido con el programador. He estructurado la arquitectura propuesta para la **mejor manera** de manejar sesiones con **Baileys v7** y comunicar mensajes entrantes a un _frontend_ mediante **WebSockets**.

---

# 🚀 Documento de Requisitos: API REST de WhatsApp con NestJS y Baileys v7

Este documento guía el desarrollo de una API RESTful en **NestJS** para gestionar la mensajería de WhatsApp, utilizando la librería **Baileys v7.0.0+** y **MongoDB** para la persistencia. El objetivo es ofrecer una plataforma robusta para el envío de mensajes y la comunicación en tiempo real de los mensajes entrantes a un _frontend_ de chat.

## 1. Stack Tecnológico Principal

| Componente        | Tecnología                | Requisito Clave                                             |
| :---------------- | :------------------------ | :---------------------------------------------------------- |
| **Backend**       | NestJS (TypeScript)       | Estructura modular, uso de DTOs y Servicios.                |
| **WhatsApp**      | `@whiskeysockets/baileys` | **Versión 7.0.0 o superior** (Protocolo Multi-dispositivo). |
| **Base de Datos** | MongoDB                   | Persistencia de sesiones, mensajes y chats.                 |
| **Persistencia**  | Mongoose / Typegoose      | Manejo de esquemas de datos.                                |
| **Tiempo Real**   | WebSockets                | Módulo nativo de NestJS (`@nestjs/platform-socket.io`).     |

---

## 2. Arquitectura de Sesión y Persistencia (MongoDB)

La principal complejidad es la gestión de la sesión de WhatsApp Business. **La solución propuesta es aislar la lógica de Baileys en un servicio y usar MongoDB para la persistencia de las credenciales.**

### 2.1. Requisito de Sesión Única

1.  **Gestión de Credenciales:** La API debe manejar **una única sesión** de WhatsApp Business. El **`WhatsappService`** debe implementar su propio mecanismo para guardar y cargar el estado de autenticación (`auth state`) en la colección `whatsapp_sessions` de MongoDB. **No se debe usar `useMultiFileAuthState`** en entornos de producción.
2.  **Ciclo de Conexión:**
    - **Inicio:** La conexión inicial debe generar un **código QR** o un **código de vinculación** (`pairing code`) que será devuelto a través de un _endpoint_ REST para que el administrador lo use en la aplicación WhatsApp Business.
    - **Persistencia:** Las actualizaciones del estado de la sesión (`creds.update`) deben guardarse **automáticamente** en MongoDB para asegurar la reconexión.
    - **Estado:** El servicio debe mantener y reportar el estado de la conexión (`open`, `connecting`, `closed/qr-ready`).

### 2.2. Esquemas de MongoDB

Se deben definir los siguientes modelos de datos:

| Colección           | Propósito                                         | Campos Clave Requeridos                                                                                                                                |
| :------------------ | :------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `whatsapp_sessions` | Almacena el estado de autenticación de Baileys.   | `instanceName` (String, único), `creds` (Object, el _state_ completo), `status` (String, estado de conexión).                                          |
| `chats`             | Almacena los contactos y chats activos.           | `jid` (String, único), `name` (String), `unreadCount` (Number), `lastMessage` (Object, referencia al último mensaje).                                  |
| `messages`          | Almacena todos los mensajes enviados y recibidos. | `jid` (String, remitente/destinatario), `fromMe` (Boolean), `type` (String, ej. `text`, `image`), `content` (String, texto o URL), `timestamp` (Date). |

---

## 3. Arquitectura del Código (NestJS)

Se requiere una arquitectura modular que separe las responsabilidades de la integración de WhatsApp y la comunicación en tiempo real.

### 3.1. `WhatsappModule` (Núcleo de la Lógica)

Este módulo debe contener:

| Componente                 | Responsabilidad                                                                                                                                                                                  |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`WhatsappService`**      | 🧠 **Lógica central de Baileys.** Inicializa el _socket_, gestiona la persistencia de la sesión con MongoDB, maneja los eventos (`sock.ev.on`), e implementa las funciones de envío de mensajes. |
| **`WhatsappController`**   | 🌐 Expone los **Endpoints REST** para aplicaciones externas (envío, estado, conexión).                                                                                                           |
| **`WhatsappGateway`**      | 💬 Maneja la conexión **WebSocket**. Se inyecta en el `WhatsappService` para emitir mensajes entrantes al _frontend_.                                                                            |
| **`WhatsappRepositories`** | Capa de Mongoose/Typegoose para interactuar con las colecciones (`Sessions`, `Messages`, `Chats`).                                                                                               |

### 3.2. Estrategia de Mensajes Entrantes (La mejor manera)

La manera más efectiva de proveer una sesión de chat a un _frontend_ es a través de **WebSockets**.

1.  **Recepción:** El evento `sock.ev.on('messages.upsert', ...)` se escucha en el **`WhatsappService`**.
2.  **Procesamiento:** El mensaje se normaliza y se **persiste en MongoDB** (`messages` y `chats`).
3.  **Notificación:** El **`WhatsappService`** utiliza el **`WhatsappGateway`** inyectado para emitir un evento a todos los clientes de chat conectados.
    - **Evento:** `ws.emit('new-message', <mensaje_normalizado>)`

---

## 4. Endpoints REST Detallados

Todos los _endpoints_ deben seguir el estándar RESTful e incluir DTOs (Data Transfer Objects) para la validación de la entrada.

### 4.1. Gestión de Conexión

| Método   | Endpoint                       | Descripción                                                                 | DTO Requerido |
| :------- | :----------------------------- | :-------------------------------------------------------------------------- | :------------ |
| **POST** | `/whatsapp/session/connect`    | Inicializa la sesión. Devuelve el QR (`base64`) o el código de vinculación. | Ninguno       |
| **GET**  | `/whatsapp/session/status`     | Devuelve el estado actual de la sesión.                                     | Ninguno       |
| **POST** | `/whatsapp/session/disconnect` | Cierra la sesión activa y limpia la caché de Baileys.                       | Ninguno       |

### 4.2. Envío de Mensajes

| Método   | Endpoint                       | Descripción                                            | DTO Requerido                                                        |
| :------- | :----------------------------- | :----------------------------------------------------- | :------------------------------------------------------------------- | ------- | ------------- |
| **POST** | `/whatsapp/message/send/text`  | Envía un mensaje de texto simple.                      | `{ to: string (número con código de país), text: string }`           |
| **POST** | `/whatsapp/message/send/media` | Envía imagen, documento o video desde una URL pública. | `{ to: string, caption: string, mediaUrl: string, mediaType: 'image' | 'video' | 'document' }` |

### 4.3. Historial de Chat

| Método  | Endpoint                  | Descripción                                                           | DTO Requerido                                   |
| :------ | :------------------------ | :-------------------------------------------------------------------- | :---------------------------------------------- |
| **GET** | `/whatsapp/chats`         | Lista de todos los chats, ordenados por actividad.                    | Ninguno                                         |
| **GET** | `/whatsapp/messages/:jid` | Historial de mensajes para un JID (Contacto). Paginado opcionalmente. | Parámetro: `jid` (ID de WhatsApp del contacto). |

---

## 5. Pautas de Desarrollo

1.  **Versionado:** Asegurar la compatibilidad estricta con **Baileys v7.0.0+**, ya que introduce cambios significativos en el manejo de eventos y credenciales.
2.  **Manejo de Media:** Para el envío (`/send/media`), la API debe descargar la `mediaUrl` y usar la función de envío de archivos de Baileys. Para la recepción, los archivos recibidos deben descargarse (o obtener su URL) y almacenarse en un sistema de archivos local temporal o un servicio de _cloud storage_. **La URL final de la media recibida debe guardarse en MongoDB.**
3.  **Seguridad:** Implementar un _Guard_ Global (ej. **JWT o API Key**) para proteger todos los _endpoints_ REST de la API.
4.  **Logging:** Usar el _logger_ de NestJS (o PINO, si se configura) para registrar eventos importantes de Baileys (conexión, errores, envío de QR) y facilitar la depuración.|
