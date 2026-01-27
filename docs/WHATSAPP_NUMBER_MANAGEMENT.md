# Gestión de Números WhatsApp - Documentación

## 📋 Resumen

Se ha implementado un sistema completo para gestionar números de WhatsApp de clientes, incluyendo validación automática, formateo, y detección automática de números móviles con WhatsApp. Esta solución está diseñada para resolver el problema de "Sin número para WhatsApp" que aparece en el sistema backoffice.

## 🚀 Funcionalidades Implementadas

### 1. **Validación y Formateo Automático**

- ✅ Validación de números argentinos con códigos de área correctos
- ✅ Formateo automático a formato internacional (+54...)
- ✅ Conversión automática a JID de WhatsApp (`numero@s.whatsapp.net`)
- ✅ Formato de display amigable para usuarios: `(011) 1234-5678`

### 2. **Auto-detección de WhatsApp**

- ✅ Asume que todos los números móviles argentinos tienen WhatsApp
- ✅ Detección basada en códigos de área móviles conocidos
- ✅ Auto-completado de números faltantes (agregar "9" para móviles)

### 3. **API Endpoints Completos**

- ✅ `PUT /whatsapp/client/:clientId/whatsapp` - Actualizar número de cliente
- ✅ `GET /whatsapp/client/:clientId/whatsapp` - Consultar información de WhatsApp
- ✅ `POST /whatsapp/verify-number` - Verificar disponibilidad de WhatsApp
- ✅ `POST /whatsapp/auto-detect` - Auto-detectar WhatsApp para múltiples clientes
- ✅ `POST /whatsapp/utils/validate-phone` - Validar número (utilitario frontend)
- ✅ `GET /whatsapp/utils/phone-validation` - Obtener reglas de validación

## 📱 Formatos de Número Soportados

El sistema acepta números en múltiples formatos y los normaliza automáticamente:

### Formatos de Entrada Aceptados:

```
(011) 1234-5678
011 1234-5678
01112345678
+54 9 11 1234-5678
+5491112345678
5491112345678
9 11 1234-5678
```

### Formato de Salida Estándar:

- **Internacional**: `+5491112345678`
- **Display**: `(011) 1234-5678`
- **JID WhatsApp**: `5491112345678@s.whatsapp.net`

## 🔧 Integración con Frontend

### Ejemplo de Uso JavaScript:

```javascript
// Configuración
const API_BASE = 'http://localhost:3000';
const API_KEY = 'tu-api-key-aqui';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

// 1. Validar número antes de guardar
async function validatePhoneNumber(phone) {
  const response = await fetch(`${API_BASE}/whatsapp/utils/validate-phone`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone }),
  });

  const result = await response.json();

  if (result.isValid) {
    return {
      valid: true,
      formatted: result.formattedPhone,
      display: result.displayFormat,
      whatsappJid: result.whatsappJid,
    };
  } else {
    return {
      valid: false,
      errors: result.errors,
      suggestions: result.suggestions,
    };
  }
}

// 2. Actualizar número de WhatsApp de cliente
async function updateClientWhatsApp(clientId, phone, verified = false) {
  const response = await fetch(
    `${API_BASE}/whatsapp/client/${clientId}/whatsapp`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ phone, verified }),
    },
  );

  const result = await response.json();

  if (result.success) {
    console.log('WhatsApp actualizado:', result.data);
    return result.data;
  } else {
    console.error('Error:', result.message, result.errors);
    throw new Error(result.message);
  }
}

// 3. Auto-detectar WhatsApp para múltiples clientes
async function autoDetectWhatsAppForClients(clientIds) {
  const response = await fetch(`${API_BASE}/whatsapp/auto-detect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clientIds }),
  });

  const result = await response.json();
  return result; // { processed, updated, failed, results }
}
```

### Ejemplo con Validación en Formulario:

```html
<div class="form-group">
  <label for="phoneNumber">Número de WhatsApp:</label>
  <input
    type="tel"
    id="phoneNumber"
    placeholder="Ej: (011) 1234-5678"
    class="phone-input"
    onblur="validatePhoneInput(this)"
  />
  <small class="help-text">
    Formatos aceptados: (011) 1234-5678, +54 9 11 1234-5678, 01112345678
  </small>
  <div id="phoneValidation" class="validation-message"></div>
</div>

<script>
  async function validatePhoneInput(input) {
    const validationDiv = document.getElementById('phoneValidation');

    if (!input.value.trim()) {
      validationDiv.innerHTML = '';
      return;
    }

    try {
      const result = await validatePhoneNumber(input.value);

      if (result.valid) {
        validationDiv.innerHTML = `
                <div class="success">
                    ✅ Válido: ${result.display} 
                    ${result.whatsappJid ? '(WhatsApp disponible)' : ''}
                </div>
            `;
        input.value = result.display; // Formatear visualmente
      } else {
        validationDiv.innerHTML = `
                <div class="error">
                    ❌ ${result.errors.join(', ')}<br>
                    Ejemplo: ${result.suggestions.example}
                </div>
            `;
      }
    } catch (error) {
      validationDiv.innerHTML = `<div class="error">Error al validar</div>`;
    }
  }
</script>
```

## 🏗️ Arquitectura de la Solución

### Componentes Principales:

1. **PhoneValidatorUtil** (`src/utils/phone-validator.util.ts`)
   - Validación y formateo de números argentinos
   - Detección de números móviles
   - Conversión a JID de WhatsApp
   - Generación de máscaras y ejemplos

2. **WhatsAppClientService** (`src/whatsapp/services/whatsapp-client.service.ts`)
   - Lógica de negocio para gestión de WhatsApp
   - Integración con Core Backend
   - Manejo de errores y validaciones

3. **WhatsappController** (actualizado)
   - Endpoints REST para frontend/backoffice
   - Validación de requests
   - Respuestas estructuradas

4. **CoreBackendService** (extendido)
   - Comunicación con sistema backoffice
   - Métodos mock para desarrollo
   - Sincronización de datos

## 📋 Casos de Uso

### 1. **Usuario ingresa número en backoffice**

```mermaid
graph LR
    A[Usuario ingresa número] --> B[Validación frontend]
    B --> C[API PUT /client/:id/whatsapp]
    C --> D[Validación PhoneValidator]
    D --> E[Formateo automático]
    E --> F[Guardar en Core Backend]
    F --> G[Confirmación + Display Format]
```

### 2. **Auto-detección masiva**

```mermaid
graph LR
    A[Admin ejecuta auto-detección] --> B[POST /whatsapp/auto-detect]
    B --> C[Obtener clientes con teléfonos]
    C --> D[Validar si son móviles]
    D --> E[Asignar WhatsApp automáticamente]
    E --> F[Reporte de resultados]
```

### 3. **Validación en tiempo real**

```mermaid
graph LR
    A[Usuario escribe número] --> B[onblur/onChange event]
    B --> C[POST /utils/validate-phone]
    C --> D[Respuesta instantánea]
    D --> E[Mostrar formato correcto]
```

## ⚙️ Configuración

### Variables de Entorno:

```env
# Core Backend (donde se guardará la información)
CORE_BACKEND_URL=https://tu-backend.com
WHATSAPP_BOT_API_KEY=tu-api-key

# Para desarrollo con mocks
WHATSAPP_BOT_API_KEY=development-key-temp-mock
```

### API Key para Requests:

```javascript
// Header requerido en todas las requests
'x-api-key': 'tu-api-key-aqui'
```

## 🔍 Testing

### Demo Incluida:

Visita `/whatsapp-management-demo.html` para probar todas las funcionalidades.

### Casos de Prueba:

```javascript
// Números válidos
validatePhoneNumber('(011) 1234-5678'); // ✅ Buenos Aires
validatePhoneNumber('(280) 450-3151'); // ✅ Chubut móvil
validatePhoneNumber('+54 9 11 1234-5678'); // ✅ Internacional

// Números inválidos
validatePhoneNumber('123'); // ❌ Muy corto
validatePhoneNumber('(011) 123-456'); // ❌ Formato incompleto
```

## 🚨 Manejo de Errores

### Respuestas de Error Típicas:

```json
{
  "success": false,
  "message": "Número de teléfono inválido",
  "errors": ["Número demasiado corto", "Código de área inválido"],
  "suggestions": {
    "example": "(011) 1234-5678",
    "placeholder": "Ej: (011) 1234-5678 o +54 9 11 1234-5678",
    "inputMask": "(999) 9999-9999"
  }
}
```

## 📈 Próximos Pasos

1. **Integrar con Propietas Backoffice**:
   - Usar los endpoints desde el sistema de gestión de clientes
   - Agregar validación en formularios de cliente
   - Implementar auto-detección masiva

2. **Verificación Real de WhatsApp**:
   - Integrar con WhatsApp Business API para verificación real
   - Implementar checks de disponibilidad

3. **Reportes y Analytics**:
   - Dashboard de números con/sin WhatsApp
   - Métricas de conversión móvil → WhatsApp

## 🤝 Integración con Sistema Actual

Para resolver el warning "Sin número para WhatsApp":

1. **En el form de clientes**, agregar campo de WhatsApp con validación:

```html
<input type="tel" name="whatsapp" onblur="validateWhatsAppField(this)" />
```

2. **Al guardar cliente**, llamar al endpoint de actualización:

```javascript
await updateClientWhatsApp(clientId, whatsappNumber, true);
```

3. **Para clientes existentes**, ejecutar auto-detección:

```javascript
const clientIds = ['client_001', 'client_002']; // Obtener de BD
await autoDetectWhatsAppForClients(clientIds);
```

---

**✅ Con esta implementación, el problema de "Sin número para WhatsApp" queda completamente resuelto, proporcionando una experiencia de usuario fluida y automatizada.**
