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
   Helpers
   ============================ */
function extractMetadataFromAnswer(answer) {
  if (!answer) return null;

  if (answer.metadata) {
    try {
      return typeof answer.metadata === 'string' ? JSON.parse(answer.metadata) : answer.metadata;
    } catch (e) {
      return answer.metadata;
    }
  }

  if (answer.orderDetails && answer.orderDetails.metadata) {
    try {
      return typeof answer.orderDetails.metadata === 'string'
        ? JSON.parse(answer.orderDetails.metadata)
        : answer.orderDetails.metadata;
    } catch (e) {
      return answer.orderDetails.metadata;
    }
  }

  const tx = answer.transactions && answer.transactions[0];
  if (tx && tx.metadata) {
    try {
      return typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : tx.metadata;
    } catch (e) {
      return tx.metadata;
    }
  }

  return null;
}

function generateServerOrderId() {
  return `SV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/* ============================
   1️⃣ GENERAR FORM TOKEN
   ============================ */
router.post('/form-token', async (req, res) => {
  console.log("🔥🔥 FORM-TOKEN RECIBIDO DESDE FRONT:", JSON.stringify(req.body, null, 2));
  const {
    amount,
    currency,
    orderId,
    metodoEnvio,
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

      // metadata enviada desde el front (se envía tal cual)
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
    console.log("BODY RECIBIDO DEL FRONT:", req.body);

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
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw body keys:', Object.keys(req.body));
    console.log('Raw body preview:', JSON.stringify(req.body).slice(0, 2000));

    const krAnswerRaw = req.body["kr-answer"];
    const receivedHash = req.body["kr-hash"];

    const calculatedHash = crypto
      .createHmac("sha256", HMAC_TEST)
      .update(krAnswerRaw, "utf8")
      .digest("hex");

    if (calculatedHash !== receivedHash) {
      console.log("❌ HASH NO VÁLIDO");
      return res.status(400).send("Invalid signature");
    }

    const data = JSON.parse(krAnswerRaw);
    console.log("🔥🔥 WEBHOOK COMPLETO:", JSON.stringify(data, null, 2));

    const metadata = extractMetadataFromAnswer(data) || {};
    console.log("🔥 METADATA (extraída):", JSON.stringify(metadata, null, 2));

    const customer = data.customer?.billingDetails || {};
    const orderDetails = data.orderDetails || {};
    const transaction = data.transactions?.[0] || {};

    // parse items dentro de metadata (si viene string)
    let productos = [];
    if (metadata.items) {
      try {
        productos = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
      } catch (e) {
        console.warn('No se pudo parsear metadata.items, usando raw:', e);
        productos = metadata.items;
      }
    }

    // Determinar orderId de aplicación y método de envío (prioridad: metadata -> body -> trans.metadata -> generar)
    const appOrderId = metadata.orderId || req.body.orderId || (transaction && transaction.metadata && transaction.metadata.orderId) || generateServerOrderId();
    const metodoEnvio = req.body.metodoEnvio || metadata.metodoEnvio || (transaction && transaction.metadata && transaction.metadata.metodoEnvio) || null;

    // Determinar ubicación (intenta metadata primero)
    const departamento = metadata.department || metadata.departamento || customer.state || (data.customer?.shippingDetails?.state) || null;
    const provincia = metadata.state || metadata.provincia || customer.city || (data.customer?.shippingDetails?.city) || null;
    const distrito = metadata.city || metadata.distrito || (data.customer?.shippingDetails?.district) || null;

    console.log("Decisiones: appOrderId=", appOrderId, "metodoEnvio=", metodoEnvio);

    const nuevaOrden = await Orden.create({
      // guardamos también el orderId de la app si viene
      orderId: appOrderId,
      usuarioId: metadata.usuarioId || data.usuarioId || null,
      nombre: customer.firstName,
      apellido: customer.lastName,
      email: data.customer?.email,
      telefono: customer.phoneNumber,
      pais: customer.country || "Perú",
      departamento: departamento,
      provincia: provincia,
      distrito: distrito || "",
      direccion: customer.address,
      referencia: "",
      metodoEnvio: metodoEnvio,
      estado: (data.orderStatus || '').toLowerCase(),
      subtotal: (orderDetails.orderTotalAmount || 0) / 100,
      envio: 0,
      total: (orderDetails.orderPaidAmount || 0) / 100,

      // Campos de Izipay
      orderIdIzipay: orderDetails.orderId,
      transactionId: transaction.uuid,
      paymentStatus: data.orderStatus,
      paymentResponse: JSON.stringify(data),
      paymentDate: transaction.createdAt || new Date()
    });

    console.log("✅ ORDEN GUARDADA:", nuevaOrden.id, "orderId(app)=", appOrderId);

    console.log("📦 ITEMS RECIBIDOS EN METADATA:", productos);

    if (Array.isArray(productos) && productos.length > 0) {
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
    } else {
      console.log("ℹ️ No hay items para guardar en metadata");
    }

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
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Raw body keys:', Object.keys(req.body));

    const raw = req.body["kr-answer"];
    if (!raw) {
      return res.status(400).json({ error: "kr-answer vacío" });
    }

    const answer = JSON.parse(raw);
    console.log("📌 IZIPAY PARSED:", answer);

    const metadata = extractMetadataFromAnswer(answer) || {};
    console.log("Metadata extraída en pago-exitoso:", metadata);

    const usuarioId = metadata.usuarioId || req.query.usuarioId || null;
    let items = [];
    if (metadata.items) {
      try {
        items = typeof metadata.items === 'string' ? JSON.parse(metadata.items) : metadata.items;
      } catch (e) {
        console.warn("No se pudo parsear metadata.items:", e);
        items = metadata.items;
      }
    }

    console.log("Usuario ID:", usuarioId);
    console.log("Items recibidos:", items);

    const transaction = answer.transactions?.[0];
    if (!transaction) {
      return res.status(400).json({ error: "Transacción inválida" });
    }

    const amount = transaction.amount;
    const orderIdIzipay = answer.orderDetails?.orderId;
    const customer = answer.customer.billingDetails;

    // Nuevas: priorizar metadata.orderId o req.body.orderId, guardar metodoEnvio si viene
    const appOrderId = metadata.orderId || req.body.orderId || (transaction && transaction.metadata && transaction.metadata.orderId) || generateServerOrderId();
    const metodoEnvio = req.body.metodoEnvio || metadata.metodoEnvio || (transaction && transaction.metadata && transaction.metadata.metodoEnvio) || null;

    const departamento = metadata.department || metadata.departamento || customer.state || (answer.customer?.shippingDetails?.state) || null;
    const provincia = metadata.state || metadata.provincia || customer.city || (answer.customer?.shippingDetails?.city) || null;
    const distrito = metadata.city || metadata.distrito || (answer.customer?.shippingDetails?.district) || null;

    const nuevaOrden = await Orden.create({
      orderId: appOrderId,
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
      departamento: departamento,
      provincia: provincia,
      distrito: distrito || "",
      direccion: customer.address,
      referencia: "",

      metodoEnvio: metodoEnvio,

      // Info de pago
      transactionId: transaction.uuid,
      paymentStatus: transaction.status,
      paymentResponse: JSON.stringify(answer),
      paymentDate: transaction.creationDate || new Date(),
    });

    console.log("✅ ORDEN GUARDADA ID:", nuevaOrden.id, "orderId(app)=", appOrderId);

    if (Array.isArray(items) && items.length > 0) {
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

    console.log("🛒 ITEMS GUARDADOS:", Array.isArray(items) ? items.length : 0);

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