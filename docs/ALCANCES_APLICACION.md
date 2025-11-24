# 📋 Alcances de la Aplicación WhatsApp Bot

> **Versión:** 0.0.1  
> **Última actualización:** 23 de noviembre de 2025  
> **Framework:** NestJS (TypeScript)

---

## 🎯 Descripción General del Proyecto

Este proyecto es una **API REST de WhatsApp** desarrollada en NestJS que permite gestionar la mensajería de WhatsApp a través de la librería **Baileys v7.0.0** (protocolo multi-dispositivo). La aplicación funciona como un servidor backend que expone endpoints REST y comunicación en tiempo real mediante WebSockets, facilitando la integración de funcionalidades de WhatsApp en aplicaciones frontend personalizadas.

### Propósito Principal

Proporcionar una plataforma robusta y escalable para:
- ✅ Conectar y autenticar sesiones de WhatsApp Business
- ✅ Enviar y recibir mensajes de texto y multimedia
- ✅ Gestionar chats y contactos
- ✅ Comunicación en tiempo real con clientes frontend

---

## 🏗️ Arquitectura Técnica

### Stack Tecnológico

| Componente | Tecnología | Versión | Propósito |
|:-----------|:-----------|:--------|:----------|
| **Framework Backend** | NestJS | 10.0+ | Framework principal de desarrollo |
| **Lenguaje** | TypeScript | 5.1.3 | Lenguaje de programación |
| **Librería WhatsApp** | @whiskeysockets/baileys | 7.0.0-rc.9 | Cliente WhatsApp Multi-Device |
| **Base de Datos** | MongoDB | - | Persistencia de datos |
| **ORM** | Mongoose | 8.18.2 | Modelado de datos |
| **WebSockets** | Socket.IO | 4.8.1 | Comunicación en tiempo real |
| **Runtime** | Node.js | 20.19+ | Entorno de ejecución |
| **Generación QR** | qrcode | 1.5.4 | Códigos QR para autenticación |

### Arquitectura Modular

```
src/
├── app.module.ts           # Módulo principal
├── app.controller.ts       # Controlador raíz
├── app.service.ts          # Servicio raíz
├── main.ts                 # Punto de entrada
└── whatsapp/              # Módulo WhatsApp (núcleo)
    ├── dto/               # Data Transfer Objects
    │   ├── send-message.dto.ts
    │   └── send-media.dto.ts
    ├── guards/            # Guardias de autenticación
    │   └── api-key.guard.ts
    ├── schemas/           # Esquemas MongoDB
    │   ├── session.schema.ts
    │   ├── chat.schema.ts
    │   └── message.schema.ts
    ├── whatsapp.controller.ts  # REST API endpoints
    ├── whatsapp.service.ts     # Lógica de negocio Baileys
    ├── whatsapp.gateway.ts     # WebSocket gateway
    └── whatsapp.module.ts      # Configuración del módulo
```

---

## 📊 Modelo de Datos

### Colección: `whatsapp_sessions`

Almacena el estado de autenticación de WhatsApp (credenciales Baileys).

| Campo | Tipo | Descripción |
|:------|:-----|:------------|
| `instanceName` | String (único) | Identificador de la instancia (ej: "my-instance") |
| `creds` | Object | Estado completo de autenticación de Baileys |
| `status` | String | Estado de conexión: "open", "connecting", "closed" |
| `createdAt` | Date | Fecha de creación (automático) |
| `updatedAt` | Date | Última actualización (automático) |

### Colección: `chats`

Almacena los contactos y chats activos.

| Campo | Tipo | Descripción |
|:------|:-----|:------------|
| `jid` | String (único) | ID único del chat/usuario (ej: "5491122334455@s.whatsapp.net") |
| `name` | String | Nombre del contacto o grupo |
| `unreadCount` | Number | Cantidad de mensajes no leídos (default: 0) |
| `lastMessage` | Object | Referencia al último mensaje del chat |
| `createdAt` | Date | Fecha de creación |
| `updatedAt` | Date | Última actualización |

### Colección: `messages`

Almacena todos los mensajes enviados y recibidos.

| Campo | Tipo | Descripción |
|:------|:-----|:------------|
| `jid` | String | ID del remitente/destinatario |
| `fromMe` | Boolean | `true` si fue enviado por el bot, `false` si fue recibido |
| `type` | String | Tipo de mensaje: "conversation", "imageMessage", "videoMessage", "audioMessage", etc. |
| `content` | String | Contenido del mensaje (texto o URL del archivo multimedia) |
| `timestamp` | Date | Fecha y hora del mensaje |
| `createdAt` | Date | Fecha de registro en BD |
| `updatedAt` | Date | Última actualización |

---

## 🔌 API REST - Endpoints Disponibles

### 🔓 Endpoints Públicos (sin autenticación)

#### 1. Iniciar Conexión

```http
POST /whatsapp/session/connect
```

**Descripción:** Inicia el proceso de conexión con WhatsApp. Genera un código QR que debe ser escaneado con la aplicación WhatsApp.

**Respuesta:**
```json
{
  "message": "Conectando a WhatsApp..."
}
```

#### 2. Obtener Estado de Sesión

```http
GET /whatsapp/session/status
```

**Descripción:** Devuelve el estado actual de la conexión y el QR si está disponible.

**Respuesta:**
```json
{
  "status": "connecting" | "open" | "closed",
  "qr": "data:image/png;base64,..." // Solo si status es "connecting"
}
```

#### 3. Health Check

```http
GET /api/health
```

**Descripción:** Endpoint de salud para verificar que el servidor está funcionando.

### 🔐 Endpoints Protegidos (requieren API Key)

> **Header requerido:** `x-api-key: my-secret-api-key`

#### 4. Desconectar Sesión (Temporal)

```http
POST /whatsapp/session/disconnect
```

**Descripción:** Desconecta la sesión actual pero conserva las credenciales para reconexión rápida.

#### 5. Cerrar Sesión Completa (Logout)

```http
POST /whatsapp/session/clear
```

**Descripción:** Cierra la sesión y elimina las credenciales de la base de datos. Requiere nuevo QR para reconectar.

#### 6. Enviar Mensaje de Texto

```http
POST /whatsapp/message/send/text
Content-Type: application/json
```

**Body:**
```json
{
  "to": "5491122334455@s.whatsapp.net",
  "text": "Hola, este es un mensaje de prueba"
}
```

#### 7. Enviar Archivo Multimedia

```http
POST /whatsapp/message/send/media
Content-Type: multipart/form-data
```

**Body (Form Data):**
- `to`: String - JID del destinatario
- `caption`: String - Descripción del archivo
- `mediaType`: "image" | "video" | "document"
- `file`: File - Archivo multimedia

#### 8. Obtener Lista de Chats

```http
GET /whatsapp/chats
```

**Respuesta:**
```json
[
  {
    "_id": "64f8c6e3a3b5e3e3a3b5e3e3",
    "jid": "5491122334455@s.whatsapp.net",
    "name": "Juan Pérez",
    "unreadCount": 2,
    "lastMessage": { ... },
    "createdAt": "2023-09-06T15:43:23.996Z",
    "updatedAt": "2023-09-06T15:55:10.123Z"
  }
]
```

#### 9. Obtener Mensajes de un Chat

```http
GET /whatsapp/messages/:jid
```

**Parámetros:**
- `jid`: ID del chat (ej: `5491122334455@s.whatsapp.net`)

**Respuesta:**
```json
[
  {
    "_id": "64f8c6a0a3b5e3e3a3b5e3a0",
    "jid": "5491122334455@s.whatsapp.net",
    "fromMe": false,
    "type": "conversation",
    "content": "Hola, ¿cómo estás?",
    "timestamp": "2023-09-06T15:43:20.000Z"
  },
  {
    "_id": "64f8c7b3a3b5e3e3a3b5e3b1",
    "fromMe": false,
    "type": "imageMessage",
    "content": "/media/1662492833.jpeg",
    "timestamp": "2023-09-06T15:45:10.000Z"
  }
]
```

---

## 🔄 WebSockets - Eventos en Tiempo Real

**URL de conexión:** `http://localhost:3000`  
**Librería cliente recomendada:** `socket.io-client`

### Eventos Emitidos por el Servidor

#### 1. Evento `qr`

**Payload:**
```json
{
  "qr": "data:image/png;base64,iVBORw0KGgoAAAANSUh..."
}
```

**Cuándo se emite:** Cuando se genera un nuevo código QR durante la autenticación.

#### 2. Evento `status`

**Payload:**
```json
{
  "status": "connecting" | "open" | "close"
}
```

**Cuándo se emite:** Cuando cambia el estado de la conexión WhatsApp.

#### 3. Evento `log`

**Payload:**
```json
{
  "message": "Iniciando conexión a WhatsApp..."
}
```

**Cuándo se emite:** Mensajes informativos del servidor (útil para debugging).

#### 4. Evento `new-message`

**Payload:**
```json
{
  "_id": "...",
  "jid": "5491122334455@s.whatsapp.net",
  "fromMe": false,
  "type": "conversation",
  "content": "Hola!",
  "timestamp": "2023-09-06T15:43:20.000Z"
}
```

**Cuándo se emite:** Cuando se recibe un nuevo mensaje en cualquier chat.

---

## 🔒 Seguridad y Autenticación

### API Key Guard

Todos los endpoints protegidos requieren una API Key en el header:

```
x-api-key: my-secret-api-key
```

**Archivo de configuración:** `src/whatsapp/guards/api-key.guard.ts`

> ⚠️ **Importante para Producción:** La API Key actual (`my-secret-api-key`) es solo para desarrollo. Debe reemplazarse con una clave segura en variables de entorno antes del deployment.

---

## 📁 Gestión de Archivos Multimedia

### Almacenamiento

Los archivos multimedia recibidos se descargan y almacenan en:

```
public/media/
```

### Servicio Estático

El servidor NestJS está configurado con `ServeStaticModule` para servir archivos estáticos desde la carpeta `public/`:

```typescript
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', 'public'),
  serveRoot: '/',
  exclude: ['/api*', '/whatsapp*'],
})
```

### URLs de Archivos

Los archivos multimedia se sirven a través de URLs como:

```
http://localhost:3000/media/1662492833.jpeg
```

---

## 🎨 Frontend - Integración

### Ejemplo HTML de Referencia

El proyecto incluye una página HTML de ejemplo en:

```
public/html/index.html
```

**Características:**
- ✅ Interfaz completa de autenticación
- ✅ Visualización de código QR
- ✅ Gestión de estados de conexión
- ✅ Polling para verificar estado
- ✅ Estilos modernos con gradientes

### Frameworks Frontend Soportados

La API es compatible con cualquier framework frontend:
- React / Next.js / Vite
- Vue.js / Nuxt
- Angular
- Vanilla JavaScript
- React Native (para apps móviles)

### Documentación Disponible

1. **[FRONTEND_INTEGRATION.md](file:///Users/lisandropradatoledo/Documents/dev/Propietas-2025/whatsapp-bot/docs/FRONTEND_INTEGRATION.md)** - Guía completa de autenticación
2. **[MESSAGING_API.md](file:///Users/lisandropradatoledo/Documents/dev/Propietas-2025/whatsapp-bot/docs/MESSAGING_API.md)** - Guía de mensajería en tiempo real
3. **[GUIA.md](file:///Users/lisandropradatoledo/Documents/dev/Propietas-2025/whatsapp-bot/GUIA.md)** - Documento de requisitos técnicos

---

## 🚀 Despliegue y Configuración

### Variables de Entorno Requeridas

```bash
# MongoDB
MONGODB_URI=mongodb://localhost/nest-whatsapp

# Puerto del servidor
PORT=3000

# API Key (cambiar en producción)
API_KEY=my-secret-api-key
```

### Instalación

```bash
# Instalar dependencias
pnpm install

# Desarrollo con hot-reload
pnpm run start:dev

# Producción
pnpm run build
pnpm run start:prod
```

### Requisitos del Sistema

- Node.js 20.19 o superior
- MongoDB en ejecución
- Puerto 3000 disponible (configurable)

---

## 📦 Funcionalidades Principales

### ✅ Autenticación WhatsApp

- [x] Generación de código QR
- [x] Autenticación mediante escaneo
- [x] Persistencia de credenciales en MongoDB
- [x] Reconexión automática
- [x] Manejo de desconexiones
- [x] Logout completo con limpieza de sesión

### ✅ Mensajería

- [x] Envío de mensajes de texto
- [x] Envío de imágenes
- [x] Envío de videos
- [x] Envío de documentos
- [x] Recepción de mensajes (todos los tipos)
- [x] Almacenamiento de historial de mensajes
- [x] Notificaciones en tiempo real vía WebSocket

### ✅ Gestión de Chats

- [x] Lista de chats activos
- [x] Contador de mensajes no leídos
- [x] Último mensaje por chat
- [x] Historial completo de mensajes por chat

### ✅ Comunicación en Tiempo Real

- [x] WebSocket para eventos en vivo
- [x] Notificación de nuevos mensajes
- [x] Actualización de estado de conexión
- [x] Logs del servidor en tiempo real

---

## 🔧 Servicios y Componentes Clave

### WhatsappService

**Archivo:** `src/whatsapp/whatsapp.service.ts`

**Responsabilidades:**
- Inicialización del socket Baileys
- Gestión del estado de autenticación
- Persistencia de credenciales en MongoDB
- Manejo de eventos de Baileys
- Envío de mensajes (texto y multimedia)
- Gestión de chats y mensajes
- Reconexión automática

**Métodos principales:**
- `connect()` - Inicia conexión WhatsApp
- `disconnect()` - Desconexión temporal
- `logoutAndClearSession()` - Logout completo
- `sendText(to, text)` - Enviar mensaje de texto
- `sendMediaUpload(to, caption, file, mediaType)` - Enviar multimedia
- `getChats()` - Obtener lista de chats
- `getMessages(jid)` - Obtener mensajes de un chat
- `handleMessagesUpsert(m)` - Procesar mensajes entrantes
- `getAuthState()` - Gestionar estado de autenticación

### WhatsappController

**Archivo:** `src/whatsapp/whatsapp.controller.ts`

**Responsabilidades:**
- Exponer endpoints REST
- Validación de DTOs
- Aplicación de guards de seguridad

### WhatsappGateway

**Archivo:** `src/whatsapp/whatsapp.gateway.ts`

**Responsabilidades:**
- Gestión de conexiones WebSocket
- Emisión de eventos a clientes conectados
- Manejo de namespaces

---

## 📝 Tipos de Mensajes Soportados

| Tipo | Envío | Recepción | Descripción |
|:-----|:------|:----------|:------------|
| **conversation** | ✅ | ✅ | Mensajes de texto simple |
| **imageMessage** | ✅ | ✅ | Imágenes (JPG, PNG, etc.) |
| **videoMessage** | ✅ | ✅ | Videos (MP4, etc.) |
| **audioMessage** | ❌ | ✅ | Notas de voz y audio |
| **documentMessage** | ✅ | ✅ | Documentos PDF, Word, etc. |
| **stickerMessage** | ❌ | ✅ | Stickers de WhatsApp |
| **locationMessage** | ❌ | ✅ | Ubicaciones compartidas |
| **contactMessage** | ❌ | ✅ | Contactos compartidos |

---

## 🎯 Casos de Uso

### 1. Chatbot de Atención al Cliente

Implementar respuestas automáticas basadas en palabras clave o IA para atender consultas de clientes 24/7.

### 2. Notificaciones Transaccionales

Enviar confirmaciones de pedidos, actualizaciones de envío, recordatorios de citas, etc.

### 3. Campañas de Marketing

Envío masivo de promociones y ofertas (respetando las políticas de WhatsApp).

### 4. Panel de Gestión de Conversaciones

Dashboard web para que operadores humanos gestionen múltiples conversaciones de WhatsApp.

### 5. Integración con CRM

Sincronizar conversaciones de WhatsApp con sistemas CRM existentes.

---

## ⚙️ Configuración Avanzada

### Conexión MongoDB Personalizada

Editar en `src/app.module.ts`:

```typescript
MongooseModule.forRoot('mongodb://usuario:password@host:27017/nombre-db')
```

### Cambiar Puerto del Servidor

En `src/main.ts`:

```typescript
await app.listen(process.env.PORT || 3000);
```

### Configurar API Key Segura

En `src/whatsapp/guards/api-key.guard.ts`:

```typescript
const validApiKey = process.env.API_KEY || 'my-secret-api-key';
```

---

## 📊 Limitaciones y Consideraciones

### Limitaciones Técnicas

1. **Sesión Única:** La aplicación soporta una única sesión de WhatsApp Business por instancia.
2. **No Multi-Tenancy:** Para múltiples cuentas de WhatsApp, se requieren múltiples instancias del servidor.
3. **Almacenamiento Local:** Los archivos multimedia se almacenan en el sistema de archivos local (considerar cloud storage para producción).

### Consideraciones de WhatsApp

1. **Políticas de Uso:** Respetar las políticas de WhatsApp para evitar bloqueos.
2. **Rate Limiting:** WhatsApp puede limitar envíos masivos.
3. **Número Comercial:** Recomendado usar WhatsApp Business API oficial para uso empresarial extensivo.

### Performance

1. **Conexión Persistente:** El socket Baileys mantiene una conexión WebSocket persistente.
2. **Escalabilidad:** Para alto volumen, considerar arquitectura de microservicios con balanceador de carga.

---

## 🔮 Roadmap y Mejoras Futuras

### Funcionalidades Planificadas

- [ ] Soporte para múltiples sesiones (multi-tenancy)
- [ ] Panel de administración web integrado
- [ ] Estadísticas y analytics de mensajería
- [ ] Plantillas de mensajes
- [ ] Chatbot con IA integrada
- [ ] Integración con servicios de cloud storage (AWS S3, Google Cloud Storage)
- [ ] Sistema de cola de mensajes (Bull/Redis)
- [ ] Webhooks para eventos de mensajes
- [ ] Soporte para grupos de WhatsApp
- [ ] Respuestas automáticas basadas en horarios

### Mejoras Técnicas

- [ ] Migrar almacenamiento de archivos a S3
- [ ] Implementar Redis para caché
- [ ] Tests automatizados (unit y e2e)
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Logging centralizado (ELK Stack)
- [ ] Monitoreo y alertas (Prometheus/Grafana)
- [ ] Documentación OpenAPI/Swagger

---

## 📚 Recursos y Referencias

### Documentación Interna

- [GUIA.md](file:///Users/lisandropradatoledo/Documents/dev/Propietas-2025/whatsapp-bot/GUIA.md) - Requisitos técnicos
- [FRONTEND_INTEGRATION.md](file:///Users/lisandropradatoledo/Documents/dev/Propietas-2025/whatsapp-bot/docs/FRONTEND_INTEGRATION.md) - Integración frontend
- [MESSAGING_API.md](file:///Users/lisandropradatoledo/Documents/dev/Propietas-2025/whatsapp-bot/docs/MESSAGING_API.md) - API de mensajería

### Referencias Externas

- [NestJS Documentation](https://docs.nestjs.com/)
- [Baileys GitHub](https://github.com/WhiskeySockets/Baileys)
- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [MongoDB Documentation](https://docs.mongodb.com/)

---

## 📞 Soporte y Contacto

Para dudas, sugerencias o reportes de bugs, contactar al equipo de desarrollo o crear un issue en el repositorio del proyecto.

---

**Documento generado automáticamente** - Fecha: 23 de noviembre de 2025
