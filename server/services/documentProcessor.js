import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { generateEmbedding } from './gemini.js';
import { upsertVectors } from './pgvector.js';

// NEW: Improved semantic chunking
export const chunkText = (text, maxChars = 1000, overlap = 200) => {
  console.log('📏 Original text length:', text.length, 'chars');
  
  // Clean the text first
  const cleanedText = preprocessText(text);
  
  // Split into paragraphs
  const paragraphs = cleanedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  console.log('📑 Found', paragraphs.length, 'paragraphs');
  
  const chunks = [];
  let currentChunk = '';
  let currentLength = 0;
  
  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    const paraLength = trimmedPara.length;
    
    // Skip headers/footers/tables of contents
    if (shouldSkipParagraph(trimmedPara)) {
      console.log('⏭️ Skipping paragraph:', trimmedPara.substring(0, 100));
      continue;
    }
    
    // If paragraph is too large, split it into sentences
    if (paraLength > maxChars) {
      const sentences = splitIntoSentences(trimmedPara);
      
      for (const sentence of sentences) {
        const sentenceLength = sentence.length;
        
        if (currentLength + sentenceLength > maxChars && currentLength > 0) {
          chunks.push(currentChunk.trim());
          
          // Add overlap
          const overlapText = getLastSentences(currentChunk, 2);
          currentChunk = overlapText + ' ' + sentence;
          currentLength = overlapText.length + 1 + sentenceLength;
        } else {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
          currentLength += (currentChunk ? 1 : 0) + sentenceLength;
        }
      }
    } else {
      // If adding this paragraph would exceed max size
      if (currentLength + paraLength > maxChars && currentLength > 0) {
        chunks.push(currentChunk.trim());
        
        // Add overlap
        const overlapText = getLastSentences(currentChunk, 2);
        currentChunk = overlapText + ' ' + trimmedPara;
        currentLength = overlapText.length + 1 + paraLength;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
        currentLength += (currentChunk ? 2 : 0) + paraLength;
      }
    }
  }
  
  // Add the last chunk if it exists
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  // Filter out poor quality chunks
  const filteredChunks = chunks.filter(chunk => isGoodChunk(chunk));
  
  console.log(`📦 Created ${filteredChunks.length} semantic chunks`);
  
  // Log sample chunks
  filteredChunks.slice(0, 3).forEach((chunk, i) => {
    console.log(`\n--- Chunk ${i + 1} (${chunk.length} chars) ---`);
    console.log(chunk.substring(0, 200) + '...');
  });
  
  return filteredChunks;
};

// NEW: Preprocess text to remove garbage
function preprocessText(text) {
  // Remove excessive whitespace but keep paragraph breaks
  let cleaned = text.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\r/g, '\n');
  
  // Remove page numbers and headers
  cleaned = cleaned.replace(/\n\d+\n/g, '\n\n'); // Line with just a number
  cleaned = cleaned.replace(/Page \d+ of \d+/gi, '');
  cleaned = cleaned.replace(/\f/g, '\n\n'); // Form feed to paragraph break
  
  // Fix hyphenated words across lines
  cleaned = cleaned.replace(/-\n/g, '');
  
  // Normalize multiple newlines to double newlines (paragraph breaks)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Remove multiple spaces on same line
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // Remove common PDF artifacts
  cleaned = cleaned.replace(/�/g, '');
  cleaned = cleaned.replace(/\x00/g, '');
  
  return cleaned.trim();
}

// NEW: Check if paragraph should be skipped
function shouldSkipParagraph(paragraph) {
  const lower = paragraph.toLowerCase();
  const words = paragraph.split(/\s+/).length;
  
  // Skip very short paragraphs
  if (words < 5) return true;
  
  // Skip table of contents entries
  const tocPatterns = [
    /^table of contents/i,
    /^contents\s*$/i,
    /^chapter\s+\d+/i,
    /^appendix\s+[a-z]/i,
    /^\d+(\.\d+)*\s+[A-Z]/i, // "2.1 Introduction" patterns
    /^[ivxlcdm]+\..*$/i, // Roman numerals
    /^\.{10,}$/, // Dotted lines
    /^–{10,}$/, // Dashed lines
    /^[\s\d\.]+$/, // Just numbers and dots
  ];
  
  if (tocPatterns.some(pattern => pattern.test(paragraph))) {
    return true;
  }
  
  // Skip headers/footers
  if (lower.includes('confidential') || 
      lower.includes('copyright') ||
      lower.includes('all rights reserved') ||
      lower.includes('page') && words < 8) {
    return true;
  }
  
  return false;
}

// NEW: Split text into sentences
function splitIntoSentences(text) {
  // Simple sentence splitting (improve as needed)
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

// NEW: Get last N sentences for overlap
function getLastSentences(text, n = 2) {
  const sentences = splitIntoSentences(text);
  return sentences.slice(-n).join(' ');
}

// NEW: Check if chunk is good quality
function isGoodChunk(chunk) {
  // Minimum length check
  if (chunk.length < 100) return false;
  
  // Word count check
  const words = chunk.split(/\s+/).length;
  if (words < 20) return false;
  
  // Check if it's mostly table of contents
  const lines = chunk.split('\n');
  const tocLines = lines.filter(line => /^\d+(\.\d+)*\s/.test(line));
  if (tocLines.length > lines.length / 2) return false;
  
  // Check if it has actual content (not just headers)
  const hasContent = /[a-z]{3,}/i.test(chunk); // At least one 3+ letter word
  if (!hasContent) return false;
  
  return true;
}

// NEW: Parse PDF with better options
export const parsePDF = async (buffer) => {
  try {
    // Use default pdf-parse text extraction for better compatibility
    const data = await pdfParse(buffer, {
      max: 0 // No page limit
    });
    
    console.log(`📄 PDF parsed: ${data.numpages} pages, ${data.text.length} chars`);
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF document');
  }
};

// NEW: Parse DOCX with better extraction
export const parseDOCX = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    console.log(`📄 DOCX parsed: ${result.value.length} chars`);
    return result.value;
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX document');
  }
};

// UPDATED: processDocument with improved logging
export const processDocument = async (file, documentId, documentTitle) => {
  try {
    console.log(`\n🔧 Processing document: ${documentTitle} (${file.mimetype})`);
    
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

    // Use improved chunking
    const chunks = chunkText(text);
    
    if (chunks.length === 0) {
      throw new Error('No valid content chunks found after processing');
    }
    
    console.log(`📤 Generating embeddings for ${chunks.length} chunks...`);

    const vectors = [];
    const failedChunks = [];
    
    // Process in batches with retry logic
    const batchSize = 10;
    const maxRetries = 3;
    
    for (let i = 0; i < chunks.length; i++) {
      let retries = 0;
      let success = false;
      
      while (!success && retries < maxRetries) {
        try {
          console.log(`🔧 Processing chunk ${i + 1}/${chunks.length}${retries > 0 ? ` (retry ${retries})` : ''}...`);
          
          const embedding = await generateEmbedding(chunks[i]);

          vectors.push({
            values: embedding,
            metadata: {
              text: chunks[i],
              documentId,
              documentTitle,
              chunkIndex: i,
              chunkLength: chunks[i].length,
              wordCount: chunks[i].split(/\s+/).length,
            },
          });

          success = true;

          // Add delay to avoid rate limiting - longer delay between batches
          if ((i + 1) % batchSize === 0 && i < chunks.length - 1) {
            console.log(`⏸️ Batch complete, waiting 2s before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          retries++;
          
          // Check if it's a rate limit error
          const isRateLimit = error.message?.includes('429') || 
                              error.message?.includes('rate limit') ||
                              error.message?.includes('Too Many Requests');
          
          if (isRateLimit && retries < maxRetries) {
            const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
            console.warn(`⚠️ Rate limit hit, waiting ${waitTime/1000}s before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            console.error(`❌ Error processing chunk ${i}:`, error.message);
            failedChunks.push(i);
            break;
          }
        }
      }
    }

    console.log(`✅ Successfully processed ${vectors.length}/${chunks.length} chunks`);
    
    if (failedChunks.length > 0) {
      console.warn(`⚠️ Failed chunks: ${failedChunks.join(', ')}`);
    }

    if (vectors.length === 0) {
      throw new Error('No vectors generated - all chunks failed');
    }

    // Store in database
    const upsertResult = await upsertVectors(documentId, vectors);
    
    console.log(`💾 Stored ${upsertResult.upsertedCount} vectors in database`);

    return {
      documentId,
      documentTitle,
      totalChunks: chunks.length,
      processedChunks: vectors.length,
      failedChunks: failedChunks.length,
      sampleChunk: chunks[0]?.substring(0, 300) + '...',
    };
  } catch (error) {
    console.error('❌ Error processing document:', error);
    throw error;
  }
};

// NEW: Test function
export const testChunking = async (sampleText) => {
  console.log('🧪 Testing chunking with sample text...');
  const chunks = chunkText(sampleText);
  
  console.log('\n📊 Chunk Analysis:');
  chunks.forEach((chunk, i) => {
    const words = chunk.split(/\s+/).length;
    const hasMedicalTerms = /(treatment|disease|patient|symptom|diagnosis|therapy)/i.test(chunk);
    const isCompleteSentence = /[.!?]$/.test(chunk.trim());
    
    console.log(`\nChunk ${i + 1}:`);
    console.log(`  Length: ${chunk.length} chars, ${words} words`);
    console.log(`  Medical content: ${hasMedicalTerms ? '✅' : '❌'}`);
    console.log(`  Complete sentence: ${isCompleteSentence ? '✅' : '❌'}`);
    console.log(`  Preview: ${chunk.substring(0, 150)}...`);
  });
  
  return chunks;
};