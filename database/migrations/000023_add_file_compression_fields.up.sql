-- Add fields to track compressed file storage
-- compressed_size_bytes: size of the file as stored (compressed), NULL if not compressed
-- content_encoding: encoding used for storage (e.g., 'gzip'), NULL if stored raw

ALTER TABLE log_file
ADD COLUMN compressed_size_bytes BIGINT,
ADD COLUMN content_encoding TEXT;

COMMENT ON COLUMN log_file.size_bytes IS 'Original uncompressed file size in bytes';
COMMENT ON COLUMN log_file.compressed_size_bytes IS 'Compressed file size in bytes (NULL if stored uncompressed)';
COMMENT ON COLUMN log_file.content_encoding IS 'Content encoding used for storage (e.g., gzip), NULL if stored raw';
