# Integración Core Backend: Especificación de Servicios

## Arquitectura de Comunicación

```mermaid
graph LR
    WA[WhatsApp User] -->|Mensaje| Bot[WhatsApp Bot]
    Bot -->|Invoke Brain| Gemini[Google Gemini AI]
    Gemini -->|Function Call| Tools[AI Tools]
    Tools -->|HTTP + API Key| Core[Core Backend]
    Core -->|JSON Response| Tools
    Tools -->|Data| Gemini
    Gemini -->|Response| Bot
    Bot -->|Respuesta| WA
```

---

## 1. Servicio de Core Backend (CoreBackendService)

### Ubicación
`src/brain/services/core-backend.service.ts`

### Responsabilidad
Centralizar todas las llamadas HTTP al Core Backend con:
- Autenticación mediante API Key
- Manejo de errores
- Retry logic
- Logging

### Implementación

```typescript
import { Injectable, Logger, HttpException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class CoreBackendService {
  private readonly logger = new Logger(CoreBackendService.name);
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.CORE_BACKEND_URL,
      timeout: 10000,
      headers: {
        'x-service-api-key': process.env.CORE_BACKEND_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para logging
    this.client.interceptors.request.use((config) => {
      this.logger.log(`[Core Request] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        this.logger.log(`[Core Response] ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(
          `[Core Error] ${error.response?.status || 'NETWORK'} ${error.config?.url}`,
          error.message,
        );
        throw error;
      },
    );
  }

  // ========== Endpoints Administrativos ==========

  /**
   * Obtener información del cliente por JID de WhatsApp
   * Endpoint Core: GET /api/whatsapp/client-by-jid/:jid
   */
  async getClientByJid(jid: string) {
    try {
      const response = await this.client.get(`/api/whatsapp/client-by-jid/${jid}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Cliente no encontrado
      }
      throw new HttpException(
        'Error al consultar cliente en Core Backend',
        error.response?.status || 500,
      );
    }
  }

  /**
   * Obtener saldo y estado de cuenta
   * Endpoint Core: GET /api/clients/:clientId/account-status
   */
  async getAccountStatus(clientId: string) {
    const response = await this.client.get(`/api/clients/${clientId}/account-status`);
    return response.data;
  }

  /**
   * Registrar pago reportado por el cliente
   * Endpoint Core: POST /api/payments/report
   */
  async reportPayment(data: {
    clientId: string;
    amount: number;
    date: string;
    receiptUrl?: string;
    method: 'transfer' | 'cash' | 'check';
  }) {
    const response = await this.client.post('/api/payments/report', data);
    return response.data;
  }

  /**
   * Crear ticket de reclamo
   * Endpoint Core: POST /api/complaints/create
   */
  async createComplaint(data: {
    clientId: string;
    propertyId: string;
    category: 'plumbing' | 'electric' | 'heating' | 'other';
    description: string;
    urgency: 'low' | 'medium' | 'high' | 'urgent';
    evidenceUrls?: string[];
  }) {
    const response = await this.client.post('/api/complaints/create', data);
    return response.data;
  }

  // ========== Endpoints Comerciales ==========

  /**
   * Buscar propiedades disponibles
   * Endpoint Core: GET /api/properties/search
   */
  async searchProperties(filters: {
    zone?: string;
    type?: 'apartment' | 'house' | 'duplex';
    rooms?: number;
    minPrice?: number;
    maxPrice?: number;
    operation?: 'rent' | 'sale';
  }) {
    const response = await this.client.get('/api/properties/search', {
      params: filters,
    });
    return response.data;
  }

  /**
   * Agendar visita a propiedad
   * Endpoint Core: POST /api/showings/schedule
   */
  async scheduleShowing(data: {
    propertyId: string;
    clientPhone: string;
    clientName: string;
    preferredDate: string;
    preferredTime: 'morning' | 'afternoon';
  }) {
    const response = await this.client.post('/api/showings/schedule', data);
    return response.data;
  }

  // ========== Validación de Identidad ==========

  /**
   * Validar DNI/CUIT y generar OTP
   * Endpoint Core: POST /api/auth/validate-identity
   */
  async validateIdentity(dni: string, jid: string) {
    const response = await this.client.post('/api/auth/validate-identity', {
      dni,
      whatsappJid: jid,
    });
    return response.data; // { clientId, name, otpSent: true }
  }

  /**
   * Verificar código OTP
   * Endpoint Core: POST /api/auth/verify-otp
   */
  async verifyOTP(dni: string, otp: string, jid: string) {
    const response = await this.client.post('/api/auth/verify-otp', {
      dni,
      otp,
      whatsappJid: jid,
    });
    return response.data; // { success: true, clientId, token }
  }

  /**
   * Vincular JID de WhatsApp con cliente
   * Endpoint Core: POST /api/clients/:clientId/link-whatsapp
   */
  async linkWhatsappToClient(clientId: string, jid: string) {
    const response = await this.client.post(`/api/clients/${clientId}/link-whatsapp`, {
      whatsappJid: jid,
    });
    return response.data;
  }
}
```

---

## 2. Sistema de Saludo Personalizado

### Requisito
Cuando un usuario con JID conocido envía un mensaje, el bot debe saludarlo por su nombre.

**Ejemplo:**
```
Usuario: "Hola"
Bot: "¡Hola Juan! ¿En qué puedo ayudarte hoy? 😊"
```

### Flujo de Implementación

#### 2.1. Al recibir mensaje (WhatsappService)

```typescript
private async handleMessagesUpsert(m: any) {
  const msg = m.messages[0];
  const jid = msg.key.remoteJid;

  // 1. Buscar o crear chat
  let chat = await this.chatModel.findOne({ jid });
  
  if (!chat) {
    // Primera vez que escribe
    chat = await this.chatModel.create({
      jid,
      isBotActive: true,
      mode: 'BOT',
    });

    // 2. Intentar vincular con Core Backend
    await this.tryLinkClientFromCore(jid, chat);
  }

  // 3. Si el chat tiene coreClientId, obtener nombre
  let clientName = null;
  if (chat.coreClientId) {
    const contact = await this.contactModel.findOne({ jid });
    clientName = contact?.name;
  }

  // 4. Procesar por Brain con contexto de nombre
  if (chat.mode === 'BOT' && chat.isBotActive) {
    await this.processByBrain(msg, jid, chat, clientName);
  }
}
```

#### 2.2. Método auxiliar para vincular cliente

```typescript
private async tryLinkClientFromCore(jid: string, chat: Chat) {
  try {
    // Consultar Core Backend: ¿este JID ya está vinculado?
    const clientData = await this.coreBackendService.getClientByJid(jid);
    
    if (clientData) {
      // Cliente encontrado, actualizar chat y crear contact
      await this.chatModel.updateOne(
        { jid },
        { coreClientId: clientData.id }
      );

      await this.contactModel.create({
        jid,
        coreClientId: clientData.id,
        name: clientData.name,
        dni: clientData.dni,
        isVerified: true,
        metadata: clientData,
      });

      this.logger.log(`[Auto-Link] JID ${jid} vinculado a cliente ${clientData.name}`);
    }
  } catch (error) {
    // Si falla, no es crítico. El usuario puede vincularse manualmente después
    this.logger.warn(`[Auto-Link Failed] ${jid}: ${error.message}`);
  }
}
```

#### 2.3. Pasar nombre a BrainService

```typescript
private async processByBrain(
  msg: any,
  jid: string,
  chat: Chat,
  clientName: string | null
) {
  const isRegistered = !!chat.coreClientId;
  const text = this.extractTextFromMessage(msg.message);

  const aiResponse = await this.brainService.processMessage(
    jid,
    text,
    isRegistered,
    clientName, // NUEVO parámetro
  );

  await this.sendText(jid, aiResponse);
}
```

#### 2.4. Usar nombre en System Prompt (BrainService)

```typescript
async processMessage(
  jid: string,
  userMessage: string,
  isRegistered: boolean,
  clientName?: string
) {
  // Construir prompt del sistema con nombre
  const systemPrompt = getSystemPrompt(isRegistered, clientName);

  // Si es el primer mensaje de la conversación (historial vacío)
  const history = await this.getChatHistory(jid);
  
  if (history.length === 0 && clientName) {
    // Instrucción especial para saludo personalizado
    const greetingInstruction = new SystemMessage(`
      INSTRUCCIÓN ESPECIAL: Este es el primer mensaje del cliente ${clientName}.
      Salúdalo por su nombre de forma cordial y pregúntale en qué puedes ayudarlo.
      Ejemplo: "¡Hola ${clientName}! ¿En qué puedo ayudarte hoy? 😊"
    `);

    const messages = [systemPrompt, greetingInstruction, new HumanMessage(userMessage)];
    const response = await this.model.invoke(messages);
    return response.content;
  }

  // Flujo normal con historial
  // ...
}
```

---

## 3. Endpoints Requeridos en Core Backend

### 3.1. Consulta de Cliente por JID

```http
GET /api/whatsapp/client-by-jid/:jid
Headers:
  x-service-api-key: <WHATSAPP_BOT_API_KEY>

Response 200:
{
  "id": "client_123",
  "name": "Juan Pérez",
  "dni": "12345678",
  "email": "juan@example.com",
  "phone": "+5491122334455",
  "properties": [
    {
      "id": "prop_456",
      "address": "Av. Libertador 1234",
      "currentBalance": -50000
    }
  ]
}

Response 404:
{
  "error": "Cliente no encontrado para este JID"
}
```

### 3.2. Estado de Cuenta

```http
GET /api/clients/:clientId/account-status
Headers:
  x-service-api-key: <WHATSAPP_BOT_API_KEY>

Response 200:
{
  "clientId": "client_123",
  "clientName": "Juan Pérez",
  "balance": -50000,
  "nextPaymentDue": "2025-12-05",
  "lastPayment": {
    "amount": 150000,
    "date": "2025-11-03",
    "method": "transfer"
  },
  "properties": [...]
}
```

### 3.3. Validación de Identidad

```http
POST /api/auth/validate-identity
Headers:
  x-service-api-key: <WHATSAPP_BOT_API_KEY>
Body:
{
  "dni": "12345678",
  "whatsappJid": "5491122334455@s.whatsapp.net"
}

Response 200:
{
  "clientId": "client_123",
  "name": "Juan Pérez",
  "otpSent": true,
  "otpMethod": "email" // or "sms"
}

Response 404:
{
  "error": "No se encontró cliente con ese DNI"
}
```

### 3.4. Verificación de OTP

```http
POST /api/auth/verify-otp
Headers:
  x-service-api-key: <WHATSAPP_BOT_API_KEY>
Body:
{
  "dni": "12345678",
  "otp": "4455",
  "whatsappJid": "5491122334455@s.whatsapp.net"
}

Response 200:
{
  "success": true,
  "clientId": "client_123",
  "message": "Cuenta vinculada exitosamente"
}

Response 400:
{
  "error": "Código OTP incorrecto o expirado"
}
```

---

## 4. Variables de Entorno

### WhatsApp Bot (.env)

```bash
# Gemini AI
GEMINI_API_KEY=AIzaSyA9EIEToBDy1tDCOW0SW9ZdaN7c79nw488

# Core Backend Integration
CORE_BACKEND_URL=http://localhost:4000
CORE_BACKEND_API_KEY=<generar-key-segura>

# MongoDB
MONGODB_URI=mongodb://localhost/nest-whatsapp

# WhatsApp Bot API (para frontend)
API_KEY=my-secret-api-key
```

### Core Backend (.env)

```bash
# Service Authentication
WHATSAPP_BOT_API_KEY=<misma-key-que-arriba>

# JWT para usuarios finales (existente)
JWT_SECRET=<tu-secret-actual>
JWT_EXPIRATION=24h
```

---

## 5. Seguridad y Mejores Prácticas

### 5.1. Generación de API Key Segura

```bash
# Generar API Key criptográficamente segura
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5.2. Middleware Dual Authentication (Core Backend)

```typescript
// src/middleware/dual-auth.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class DualAuthMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    const serviceApiKey = req.headers['x-service-api-key'];
    const authHeader = req.headers['authorization'];

    // Opción 1: Service Authentication (WhatsApp Bot)
    if (serviceApiKey === process.env.WHATSAPP_BOT_API_KEY) {
      req.auth = {
        type: 'SERVICE',
        service: 'whatsapp-bot',
        permissions: ['read:clients', 'write:complaints', 'read:properties'],
      };
      return next();
    }

    // Opción 2: JWT Authentication (Usuario final)
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = this.jwtService.verify(token);
        req.auth = {
          type: 'USER',
          userId: decoded.sub,
          permissions: decoded.permissions,
        };
        return next();
      } catch (error) {
        throw new UnauthorizedException('Token JWT inválido');
      }
    }

    throw new UnauthorizedException('Credenciales no proporcionadas');
  }
}
```

### 5.3. Rate Limiting por Servicio

```typescript
// En Core Backend: limitar requests del bot
import { ThrottlerGuard } from '@nestjs/throttler';

@UseGuards(ThrottlerGuard)
@Controller('api')
export class ApiController {
  // Bot: 100 requests/minuto
  // Usuario: 20 requests/minuto
}
```

---

## 6. Diagrama de Secuencia: Primer Contacto con Saludo Personalizado

```mermaid
sequenceDiagram
    participant U as Usuario (WhatsApp)
    participant B as WhatsApp Bot
    participant DB as MongoDB
    participant C as Core Backend

    U->>B: "Hola" (primer mensaje)
    B->>DB: findOne({ jid })
    DB-->>B: null (no existe)
    
    B->>DB: create({ jid, mode: 'BOT' })
    
    B->>C: GET /api/whatsapp/client-by-jid/:jid
    C-->>B: { id, name: "Juan Pérez", ... }
    
    B->>DB: update chat (coreClientId)
    B->>DB: create contact (name, dni, ...)
    
    B->>Gemini: processMessage(jid, "Hola", true, "Juan Pérez")
    Gemini-->>B: "¡Hola Juan! ¿En qué puedo ayudarte hoy? 😊"
    
    B->>U: "¡Hola Juan! ¿En qué puedo ayudarte hoy? 😊"
```

---

## Próximos Pasos

1. ✅ **Implementar** `CoreBackendService` en el módulo Brain
2. ✅ **Actualizar** `WhatsappService.handleMessagesUpsert` con auto-link
3. ✅ **Modificar** `BrainService.processMessage` para recibir `clientName`
4. ✅ **Coordinar con Core Backend** para crear los endpoints necesarios
5. ✅ **Configurar** variables de entorno en ambos proyectos
6. ✅ **Testear** flujo de saludo personalizado
