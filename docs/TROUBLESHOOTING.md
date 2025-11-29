# Troubleshooting: Bot no responde correctamente

## Problemas Encontrados y Soluciones

### Problema 1: Modelo Gemini Incorrecto ✅ RESUELTO
**Síntoma:** Error 404 al llamar a Gemini API  
**Causa:** Usábamos `gemini-1.5-flash` pero el modelo correcto es `gemini-2.5-flash`  
**Solución:**
``typescript
// brain.service.ts  
private readonly modelName = 'gemini-2.5-flash'; // ✅ Correcto
```

**Archivos modificados:**
- `src/brain/brain.service.ts` (línea 21 y 37)

---

### Problema 2: Variables de Entorno no se Cargan ✅ RESUELTO
**Síntoma:** `GEMINI_API_KEY not found in environment variables`  
**Causa:** NestJS no cargaba el archivo `.env` automáticamente  
**Solución:** Instalar y configurar `@nestjs/config`

```bash
pnpm install @nestjs/config
```

```typescript
// app.module.ts
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // ... otros imports
  ],
})
```

**Archivos modificados:**
- `src/app.module.ts`
- `package.json` (dependencia agregada)

---

### Problema 3: Frontend no Recibe Mensajes ⏳ POR VERIFICAR
**Síntoma:** El frontend no actualiza cuando llegan mensajes  
**Posible Causa:** WebSocket no está emitiendo correctamente  
**A Verificar:**
1. Frontend conectado al WebSocket (`http://localhost:3000`)
2. Evento `new-message` siendo emitido
3. CORS configurado correctamente

**Código actual en WhatsappService:**
```typescript
// Esto YA está implementado
this.whatsappGateway.sendNewMessage(newMessage.toJSON());
this.whatsappGateway.sendNewMessage(botMessage.toJSON());
```

**Para verificar en frontend:**
```javascript
const socket = io('http://localhost:3000');

socket.on('new-message', (message) => {
  console.log('New message received:', message);
  // Actualizar UI
});
```

---

## Cómo Verificar que Todo Funciona

### 1. Verificar que el servidor inició correctamente

```bash
# Debe mostrar estas líneas en los logs:
# [BrainService] BrainService initialized with Gemini 2.5 Flash
# [CoreBackendService] ⚠️  MOCK MODE ENABLED
# [NestApplication] Nest application successfully started
```

### 2. Enviar mensaje de WhatsApp

Desde el número: `+54 280 450-3151`

**Mensaje:** `"Hola"`

**Respuesta esperada:**
```
¡Hola Lisandro! ¿En qué puedo ayudarte hoy? 😊
```

### 3. Verificar en logs del servidor

```bash
tail -f /tmp/whatsapp-bot-startup.log | grep Brain
```

**Deberías ver:**
```
[WhatsappService] [Brain] Processing message for Lisandro (REGISTERED)
[BrainService] [Brain] Processing message from Lisandro (REGISTERED)
[BrainService] [Brain] Response generated successfully
[WhatsappService] [Brain] Response sent to 5492804503151@s.whatsapp.net
```

### 4. Verificar WebSocket (Frontend)

Abrir consola del navegador:

```javascript
// Conectar a WebSocket
const socket = io('http://localhost:3000');

// Escuchar mensajes
socket.on('new-message', (msg) => {
  console.log('📨 New message:', msg);
});

socket.on('connect', () => {
  console.log('✅ WebSocket connected');
});

socket.on('disconnect', () => {
  console.log('❌ WebSocket disconnected');
});
```

---

## Scripts Útiles para Debugging

### Reiniciar Servidor Limpiamente
```bash
./restart.sh
```

### Ver Logs en Tiempo Real
```bash
tail -f /tmp/whatsapp-bot-startup.log
```

### Diagnosticar Estado del Bot
```bash
./diagnostics.sh
```

### Test Directo de Gemini
```bash
node test-gemini-2.5.js
```

### Ver Últimos Mensajes
```bash
curl -s http://localhost:3000/whatsapp/messages/5492804503151@s.whatsapp.net \
  -H "x-api-key: my-secret-api-key" | jq '.[-5:]'
```

---

## Checklist de Verificación

- [ ] Puerto 3000 libre (`lsof -i:3000`)
- [ ] MongoDB corriendo (`pgrep mongod`)
- [ ] Archivo `.env` existe y tiene `GEMINI_API_KEY`
- [ ] `@nestjs/config` instalado
- [ ] Servidor inició sin errores
- [ ] WhatsApp conectado (QR escaneado)
- [ ] Bot responde en WhatsApp
- [ ] Logs muestran "Response generated successfully"
- [ ] Frontend conectado a WebSocket
- [ ] Frontend recibe eventos `new-message`

---

## Próximos Pasos si Problemas Persisten

### Si Gemini sigue fallando:
1. Verificar API key válida en Google AI Studio
2. Verificar cuota de API no excedida
3. Test directo: `node test-gemini-2.5.js`

### Si Frontend no actualiza:
1. Verificar CORS en `main.ts`
2. Verificar conexión WebSocket en browser console
3. Verificar que `WhatsappGateway` emite correctamente

### Si Bot no responde:
1. Verificar logs: `tail -f /tmp/whatsapp-bot-startup.log | grep ERROR`
2. Verificar chat en modo BOT: `./diagnostics.sh`
3. Verificar que mensaje llegó: `curl ... /whatsapp/messages/...`
