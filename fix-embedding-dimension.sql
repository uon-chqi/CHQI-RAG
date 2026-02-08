-- Update vector dimension from 1024 (Cohere) to 384 (local model)
-- This change is for using local embeddings with all-MiniLM-L6-v2

-- Drop existing index
DROP INDEX IF EXISTS idx_document_vectors_embedding;

-- Alter the column type to 384 dimensions
ALTER TABLE document_vectors ALTER COLUMN embedding TYPE vector(384);

-- Recreate the index
CREATE INDEX idx_document_vectors_embedding ON document_vectors USING hnsw (embedding vector_cosine_ops);

-- Clear existing vectors (they're incompatible with new dimension)
TRUNCATE document_vectors;

-- Reset document status to allow re-processing
UPDATE documents SET status = 'processing', total_chunks = 0, processed_at = NULL WHERE status = 'completed';
