# Propietas WhatsApp Bot

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
  <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" width="100" alt="WhatsApp Logo" />
</p>

Servicio de integración de WhatsApp para el ecosistema **Propietas**, construido con **NestJS**, **Baileys** y **Google Gemini AI**. Este bot actúa como el puente de comunicación entre los clientes, el Core Backend (PostgreSQL) y el Backoffice de administración.

## 🚀 Características Principales

- **Conexión Multidispositivo**: Basado en `@whiskeysockets/baileys` para una integración estable y moderna con WhatsApp.
- **Inteligencia Artificial**: Integración nativa con **Google Gemini** para respuestas automáticas inteligentes y procesamiento de lenguaje natural.
- **Gestión de Chat en Tiempo Real**: Soporte completo para mensajería de texto y multimedia (imágenes, videos, documentos) con actualizaciones vía **Socket.IO**.
- **Vinculación con Core**: Identificación automática de clientes mediante el número de teléfono y consulta de saldos en tiempo real.
- **Panel de Administración**: Se integra con el Backoffice para permitir la intervención humana (modo Manual) o dejar que el bot opere de forma autónoma (modo BOT).
- **Persistencia de Sesión**: Almacenamiento seguro de credenciales y historial de mensajes en **MongoDB**.

## 🛠️ Tecnologías

- **Framework**: [NestJS](https://nestjs.com/)
- **WhatsApp**: [Baileys](https://github.com/WhiskeySockets/Baileys)
- **Base de Datos**: [MongoDB](https://www.mongodb.com/) (Mongoose)
- **IA**: [Google Gemini SDK](https://ai.google.dev/)
- **Comunicación**: [Socket.IO](https://socket.io/)

## 📦 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/lisandroprada/whatsapp-bot.git
cd whatsapp-bot
```

2. Instala las dependencias:
```bash
pnpm install
```

3. Configura las variables de entorno en un archivo `.env` (guíate por `.env.example`):
```env
MONGODB_URI=mongodb://localhost/nest-whatsapp
API_KEY=tu_clave_secreta_api
GEMINI_API_KEY=tu_google_gemini_key
CORE_BACKEND_URL=http://localhost:3000
```

## 🏃 Ejecución

```bash
# Desarrollo (watch mode)
pnpm run start:dev

# Producción
pnpm run build
pnpm run start:prod
```

## 📡 Endpoints Principales

- `POST /whatsapp/session/connect`: Iniciar proceso de vinculación QR.
- `GET /whatsapp/session/status`: Obtener estado actual y QR en base64.
- `GET /whatsapp/chats`: Lista de conversaciones activas.
- `POST /whatsapp/message/send/text`: Enviar mensaje manual a un JID.
- `POST /whatsapp/message/send/media`: Enviar archivos multimedia.

## 🤝 Integración con Propietas

Este bot está diseñado para trabajar en conjunto con:
- **Core Backend**: [propietas_backend_2026](https://github.com/lisandroprada/propietas_backend_2026)
- **Backoffice**: [propietas_backoffice_2026](https://github.com/lisandroprada/propietas_backoffice_2026)

## 📄 Licencia

Este proyecto es propiedad privada de **Propietas**.
