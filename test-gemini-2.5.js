// Test directo de Gemini 2.5 Flash
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = 'AIzaSyA9EIEToBDy1tDCOW0SW9ZdaN7c79nw488';
const genAI = new GoogleGenerativeAI(apiKey);

async function test() {
  try {
    console.log('Testing gemini-2.5-flash...');
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    });

    const prompt = `Eres un asistente virtual. Usuario dice: "Hola". Responde brevemente.`;
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    console.log('✅ SUCCESS!');
    console.log('Response:', text);
  } catch (error) {
    console.error('❌ ERROR:');
    console.error('Message:', error.message);
    console.error('Status:', error.status);
    console.error('Full error:', JSON.stringify(error, null, 2));
  }
}

test();
