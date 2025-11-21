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
   1️⃣ GENERAR FORM TOKEN
   ============================ */
router.post('/form-token', async (req, res) => {
  console.log("🔹 req.body recibido:", req.body);
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
    const auth = Buffer.from(`${USER}:${PASS}`).toString('base64');

    const body = {
      amount: amount * 100, // Izipay usa centavos
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
    console.log("🔹 Respuesta Izipay:", response.data);
    res.json({ formToken: response.data.answer.formToken });

  } catch (error) {
    console.error(error.response?.data || error);
    res.status(500).json({
      error: "No se pudo generar formToken",
      info: error.response?.data
    });
  }
});

/* ============================
   2️⃣ WEBHOOK (IPN)
   ============================ */
router.post("/webhook", async (req, res) => {
  try {

    const krAnswerRaw = req.body["kr-answer"];
    const receivedHash = req.body["kr-hash"];

    // Validar firma HMAC
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

    // ========================================
    // 1️⃣ CREAR ORDEN EN TU TABLA Orden
    // ========================================
    const customer = data.customer?.billingDetails || {};
    const orderDetails = data.orderDetails || {};
    const transaction = data.transactions?.[0] || {};


    const nuevaOrden = await Orden.create({
      usuarioId: data.usuarioId || null,
      nombre: customer.firstName,
      apellido: customer.lastName,
      email: data.customer?.email,
      telefono: customer.phoneNumber,
      pais: customer.country || "Perú",
      departamento: customer.state,
      provincia: customer.city,
      distrito: "",
      direccion: customer.address,
      referencia: "",
      metodoEnvio: "",
      estado: data.orderStatus.toLowerCase(),
      subtotal: (orderDetails.orderTotalAmount || 0) / 100,
      envio: 0,
      total: (orderDetails.orderPaidAmount || 0) / 100,
      
      // ✅ Campos de Izipay
      orderIdIzipay: orderDetails.orderId,
      transactionId: transaction.uuid,
      paymentStatus: data.orderStatus,
      paymentResponse: JSON.stringify(data), // guarda todo el payload si quieres
      paymentDate: transaction.createdAt || new Date()
    });


    console.log("✅ ORDEN GUARDADA:", nuevaOrden.id);

    // ========================================
    // 2️⃣ GUARDAR ITEMS DE LA ORDEN
    // ========================================
    const productos = data.cartItems || []; // <-- tu front debe enviar esto

    for (const item of productos) {
      await OrdenItem.create({
        ordenId: nuevaOrden.id,
        productoId: item.productoId,
        cantidad: item.cantidad,
        precio: item.precio
      });
    }

    console.log("🛒 ITEMS GUARDADOS:", productos.length);

    return res.send("OK");

  } catch (error) {
    console.error("❌ WEBHOOK ERROR:", error);
    return res.status(500).send("Webhook error");
  }
});


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

router.post("/pago-exitoso", async (req, res) => {
  try {
    console.log("🔵 BODY RECIBIDO:", req.body);

    const { orderId, usuarioId, items, metadata } = req.body;

    // 1. Crear la orden
    const nuevaOrden = await Orden.create({
      orderId,
      usuarioId,
      subtotal: metadata.amount,
      envio: 0,
      total: metadata.amount,
      estado: "pagado",
      nombre: metadata.firstName,
      apellido: metadata.lastName,
      email: metadata.email,
      telefono: metadata.phoneNumber,
      pais: metadata.country,
      departamento: metadata.state,
      provincia: metadata.city,
      distrito: metadata.city,
      direccion: metadata.address,
      referencia: "",
    });

    console.log("🟢 ORDEN CREADA:", nuevaOrden.id);

    // 2. Validar que lleguen items
    console.log("🟦 ITEMS RECIBIDOS:", items);

    if (!items || items.length === 0) {
      return res.status(400).json({
        error: "No se enviaron items para crear OrdenItems"
      });
    }

    // 3. Crear cada item asociado a la orden
    for (const item of items) {
      await OrdenItem.create({
        ordenId: nuevaOrden.id,
        productoId: item.productoId,
        cantidad: item.cantidad,
        talla: item.talla,
        color: item.color,
        precio: item.precio,
      });
    }

    console.log("🟢 ORDENITEMS CREADOS");

    // 4. Responder
    res.json({
      message: "Orden creada correctamente",
      ordenId: nuevaOrden.id
    });

  } catch (error) {
    console.error("❌ ERROR EN /pago-exitoso:", error);
    res.status(500).json({ error: "Error al procesar pago" });
  }
});



module.exports = router;