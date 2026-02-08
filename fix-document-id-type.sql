-- Fix document_id type in document_vectors table (should be UUID not INTEGER)

-- Drop and recreate the table with correct UUID type
DROP TABLE IF EXISTS document_vectors CASCADE;

CREATE TABLE document_vectors (
  id SERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1024) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_document_vectors_document_id ON document_vectors(document_id);
CREATE INDEX idx_document_vectors_embedding ON document_vectors USING hnsw (embedding vector_cosine_ops);

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'document_vectors' 
ORDER BY ordinal_position;
