const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Orden } = require('../models');
const { generarFormToken } = require('../services/izipay');

// Endpoint para generar formToken
router.post('/izipay-token', async (req, res) => {
  try {
    const { ordenId } = req.body;
    const orden = await Orden.findByPk(ordenId);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    // Preparar datos para Izipay
    const paymentData = {
      amount: orden.total,
      currency: 'PEN',
      orderId: `SG-${orden.id}-${Date.now()}`,
      email: orden.email,
      firstName: orden.nombre,
      lastName: orden.apellido,
      phoneNumber: orden.telefono,
      identityType: 'DNI', // opcional, depende de tu flujo
      identityCode: '',     // opcional
      address: orden.direccion,
      country: orden.pais,
      city: orden.distrito,
      state: orden.departamento,
      zipCode: ''           // opcional
    };

    const formToken = await generarFormToken(paymentData);

    // Guardar orderIdIzipay en la DB
    orden.orderIdIzipay = paymentData.orderId;
    await orden.save();

    res.json({ formToken, orderIdIzipay: paymentData.orderId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando formToken' });
  }
});

// Webhook de Izipay
router.post('/izipay-webhook', async (req, res) => {
  try {
    const { 'kr-answer': krAnswer, 'kr-hash': krHash } = req.body;

    // Validar HMAC
    const calculatedHash = crypto.createHmac('sha256', process.env.IZIPAY_HMAC)
      .update(krAnswer)
      .digest('hex');

    if (calculatedHash !== krHash) return res.status(400).send('Firma no válida');

    const answer = JSON.parse(krAnswer);
    const orden = await Orden.findOne({ where: { orderIdIzipay: answer.orderId } });
    if (!orden) return res.status(404).send('Orden no encontrada');

    orden.paymentStatus = answer.paymentStatus === 'APPROVED' ? 'completed' : 'failed';
    orden.estado = orden.paymentStatus;
    orden.paymentDate = new Date(answer.paymentDate);
    await orden.save();

    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error procesando webhook');
  }
});

module.exports = router;
