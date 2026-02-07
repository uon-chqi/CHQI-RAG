import { CohereClient } from 'cohere-ai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Cohere for embeddings (FREE tier)
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// Initialize Gemini for chat
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const chatModelName = process.env.GEMINI_CHAT_MODEL || 'gemini-1.5-flash';

console.log(`🔑 Using Cohere for embeddings (embed-english-v3.0) and Gemini for chat (${chatModelName})`);

export const generateEmbedding = async (text) => {
  try {
    const response = await cohere.embed({
      texts: [text],
      model: 'embed-english-v3.0',
      inputType: 'search_document',
    });
    return response.embeddings[0];
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};

export const generateEmbeddings = async (texts) => {
  try {
    if (!texts || texts.length === 0) {
      return [];
    }

    console.log(`📊 Generating ${texts.length} embeddings with Cohere...`);
    
    // Cohere allows batch embedding up to 96 texts
    const batchSize = 96;
    const allEmbeddings = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const response = await cohere.embed({
          texts: batch,
          model: 'embed-english-v3.0',
          inputType: 'search_document',
        });
        
        allEmbeddings.push(...response.embeddings);
        console.log(`   ✓ Generated ${Math.min(i + batchSize, texts.length)}/${texts.length} embeddings`);
      } catch (error) {
        console.error(`⚠️ Failed batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      }
    }

    console.log(`✅ Generated ${allEmbeddings.length}/${texts.length} embeddings`);
    return allEmbeddings;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
};

export const generateResponse = async (prompt, context) => {
  try {
    const systemPrompt = `You are a helpful medical information assistant. Your role is to provide accurate, safe medical information based on the context provided.

IMPORTANT GUIDELINES:
1. Always base your answers on the provided medical documents
2. If the information is not in the context, say "I don't have enough information to answer that"
3. Always recommend consulting a healthcare professional for medical decisions
4. Never provide emergency medical advice - always direct to emergency services
5. Keep responses concise (under 160 characters when possible for SMS)
6. Include citation numbers [1], [2] for sources

Context from medical documents:
${context}

User question: ${prompt}

Provide a helpful, accurate response:`;

    const model = genAI.getGenerativeModel({ model: chatModelName });
    const result = await model.generateContent(systemPrompt);
    return result.response.text();
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
};

export const checkHealth = async () => {
  try {
    const model = genAI.getGenerativeModel({ model: chatModelName });
    const result = await model.generateContent('test');
    return { status: 'healthy', responseTime: Date.now(), provider: 'Gemini' };
  } catch (error) {
    return { status: 'down', error: error.message };
  }
};
