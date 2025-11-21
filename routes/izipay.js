// backend/routes/izipay.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { Orden, OrdenItem } = require('../models');
const router = express.Router();

/* ============================
   🔐 CREDENCIALES TEST
   ============================ */
const USER = "84426447";
const PASS = "testpassword_kvARN8IKqaHBiXcz6WDpYhmqNWhWWLI5pHkH8ejFNLSfn";
const HMAC_TEST = "RchKwjeyINw0fOWVikl0jrYiAevWsP0KRU535oYgIXNbx";

/* ============================
   1️⃣ CREAR ORDEN Y GENERAR FORM TOKEN
   ============================ */
router.post('/form-token', async (req, res) => {
  try {
    const { usuarioId, carrito, currency = "PEN", email, firstName, lastName, phoneNumber, address, state, city, zipCode, country = "PE" } = req.body;

    // Calcular subtotal y total
    const subtotal = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
    const total = subtotal; // puedes sumar envío si tienes

    // Crear orden pendiente
    const nuevaOrden = await Orden.create({
      usuarioId,
      nombre: firstName,
      apellido: lastName,
      email,
      telefono: phoneNumber,
      pais: country,
      departamento: state,
      provincia: city,
      distrito: "",
      direccion: address,
      referencia: "",
      metodoEnvio: "",
      estado: "pendiente",
      subtotal,
      envio: 0,
      total,
      orderId: `ORD-${Date.now()}`
    });

    // Crear items
    for (const item of carrito) {
      await OrdenItem.create({
        ordenId: nuevaOrden.id,
        productoId: item.productoId,
        cantidad: item.cantidad,
        precio: item.precio,
        talla: item.talla || null,
        nombreProducto: item.nombreProducto || null
      });
    }

    // Preparar payload para Izipay
    const auth = Buffer.from(`${USER}:${PASS}`).toString('base64');

    const body = {
      amount: total * 100, // centavos
      currency,
      orderId: nuevaOrden.orderId,
      customer: {
        email,
        billingDetails: {
          firstName,
          lastName,
          phoneNumber,
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

    res.json({ formToken: response.data.answer.formToken, orderId: nuevaOrden.orderId });

  } catch (error) {
    console.error(error.response?.data || error);
    res.status(500).json({ error: "No se pudo generar formToken", info: error.response?.data });
  }
});

/* ============================
   2️⃣ WEBHOOK (IPN) Izipay
   ============================ */
router.post("/webhook", async (req, res) => {
  try {
    const krAnswerRaw = req.body["kr-answer"];
    const receivedHash = req.body["kr-hash"];

    // Validar HMAC
    const calculatedHash = crypto
      .createHmac("sha256", HMAC_TEST)
      .update(krAnswerRaw, "utf8")
      .digest("hex");

    if (calculatedHash !== receivedHash) {
      console.log("❌ HASH NO VÁLIDO");
      return res.status(400).send("Invalid signature");
    }

    const data = JSON.parse(krAnswerRaw);
    console.log("🔔 WEBHOOK RECIBIDO:", data);

    // Actualizar orden existente
    const orden = await Orden.findOne({ where: { orderId: data.orderDetails?.orderId } });
    if (!orden) return res.status(404).send("Orden no encontrada");

    const transaction = data.transactions?.[0] || {};

    await orden.update({
      estado: data.orderStatus.toLowerCase(),
      transactionId: transaction.uuid,
      paymentStatus: data.orderStatus,
      paymentResponse: JSON.stringify(data),
      paymentDate: transaction.createdAt || new Date()
    });

    return res.send("OK");

  } catch (error) {
    console.error("❌ WEBHOOK ERROR:", error);
    return res.status(500).send("Webhook error");
  }
});

/* ============================
   3️⃣ RESULTADO
   ============================ */
router.post("/resultado", async (req, res) => {
  try {
    const krAnswerRaw = req.body["kr-answer"] || "{}";
    const answer = JSON.parse(krAnswerRaw);

    const orderDetails = answer.orderDetails || {};
    const customer = answer.customer?.billingDetails || {};
    const transaction = answer.transactions?.[0] || {};

    res.json({
      status: answer.orderStatus,
      orderId: orderDetails.orderId,
      currency: orderDetails.orderCurrency,
      amount: orderDetails.orderTotalAmount,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: answer.customer?.email,
        phone: customer.phoneNumber,
        address: customer.address,
        state: customer.state,
        city: customer.city,
      },
      transactionId: transaction.uuid,
      raw: answer,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error procesando resultado" });
  }
});

/* ============================
   4️⃣ PAGO EXITOSO (actualiza orden existente)
   ============================ */
router.post("/pago-exitoso", async (req, res) => {
  try {
    const krAnswerRaw = req.body["kr-answer"];
    if (!krAnswerRaw) return res.status(400).json({ error: "No llegó kr-answer" });

    const data = JSON.parse(krAnswerRaw);
    const orderDetails = data.orderDetails || {};
    const transaction = data.transactions?.[0] || {};

    // Buscar orden por orderId
    const orden = await Orden.findOne({ where: { orderId: orderDetails.orderId } });
    if (!orden) return res.status(404).json({ error: "Orden no encontrada" });

    await orden.update({
      estado: data.orderStatus.toLowerCase(),
      total: (orderDetails.orderPaidAmount || 0) / 100,
      transactionId: transaction.uuid,
      paymentStatus: data.orderStatus,
      paymentResponse: JSON.stringify(data),
      paymentDate: transaction.createdAt || new Date()
    });

    res.json({ success: true, message: "Orden actualizada", ordenId: orden.id });

  } catch (error) {
    console.error("❌ Error en /pago-exitoso:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
