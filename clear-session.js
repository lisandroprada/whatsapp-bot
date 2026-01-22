const { MongoClient } = require('mongodb');

// Lee el archivo .env
require('dotenv').config();

async function clearWhatsappSession() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost/nest-whatsapp';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    const db = client.db();
    const result = await db.collection('whatsapp_sessions').deleteMany({});

    console.log(`✅ Sesiones eliminadas: ${result.deletedCount}`);
    console.log('🔄 Ahora reinicia el servidor para generar un nuevo QR');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

clearWhatsappSession();
