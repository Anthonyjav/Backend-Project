const axios = require('axios');

const IZIPAY_USERNAME = '84426447';
const IZIPAY_PASSWORD = 'testpassword_kvARN8IKqaHBiXcz6WDpYhmqNWhWWLI5pHkH8ejFNLSfn';

async function generarFormToken(paymentData) {
  const url = 'https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment';
  
  const auth = Buffer.from(`${IZIPAY_USERNAME}:${IZIPAY_PASSWORD}`).toString('base64');

  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  };

  const body = {
    amount: Math.round(paymentData.amount * 100),
    currency: paymentData.currency,
    orderId: paymentData.orderId,
    customer: {
      email: paymentData.email,
      billingDetails: {
        firstName: paymentData.firstName,
        lastName: paymentData.lastName,
        phoneNumber: paymentData.phoneNumber,
        identityType: paymentData.identityType,
        identityCode: paymentData.identityCode,
        address: paymentData.address,
        country: paymentData.country,
        city: paymentData.city,
        state: paymentData.state,
        zipCode: paymentData.zipCode
      }
    }
  };

  try {
    const response = await axios.post(url, body, { headers });
    return response.data.answer.formToken;
  } catch (err) {
    console.error('Error generando formToken:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { generarFormToken };
