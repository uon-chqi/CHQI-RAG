-- Fix vector dimensions and clean up incomplete documents

-- Update vector dimension from 768 to 1024 (for Cohere)
ALTER TABLE document_vectors ALTER COLUMN embedding TYPE vector(1024);

-- Delete incomplete documents (no vectors or not completed)
DELETE FROM documents WHERE status != 'completed' OR total_chunks = 0;

-- Clear all existing vectors (they were created with wrong dimensions)
DELETE FROM document_vectors;

-- Show remaining documents
SELECT id, title, status, total_chunks FROM documents ORDER BY uploaded_at DESC;
