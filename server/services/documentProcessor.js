import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { generateEmbedding, generateEmbeddings } from './gemini.js';
import { upsertVectors } from './pgvector.js';

export const chunkText = (text, chunkSize = 800, overlap = 200) => {
  const chunks = [];
  const words = text.split(/\s+/);
  let currentChunk = [];
  let currentLength = 0;

  for (const word of words) {
    currentChunk.push(word);
    currentLength += word.length + 1;

    if (currentLength >= chunkSize) {
      chunks.push(currentChunk.join(' '));

      const overlapWords = Math.floor(overlap / (currentLength / currentChunk.length));
      currentChunk = currentChunk.slice(-overlapWords);
      currentLength = currentChunk.reduce((sum, w) => sum + w.length + 1, 0);
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
};

export const parsePDF = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF document');
  }
};

export const parseDOCX = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX document');
  }
};

export const processDocument = async (file, documentId, documentTitle) => {
  try {
    let text = '';

    if (file.mimetype === 'application/pdf') {
      text = await parsePDF(file.buffer);
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      text = await parseDOCX(file.buffer);
    } else {
      throw new Error('Unsupported file type. Please upload PDF or DOCX files.');
    }

    text = text.replace(/\s+/g, ' ').trim();

    if (!text) {
      throw new Error('Document has no extractable text. Please upload a text-based PDF or DOCX.');
    }

    const chunks = chunkText(text);
    console.log(`📄 Created ${chunks.length} chunks from document`);

    if (chunks.length === 0) {
      throw new Error('Document produced no chunks. Please verify the file contains readable text.');
    }

    const vectors = [];
    const batchSize = Number(process.env.EMBEDDING_BATCH_SIZE || 50);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      try {
        const embeddings = await generateEmbeddings(batchChunks);

        embeddings.forEach((embedding, idx) => {
          const chunkIndex = i + idx;
          vectors.push({
            id: `${documentId}-chunk-${chunkIndex}`,
            embedding,
            text: batchChunks[idx],
            documentId,
            documentTitle,
            chunkIndex,
          });
        });
      } catch (error) {
        console.error(`Error processing chunk batch starting at ${i}:`, error);
      }
    }

    if (vectors.length === 0) {
      throw new Error('No embeddings were generated for this document. Please retry or check your embedding API configuration.');
    }

    await upsertVectors(vectors);

    return {
      totalChunks: chunks.length,
      processedChunks: vectors.length,
      text: text.substring(0, 500),
    };
  } catch (error) {
    console.error('Error processing document:', error);
    throw error;
  }
};
