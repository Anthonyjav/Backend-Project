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
   Helper: extraer metadata robusta
   ============================ */
function extractMetadataFromAnswer(answer) {
  if (!answer) return null;

  // 1) metadata en root
  if (answer.metadata) {
    try {
      return typeof answer.metadata === 'string' ? JSON.parse(answer.metadata) : answer.metadata;
    } catch (e) {
      return answer.metadata;
    }
  }

  // 2) orderDetails.metadata
  if (answer.orderDetails && answer.orderDetails.metadata) {
    try {
      return typeof answer.orderDetails.metadata === 'string'
        ? JSON.parse(answer.orderDetails.metadata)
        : answer.orderDetails.metadata;
    } catch (e) {
      return answer.orderDetails.metadata;
    }
  }

  // 3) transactions[0].metadata (común)
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

/* ============================
   1️⃣ GENERAR FORM TOKEN
   ============================ */
router.post('/form-token', async (req, res) => {
  console.log("🔥🔥 FORM-TOKEN RECIBIDO DESDE FRONT:", JSON.stringify(req.body, null, 2));
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
      // Atención: tu front ya manda un `amount`. Aquí se conserva tu lógica previa.
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

      // 🔥 metadata enviada desde el front
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
    console.log("🔥🔥 WEBHOOK COMPLETO:", JSON.stringify(data, null, 2));

    // Extraer metadata robustamente
    const metadata = extractMetadataFromAnswer(data) || {};
    console.log("🔥 METADATA (extraída):", JSON.stringify(metadata, null, 2));

    // ========================================
    // 1️⃣ CREAR ORDEN EN TU TABLA Orden
    // ========================================
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

    const nuevaOrden = await Orden.create({
      usuarioId: metadata.usuarioId || data.usuarioId || null,
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
      estado: (data.orderStatus || '').toLowerCase(),
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

    // ===========================
    // 1️⃣ Parsear kr-answer (IziPay POST)
    // ===========================
    const raw = req.body["kr-answer"];
    if (!raw) {
      return res.status(400).json({ error: "kr-answer vacío" });
    }

    const answer = JSON.parse(raw);
    console.log("📌 IZIPAY PARSED:", answer);

    // ===========================
    // 2️⃣ Extraer metadata desde answer
    // ===========================
    const metadata = extractMetadataFromAnswer(answer) || {};
    console.log("Metadata extraída en pago-exitoso:", metadata);

    // Preferir metadata.usuarioId y metadata.items
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

    // ===========================
    // 3️⃣ Validar transacción
    // ===========================
    const transaction = answer.transactions?.[0];
    if (!transaction) {
      return res.status(400).json({ error: "Transacción inválida" });
    }

    // ===========================
    // 4️⃣ Crear ORDEN en tu base de datos
    // ===========================
    const amount = transaction.amount;
    const orderIdIzipay = answer.orderDetails?.orderId;
    const customer = answer.customer.billingDetails;

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
      paymentDate: transaction.creationDate || new Date(),
    });

    console.log("✅ ORDEN GUARDADA ID:", nuevaOrden.id);

    // ===========================
    // 5️⃣ Guardar items (si llegaron)
    // ===========================
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