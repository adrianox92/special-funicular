/**
 * Ficha técnica PDF pública por UUID (p. ej. QR impreso sin sesión).
 */
const express = require('express');
const { getAnonClient } = require('../lib/supabaseClients');
const { buildVehicleSpecsPdfBuffer, safeFilenamePart } = require('../lib/vehicleSpecsPdfBuilder');

const router = express.Router();
const supabase = getAnonClient();

function isUuid(id) {
  return (
    typeof id === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
}

router.get('/:id/specs-pdf', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    const { pdfBuffer, model } = await buildVehicleSpecsPdfBuffer(supabase, id);
    res.setHeader('Content-Type', 'application/pdf');
    const filename = `${safeFilenamePart(model)}.pdf`.replace(/"/g, "'");
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }
    console.error('[publicVehicle] specs-pdf:', error);
    res.status(500).json({ error: 'Error al generar la ficha técnica' });
  }
});

module.exports = router;
