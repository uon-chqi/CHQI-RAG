import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const generateEmbedding = async (text) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
};

export const generateResponse = async (prompt, context) => {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    });

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

    const result = await model.generateContent(systemPrompt);
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
};

export const checkHealth = async () => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const result = await model.generateContent('test');
    return { status: 'healthy', responseTime: Date.now() };
  } catch (error) {
    return { status: 'down', error: error.message };
  }
};
