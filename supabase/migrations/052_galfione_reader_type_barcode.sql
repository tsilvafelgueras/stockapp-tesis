-- Cambiar Tintorería Galfione de reader_type='qr' a reader_type='barcode'.
-- Galfione usa etiquetas de código de barras, no QR.
-- Idempotente: UPDATE no falla si ya está en 'barcode'.
UPDATE tintorerias
SET reader_type = 'barcode'
WHERE nombre ILIKE '%galfione%';
