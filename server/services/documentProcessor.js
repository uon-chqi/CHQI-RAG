import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { generateEmbedding } from './gemini.js';
import { upsertVectors } from './pinecone.js';

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

    const chunks = chunkText(text);
    console.log(`📄 Created ${chunks.length} chunks from document`);

    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i]);

        vectors.push({
          id: `${documentId}-chunk-${i}`,
          embedding,
          text: chunks[i],
          documentId,
          documentTitle,
          chunkIndex: i,
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing chunk ${i}:`, error);
      }
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
