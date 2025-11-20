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
    // CREDENCIALES CORRECTAS PARA API REST (TEST)
    const USERNAME = "84426447";
    const PASSWORD = "yL0X1GHOdIBU98vh";

    // Header de autenticación Basic
    const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

    const body = {
      amount: amount * 100,
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

    const response = await axios.post(
      "https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment",
      body,
      {
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ formToken: response.data.answer.formToken });

  } catch (error) {
    console.error(error.response?.data || error);
    res.status(500).json({
      error: "No se pudo generar formToken",
      info: error.response?.data
    });
  }
});

module.exports = router;
