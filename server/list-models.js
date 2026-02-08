// list-models.js
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

async function listAvailableModels() {
  try {
    console.log('📋 Listing available models...');
    
    const response = await fetch('https://generativelanguage.googleapis.com/v1/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('\n✅ Available models:');
      data.models?.forEach(model => {
        console.log(`- ${model.name}`);
        console.log(`  Supported methods: ${model.supportedGenerationMethods?.join(', ') || 'none'}`);
        console.log(`  Description: ${model.description?.substring(0, 100)}...`);
        console.log('');
      });
    } else {
      const error = await response.json();
      console.log('❌ Error listing models:', error.error.message);
    }
  } catch (error) {
    console.log('❌ Fetch error:', error.message);
  }
}

listAvailableModels();
