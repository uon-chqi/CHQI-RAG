import { generateEmbedding, generateResponse } from './gemini.js';
import { queryVectors } from './pinecone.js';
import { query } from '../config/database.js';

export const processQuery = async (message, phoneNumber, channel) => {
  const startTime = Date.now();

  try {
    const queryEmbedding = await generateEmbedding(message);

    const relevantChunks = await queryVectors(queryEmbedding, 5);

    if (relevantChunks.length === 0) {
      return {
        response: "I don't have enough medical information to answer that question. Please consult a healthcare professional.",
        citations: [],
        responseTime: Date.now() - startTime,
      };
    }

    const context = relevantChunks
      .map((chunk, idx) => `[${idx + 1}] ${chunk.text} (Source: ${chunk.documentTitle})`)
      .join('\n\n');

    const citations = relevantChunks.map((chunk, idx) => ({
      index: idx + 1,
      documentTitle: chunk.documentTitle,
      documentId: chunk.documentId,
      score: chunk.score,
      text: chunk.text.substring(0, 100),
    }));

    const aiResponse = await generateResponse(message, context);

    const responseTime = Date.now() - startTime;

    const result = await query(
      `INSERT INTO conversations (patient_phone, channel, message, response, citations, response_time_ms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [phoneNumber, channel, message, aiResponse, JSON.stringify(citations), responseTime, 'sent']
    );

    const conversation = result.rows[0];

    await updateSession(phoneNumber, channel);

    return {
      response: aiResponse,
      citations,
      responseTime,
      conversationId: conversation?.id,
    };
  } catch (error) {
    console.error('Error processing query:', error);

    await query(
      `INSERT INTO conversations (patient_phone, channel, message, status, error_message, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [phoneNumber, channel, message, 'error', error.message, Date.now() - startTime]
    );

    throw error;
  }
};

const updateSession = async (phoneNumber, channel) => {
  try {
    const result = await query(
      `SELECT * FROM sessions
       WHERE patient_phone = $1 AND channel = $2 AND expires_at > $3`,
      [phoneNumber, channel, new Date().toISOString()]
    );

    if (result.rows.length > 0) {
      const existingSession = result.rows[0];
      await query(
        `UPDATE sessions
         SET message_count = $1, last_message_at = $2, expires_at = $3
         WHERE id = $4`,
        [
          existingSession.message_count + 1,
          new Date().toISOString(),
          new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          existingSession.id,
        ]
      );
    } else {
      await query(
        `INSERT INTO sessions (patient_phone, channel, message_count, last_message_at, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [phoneNumber, channel, 1, new Date().toISOString(), new Date(Date.now() + 30 * 60 * 1000).toISOString()]
      );
    }
  } catch (error) {
    console.error('Error updating session:', error);
  }
};

export const checkRateLimit = async (phoneNumber, channel) => {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    const result = await query(
      'SELECT id FROM conversations WHERE patient_phone = $1 AND channel = $2 AND created_at >= $3',
      [phoneNumber, channel, oneMinuteAgo]
    );

    const count = result.rows.length;

    return {
      allowed: count < 5,
      count,
      limit: 5,
      resetIn: 60,
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return { allowed: true, count: 0, limit: 5 };
  }
};
