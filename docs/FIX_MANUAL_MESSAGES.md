# Fix: Frontend no Refleja Mensajes Enviados Manualmente

## Problema

Cuando un **operador envía un mensaje manualmente** desde el frontend web mediante la API REST, el mensaje **NO se reflejaba en el frontend** porque:

1. ❌ No se guardaba en MongoDB
2. ❌ No se emitía evento WebSocket `new-message`

Esto causaba que solo el operador que envió el mensaje lo viera, pero ningún otro usuario conectado al WebSocket.

---

## Solución Implementada

### Cambios en `sendText()`

**Antes:**
```typescript
async sendText(to: string, text: string) {
  if (this.status !== 'open') {
    throw new Error('WhatsApp is not connected');
  }
  return this.sock.sendMessage(to, { text }); // ❌ Solo enviaba
}
```

**Después:**
```typescript
async sendText(to: string, text: string) {
  if (this.status !== 'open') {
    throw new Error('WhatsApp is not connected');
  }

  // 1. Enviar mensaje por WhatsApp
  await this.sock.sendMessage(to, { text });

  // 2. Guardar mensaje en MongoDB
  const message = new this.messageModel({
    jid: to,
    fromMe: true,
    type: 'conversation',
    content: text,
    timestamp: new Date(),
  });
  await message.save();

  // 3. Actualizar último mensaje del chat
  await this.chatModel.updateOne(
    { jid: to },
    { $set: { lastMessage: message } },
    { upsert: true },
  );

  // 4. Emitir evento WebSocket ✅
  this.whatsappGateway.sendNewMessage(message.toJSON());

  return { success: true, message: message.toJSON() };
}
```

### Cambios en `sendMediaUpload()`

Misma lógica aplicada para envío de imágenes/videos/documentos:
- Guarda archivo localmente
- Guarda mensaje en MongoDB
- Actualiza chat
- Emite WebSocket

---

## Flujo Completo

### 1. Operador Envía Mensaje desde Frontend

```typescript
// Frontend hace POST request
fetch('http://localhost:3000/whatsapp/message/send/text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  },
  body: JSON.stringify({
    to: '5492804503151@s.whatsapp.net',
    text: 'Hola, ¿en qué puedo ayudarte?'
  })
});
```

### 2. Backend Procesa

1. ✅ Envía mensaje por WhatsApp
2. ✅ Guarda en MongoDB con `fromMe: true`
3. ✅ Actualiza `lastMessage` del chat
4. ✅ Emite `new-message` por WebSocket

### 3. Frontend Recibe Actualización

```typescript
// El listener del WhatsappContext recibe el evento
socket.on('new-message', (message) => {
  console.log('📨 Message from operator:', message);
  setMessages(prev => [...prev, message]);
});
```

### 4. UI se Actualiza Automáticamente

El mensaje aparece instantáneamente en todos los clientes conectados al WebSocket.

---

## Testing

### Test 1: Enviar Mensaje por API

```bash
curl -X POST http://localhost:3000/whatsapp/message/send/text \
  -H "Content-Type: application/json" \
  -H "x-api-key: my-secret-api-key" \
  -d '{
    "to": "5492804503151@s.whatsapp.net",
    "text": "Mensaje de prueba desde API"
  }'
```

**Esperado:**
```json
{
  "success": true,
  "message": {
    "_id": "...",
    "jid": "5492804503151@s.whatsapp.net",
    "fromMe": true,
    "content": "Mensaje de prueba desde API",
    ...
  }
}
```

### Test 2: Verificar en Frontend

**Consola del navegador debe mostrar:**
```
📨 New message received: {
  jid: "5492804503151@s.whatsapp.net",
  fromMe: true,
  content: "Mensaje de prueba desde API",
  ...
}
```

**UI debe actualizar** mostrando el mensaje automáticamente.

### Test 3: Verificar en MongoDB

```bash
curl -s http://localhost:3000/whatsapp/messages/5492804503151@s.whatsapp.net \
  -H "x-api-key: my-secret-api-key" | jq '.[-1]'
```

Debe mostrar el mensaje recién enviado.

---

## Comparación: Mensajes Automáticos vs Manuales

### Mensajes del Bot (Automáticos)
**Flujo:** WhatsApp → handleMessagesUpsert → processByBrain → sendText interno → WebSocket

**Características:**
- `fromMe: true`
- Generados por Gemini AI
- Guardados y emitidos dentro de `processByBrain`

### Mensajes del Operador (Manuales)
**Flujo:** Frontend → API REST → sendText → WhatsApp + MongoDB + WebSocket

**Características:**
- `fromMe: true`
- Escritos por humano
- Ahora también guardados y emitidos ✅

---

## Beneficios

1. ✅ **Sincronización completa** - Todos los clientes ven todos los mensajes
2. ✅ **Historial consistente** - MongoDB tiene registro completo
3. ✅ **Multi-operador** - Varios operadores pueden ver mensajes de otros
4. ✅ **Coherencia** - Mismo comportamiento para bot y operador

---

## Archivos Modificados

- `src/whatsapp/whatsapp.service.ts`
  - Método `sendText()` - Líneas 453-486
  - Método `sendMediaUpload()` - Líneas 488-537

---

## Estado Actual

✅ Bot responde automáticamente  
✅ Operador puede enviar mensajes manuales  
✅ Frontend recibe mensajes del bot en tiempo real  
✅ Frontend recibe mensajes del operador en tiempo real  
✅ MongoDB guarda todos los mensajes  
✅ WebSocket sincroniza a todos los clientes  

🎉 **Sistema completamente funcional y sincronizado!**
