// backend/routes/izipay.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

router.post('/form-token', async (req, res) => {
  const {
    amount,
    currency,
    orderId,
    email,
    firstName,
    lastName,
    phoneNumber,
    identityType,
    identityCode,
    address,
    country,
    state,
    city,
    zipCode
  } = req.body;

  try {
    // Credenciales de prueba
    const USERNAME = '84426447';
    const PASSWORD = 'testpassword_kvARN8IKqaHBiXcz6WDpYhmqNWhWWLI5pHkH8ejFNLSfn';

    // Header de autenticación Basic
    const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

    // Cuerpo de la petición al API de Izipay
    const body = {
      amount: amount * 100, // Izipay usa céntimos
      currency,
      orderId,
      customer: {
        email,
        billingDetails: {
          firstName,
          lastName,
          phoneNumber,
          identityType,
          identityCode,
          address,
          country,
          state,
          city,
          zipCode
        }
      }
    };

    // Petición POST al API de Izipay
    const response = await axios.post(
      'https://api.micuentaweb-sandbox.com/api-payment/V4/Charge/CreatePayment',
      body,
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Retornar el formToken al frontend
    res.json({ formToken: response.data.answer.formToken });
  } catch (error) {
    console.error(error.response?.data || error);
    res.status(500).json({ error: 'No se pudo generar formToken' });
  }
});

module.exports = router;
