import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyA9EIEToBDy1tDCOW0SW9ZdaN7c79nw488';
  
  console.log('Testing Gemini API...');
  console.log('API Key:', apiKey.substring(0, 20) + '...');
  
  // Try different model names
  const modelsToTry = [
    'gemini-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash-latest',
    'models/gemini-pro'
  ];

  for (const modelName of modelsToTry) {
    try {
      console.log(`\nTrying model: ${modelName}...`);
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
      });

      const result = await model.generateContent('Hola, responde brevemente: ¿Qué es 2+2?');
      const response = result.response;
      const text = response.text();
      
      console.log(`✅ Model ${modelName} is working!`);
      console.log('Response:', text);
      break;
    } catch (error) {
      console.error(`❌ Model ${modelName} failed:`, error.message);
    }
  }
}

testGemini();
