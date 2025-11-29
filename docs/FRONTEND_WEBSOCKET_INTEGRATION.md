# Frontend WebSocket Integration - Mensajes en Tiempo Real

## Problema Identificado

El frontend **NO estaba escuchando el evento `new-message`** del WebSocket, por lo que los mensajes no se actualizaban en tiempo real.

## Solución Implementada

### Cambios en WhatsappContext

#### 1. Agregar Interface para Message

```typescript
interface Message {
  _id: string;
  jid: string;
  fromMe: boolean;
  type: string;
  content: string;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}
```

#### 2. Actualizar WhatsappContextType

```typescript
interface WhatsappContextType {
  // ... campos existentes
  messages: Message[];      // ← NUEVO
  clearMessages: () => void; // ← NUEVO
}
```

#### 3. Agregar State para Messages

```typescript
const [messages, setMessages] = useState<Message[]>([]);
```

#### 4. Agregar Listener de new-message

```typescript
newSocket.on('new-message', (message: Message) => {
  console.log('📨 New message received:', message);
  setMessages(prev => {
    // Evitar duplicados
    const exists = prev.some(msg => msg._id === message._id);
    if (exists) return prev;
    return [...prev, message];
  });
});
```

#### 5. Exponer en el Context Value

```typescript
const value = {
  // ... valores existentes
  messages,
  clearMessages: () => setMessages([]),
};
```

---

## Cómo Usar en tu Aplicación

### 1. Reemplazar WhatsappContext

Copia el contenido de `frontend-whatsapp-context-updated.tsx` a tu archivo de contexto actual.

### 2. Usar en Componentes

```typescript
import { useWhatsapp } from './WhatsappContext';

function MyComponent() {
  const { messages, isConnected } = useWhatsapp();

  return (
    <div>
      <h2>Mensajes ({messages.length})</h2>
      {messages.map(msg => (
        <div key={msg._id}>
          <strong>{msg.fromMe ? 'Bot' : 'Usuario'}:</strong>
          <p>{msg.content}</p>
        </div>
      ))}
    </div>
  );
}
```

### 3. Ejemplo Completo

Ver `frontend-example-messages-component.tsx` para un componente completo con:
- Auto-scroll a último mensaje
- Diseño responsive
- Estilos CSS incluidos
- Manejo de estados (conectado/desconectado/sin mensajes)

---

## Eventos WebSocket Disponibles

### Eventos que el Frontend ESCUCHA

| Evento | Datos | Descripción |
|--------|-------|-------------|
| `connect` | - | Socket conectado exitosamente |
| `disconnect` | - | Socket desconectado |
| `status` | `{ status: string }` | Estado de WhatsApp (connecting/open/closed) |
| `qr` | `{ qr: string }` | QR code en base64 |
| `log` | `{ message: string }` | Log del servidor |
| `new-message` | `Message` | Nuevo mensaje recibido o enviado |

### Eventos que el Frontend EMITE

Ninguno actualmente. El frontend usa REST API para acciones:

- `POST /whatsapp/session/connect` - Conectar WhatsApp
- `POST /whatsapp/session/disconnect` - Desconectar
- `POST /whatsapp/session/clear` - Logout completo
- `GET /whatsapp/session/status` - Estado actual

---

## Testing

### 1. Abrir Consola del Navegador

```javascript
// Ver si el WebSocket está conectado
console.log('Socket status:', socket?.connected);

// Ver mensajes recibidos
console.log('Messages:', messages);
```

### 2. Enviar Mensaje de WhatsApp

Desde tu WhatsApp (número +54 280 450-3151), envía: `"Hola"`

### 3. Verificar en Console

Deberías ver:
```
📨 New message received: {
  _id: "...",
  jid: "5492804503151@s.whatsapp.net",
  fromMe: false,
  content: "Hola",
  ...
}

📨 New message received: {
  _id: "...",
  jid: "5492804503151@s.whatsapp.net",
  fromMe: true,
  content: "¡Hola Lisandro! ¿En qué puedo ayudarte hoy? 😊",
  ...
}
```

### 4. Verificar en UI

Los mensajes deben aparecer automáticamente en el componente que muestra los mensajes.

---

## Troubleshooting

### Problema: Los mensajes no aparecen

**Verificar:**
1. WebSocket conectado: `socket?.connected` debe ser `true`
2. Listener agregado: Buscar `newSocket.on('new-message'` en el código
3. Logs en consola: Debe mostrar "📨 New message received"

**Solución:**
- Recargar la página
- Verificar que WhatsApp esté conectado (`isConnected === true`)
- Verificar que el servidor esté corriendo (`http://localhost:3000`)

### Problema: Mensajes duplicados

**Causa:** El listener se registra múltiples veces.

**Solución:** Asegurar que el `useEffect` tenga array de dependencias vacío `[]`

### Problema: WebSocket se desconecta constantemente

**Verificar:**
- CORS configurado en el backend
- Ningún firewall bloqueando WebSocket
- Servidor en `http://localhost:3000` accesible

---

## Próximos Pasos

### Funcionalidades Adicionales Sugeridas

1. **Filtrar mensajes por chat (JID)**
   ```typescript
   const filteredMessages = messages.filter(msg => msg.jid === selectedJid);
   ```

2. **Agrupar por conversación**
   ```typescript
   const chats = messages.reduce((acc, msg) => {
     if (!acc[msg.jid]) acc[msg.jid] = [];
     acc[msg.jid].push(msg);
     return acc;
   }, {});
   ```

3. **Notificaciones de nuevos mensajes**
   ```typescript
   useEffect(() => {
     if (msg.fromMe === false) {
       new Notification('Nuevo mensaje', { body: msg.content });
     }
   }, [messages]);
   ```

4. **Cargar historial al abrir chat**
   ```typescript
   const loadHistory = async (jid: string) => {
     const response = await fetch(`${API_URL}/whatsapp/messages/${jid}`, {
       headers: { 'x-api-key': API_KEY }
     });
     const history = await response.json();
     setMessages(history);
   };
   ```

---

## Archivos de Referencia

- `frontend-whatsapp-context-updated.tsx` - Context actualizado
- `frontend-example-messages-component.tsx` - Componente de ejemplo
- `FRONTEND_INTEGRATION.md` - Documentación original del sistema

---

## Estado Actual

✅ WebSocket configurado  
✅ Listener `new-message` agregado  
✅ Messages state implementado  
✅ Anti-duplicados implementado  
✅ Auto-scroll a último mensaje  
✅ Componente de ejemplo creado  

🎉 **El frontend ahora recibe mensajes en tiempo real!**
