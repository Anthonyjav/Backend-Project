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
      },

      // 🔥🔥 AÑADIR ESTO 🔥🔥
      metadata: req.body.metadata
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
    const metadata = data.metadata || {};
    const productos = metadata.items || [];

    console.log("📦 ITEMS RECIBIDOS EN METADATA:", productos);

    for (const item of productos) {
      await OrdenItem.create({
        ordenId: nuevaOrden.id,
        productoId: item.productoId,
        cantidad: item.cantidad,
        precio: item.precio,
        talla: item.talla || null
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
    console.log("📌 BODY ORIGINAL:", req.body);

    // ===========================
    // 1️⃣ Obtener datos enviados en la URL
    // ===========================
    const usuarioId = req.query.usuarioId;
    const itemsRaw = req.query.items;  // <<-- si los estás enviando
    let items = [];

    if (itemsRaw) {
      try {
        items = JSON.parse(itemsRaw);
      } catch (e) {
        console.log("⚠ Error parseando items");
      }
    }

    console.log("Usuario ID:", usuarioId);
    console.log("Items recibidos:", items);

    // ===========================
    // 2️⃣ Validar kr-answer de Izipay
    // ===========================
    const raw = req.body["kr-answer"];
    if (!raw) {
      return res.status(400).json({ error: "kr-answer vacío" });
    }

    const answer = JSON.parse(raw);
    console.log("📌 IZIPAY PARSED:", answer);

    const transaction = answer.transactions?.[0];
    if (!transaction) {
      return res.status(400).json({ error: "Transacción inválida" });
    }

    // ===========================
    // 3️⃣ Extraer datos reales del pago
    // ===========================
    const amount = transaction.amount;
    const orderIdIzipay = answer.orderDetails?.orderId;

    const customer = answer.customer.billingDetails;

    // ===========================
    // 4️⃣ Crear ORDEN en tu base de datos
    // ===========================
    const nuevaOrden = await Orden.create({
      usuarioId: usuarioId || null,
      orderIdIzipay,
      subtotal: amount / 100,
      envio: 0,
      total: amount / 100,
      estado: "pagado",

      // Datos personales
      nombre: customer.firstName,
      apellido: customer.lastName,
      email: answer.customer.email,
      telefono: customer.phoneNumber,
      pais: customer.country,
      departamento: customer.state,
      provincia: customer.city,
      distrito: customer.city,
      direccion: customer.address,
      referencia: "",

      // Info de pago
      transactionId: transaction.uuid,
      paymentStatus: transaction.status,
      paymentResponse: JSON.stringify(answer),
      paymentDate: transaction.creationDate,
    });

    console.log("✅ ORDEN GUARDADA ID:", nuevaOrden.id);

    // ===========================
    // 5️⃣ Guardar items (si llegaron)
    // ===========================
    if (items.length > 0) {
      for (const item of items) {
        await OrdenItem.create({
          ordenId: nuevaOrden.id,
          productoId: item.productoId,
          cantidad: item.cantidad,
          precio: item.precio,
          talla: item.talla || null,
        });
      }
    }

    console.log("🛒 ITEMS GUARDADOS:", items.length);

    // ===========================
    // 6️⃣ Respuesta al front
    // ===========================
    res.json({
      message: "Pago registrado correctamente",
      ordenId: nuevaOrden.id,
    });

  } catch (error) {
    console.log("❌ Error en pago-exitoso:", error);
    res.status(500).json({ error: error.message });
  }
});



module.exports = router;