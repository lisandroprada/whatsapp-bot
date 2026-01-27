# Integración WhatsApp Bot - Validación de Números Móviles

## 🚨 Solución al Problema: "El número debe ser un celular"

Este documento explica cómo resolver el problema donde números móviles válidos (como `2804503151` de Chubut) no son reconocidos como móviles por el sistema backoffice.

## 📱 Endpoints Específicos para Validación

### 1. **Verificar si un número es móvil**

```http
POST /whatsapp/utils/is-mobile
Content-Type: application/json
x-api-key: {API_KEY}

{
  "phone": "2804503151"
}
```

**Respuesta:**

```json
{
  "phone": "2804503151",
  "cleaned": "2804503151",
  "isMobile": true,
  "isChubutMobile": true,
  "explanation": "Número móvil válido para WhatsApp",
  "formattedPhone": "+5492804503151",
  "displayFormat": "(280) 450-3151"
}
```

### 2. **Validación específica de números de Chubut**

```http
POST /whatsapp/utils/validate-chubut
Content-Type: application/json
x-api-key: {API_KEY}

{
  "phone": "2804503151"
}
```

**Respuesta:**

```json
{
  "phone": "2804503151",
  "isValidChubut": true,
  "isValidMobile": true,
  "isValid": true,
  "details": {
    "formatted": "+5492804503151",
    "display": "(280) 450-3151",
    "whatsappJid": "5492804503151@s.whatsapp.net"
  },
  "message": "Número de Chubut válido para WhatsApp"
}
```

### 3. **Validación completa de número**

```http
POST /whatsapp/utils/validate-phone
Content-Type: application/json
x-api-key: {API_KEY}

{
  "phone": "2804503151"
}
```

## 🔧 Integración en el Backoffice

### **JavaScript/TypeScript (Frontend)**

```javascript
// Configuración
const WHATSAPP_BOT_URL = 'http://localhost:3011'; // Ajustar según entorno
const API_KEY = 'my-secret-api-key'; // Usar la API key correcta

// Función para verificar si un número es móvil
async function isPhoneMobile(phone) {
  try {
    const response = await fetch(
      `${WHATSAPP_BOT_URL}/whatsapp/utils/is-mobile`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ phone }),
      },
    );

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error validating mobile:', error);
    return { isMobile: false, explanation: 'Error de validación' };
  }
}

// Uso en formulario de cliente
async function validateClientPhone(phoneInput) {
  const phone = phoneInput.value.trim();

  if (!phone) return;

  const validation = await isPhoneMobile(phone);
  const messageDiv = document.getElementById('phone-validation-message');

  if (validation.isMobile) {
    messageDiv.innerHTML = `
      <div class="success">
        ✅ ${validation.explanation}<br>
        Formato: ${validation.displayFormat}
      </div>
    `;
    messageDiv.className = 'validation-message success';

    // Formatear el input con el formato amigable
    phoneInput.value = validation.displayFormat;
  } else {
    messageDiv.innerHTML = `
      <div class="error">
        ❌ ${validation.explanation}<br>
        WhatsApp solo funciona con números celulares.
      </div>
    `;
    messageDiv.className = 'validation-message error';
  }
}

// Integrar en evento blur del input
document
  .getElementById('clientPhoneInput')
  .addEventListener('blur', function () {
    validateClientPhone(this);
  });
```

### **PHP (Backend)**

```php
<?php
class WhatsAppValidator {
    private $whatsappBotUrl;
    private $apiKey;

    public function __construct($whatsappBotUrl, $apiKey) {
        $this->whatsappBotUrl = $whatsappBotUrl;
        $this->apiKey = $apiKey;
    }

    public function isPhoneMobile($phone) {
        $url = $this->whatsappBotUrl . '/whatsapp/utils/is-mobile';
        $data = json_encode(['phone' => $phone]);

        $options = [
            'http' => [
                'header' => [
                    'Content-Type: application/json',
                    'x-api-key: ' . $this->apiKey
                ],
                'method' => 'POST',
                'content' => $data
            ]
        ];

        $context = stream_context_create($options);
        $result = file_get_contents($url, false, $context);

        return json_decode($result, true);
    }

    public function validateClientPhone($phone) {
        $validation = $this->isPhoneMobile($phone);

        if ($validation['isMobile']) {
            return [
                'valid' => true,
                'message' => $validation['explanation'],
                'formatted' => $validation['formattedPhone'],
                'display' => $validation['displayFormat']
            ];
        } else {
            return [
                'valid' => false,
                'message' => $validation['explanation'],
                'error' => 'WhatsApp solo funciona con números celulares'
            ];
        }
    }
}

// Uso
$validator = new WhatsAppValidator('http://localhost:3011', 'my-secret-api-key');

// En el controlador de actualización de cliente
if ($_POST['whatsapp_number']) {
    $result = $validator->validateClientPhone($_POST['whatsapp_number']);

    if ($result['valid']) {
        // Guardar en base de datos usando el número formateado
        $clientData['whatsapp'] = $result['formatted'];
        $clientData['whatsapp_display'] = $result['display'];

        updateClient($clientId, $clientData);
        echo json_encode(['success' => true, 'message' => $result['message']]);
    } else {
        echo json_encode(['success' => false, 'error' => $result['error']]);
    }
}
?>
```

### **Python (Django/Flask)**

```python
import requests
import json

class WhatsAppValidator:
    def __init__(self, whatsapp_bot_url, api_key):
        self.whatsapp_bot_url = whatsapp_bot_url
        self.api_key = api_key

    def is_phone_mobile(self, phone):
        url = f"{self.whatsapp_bot_url}/whatsapp/utils/is-mobile"
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': self.api_key
        }
        data = {'phone': phone}

        try:
            response = requests.post(url, headers=headers, json=data)
            return response.json()
        except Exception as e:
            return {'isMobile': False, 'explanation': f'Error de validación: {e}'}

    def validate_client_phone(self, phone):
        validation = self.is_phone_mobile(phone)

        if validation.get('isMobile'):
            return {
                'valid': True,
                'message': validation['explanation'],
                'formatted': validation['formattedPhone'],
                'display': validation['displayFormat']
            }
        else:
            return {
                'valid': False,
                'message': validation['explanation'],
                'error': 'WhatsApp solo funciona con números celulares'
            }

# Uso en Django view
from django.http import JsonResponse

def update_client_whatsapp(request, client_id):
    if request.method == 'POST':
        phone = request.POST.get('whatsapp_number')

        if phone:
            validator = WhatsAppValidator('http://localhost:3011', 'my-secret-api-key')
            result = validator.validate_client_phone(phone)

            if result['valid']:
                # Actualizar en base de datos
                client = Client.objects.get(id=client_id)
                client.whatsapp = result['formatted']
                client.whatsapp_display = result['display']
                client.save()

                return JsonResponse({'success': True, 'message': result['message']})
            else:
                return JsonResponse({'success': False, 'error': result['error']})
```

## 📋 Casos de Prueba Específicos

### **Números que DEBEN funcionar:**

```javascript
// Todos estos formatos del mismo número deben validar como móvil válido:
const testCases = [
  '2804503151',
  '02804503151',
  '280 450-3151',
  '(280) 450-3151',
  '+54 9 280 450-3151',
  '+5492804503151',
  '5492804503151',
];

for (const phone of testCases) {
  const result = await isPhoneMobile(phone);
  console.log(
    `${phone}: ${result.isMobile ? '✅' : '❌'} ${result.explanation}`,
  );
}
```

### **Códigos de área móviles soportados:**

- **Chubut**: `280`, `281`
- **Buenos Aires**: `911`, `915`, `916`, `920-927`
- **Mendoza**: `261`, `263`, `264`, `266`
- **Córdoba**: `351`, `353`, `354`, `358`
- **Santa Cruz**: `297`, `299`
- **Y muchos más...**

## ⚠️ Importante para Producción

1. **URL del WhatsApp Bot**: Cambiar `http://localhost:3011` por la URL de producción
2. **API Key**: Usar la API key real de producción, no `my-secret-api-key`
3. **Manejo de errores**: Implementar retry y fallback strategies
4. **Cache**: Considerar cachear resultados de validación para mejorar performance

## 🔄 Migración de Clientes Existentes

Para clientes que ya tienen números móviles pero no están marcados como WhatsApp:

```javascript
// Endpoint para auto-detección masiva
async function autoDetectExistingClients(clientIds) {
  const response = await fetch(`${WHATSAPP_BOT_URL}/whatsapp/auto-detect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ clientIds }),
  });

  return response.json();
}

// Ejecutar para todos los clientes con teléfono móvil
const clientIds = ['client_001', 'client_002', 'client_003']; // Obtener de BD
const result = await autoDetectExistingClients(clientIds);
console.log(`Actualizados: ${result.updated}, Fallidos: ${result.failed}`);
```

---

**🎯 Con esta integración, el problema "El número debe ser un celular" quedará completamente resuelto para números móviles válidos como `2804503151`.**
