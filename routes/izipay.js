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

/**
 * Intento de limpiar el carrito del usuario usando los endpoints existentes del backend.
 * - Construye baseUrl desde env BACKEND_URL o desde la petición (req.protocol + host).
 * - GET /carrito/:userId y luego DELETE /carrito/item/:itemId por cada item.
 *
 * NOTA: este enfoque usa llamadas HTTP internas para no depender del modelo exacto del carrito.
 */
async function clearCartForUser(userId, req) {
  if (!userId) {
    console.log('clearCartForUser: no se indicó usuarioId, se omite limpieza de carrito');
    return;
  }

  try {
    const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const carritoRes = await axios.get(`${baseUrl}/carrito/${userId}`);
    const items = carritoRes.data?.items || carritoRes.data || [];

    if (!Array.isArray(items) || items.length === 0) {
      console.log(`clearCartForUser: no hay items para usuario ${userId}`);
      return;
    }

    for (const it of items) {
      const itemId = it.id || it.itemId || it.carritoItemId;
      if (!itemId) continue;
      try {
        await axios.delete(`${baseUrl}/carrito/item/${itemId}`);
        console.log(`clearCartForUser: eliminado item ${itemId} para usuario ${userId}`);
      } catch (e) {
        console.warn(`clearCartForUser: error eliminando item ${itemId}:`, e.message);
      }
    }

    console.log('clearCartForUser: finalizado para usuario', userId);
  } catch (e) {
    console.warn('clearCartForUser: no se pudo limpiar carrito:', e.message);
  }
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

    // LIMPIAR CARRITO: intentamos limpiar el carrito del usuario asociado (si viene usuarioId en metadata)
    const usuarioToClear = metadata.usuarioId || data.usuarioId || null;
    if (usuarioToClear) {
      await clearCartForUser(usuarioToClear, req);
    }

    return res.send("OK");

  } catch (error) {
    console.error("❌ WEBHOOK ERROR:", error);
    return res.status(500).send("Webhook error");
  }
});

/* ============================
   /resultado: response helper
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
   /pago-exitoso: endpoint llamado por IziPay (kr-post-url-success)
   Devuelve HTML con alerta + redirección al perfil del frontend
   ============================ */
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

    // Priorizar metadata.orderId o req.body.orderId, guardar metodoEnvio si viene
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

    // Limpiar carrito si tenemos usuario
    if (usuarioId) {
      await clearCartForUser(usuarioId, req);
    }

    // RESPUESTA HTML: alerta + redirección al perfil del frontend
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://sgstudio.shop'; // ajusta si necesario
    const profilePath = '/usuario/perfil'; // ruta en tu Next.js

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pago Exitoso</title>
  <style>
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background:#f7fafc; color:#111827; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
    .card { background:white; padding:24px; border-radius:12px; box-shadow:0 6px 18px rgba(0,0,0,0.08); text-align:center; max-width:420px; }
    h1 { margin:0 0 8px; font-size:20px; }
    p { margin:0 0 16px; color:#4b5563; }
    .ok { display:inline-block; background:#16a34a; color:white; padding:10px 18px; border-radius:8px; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Pago registrado con éxito</h1>
    <p>Gracias por tu compra. Serás redirigido a tu perfil en breve.</p>
    <a class="ok" href="${FRONTEND_URL + profilePath}">Ir al perfil ahora</a>
  </div>

  <script>
    try { alert('Pago registrado correctamente.'); } catch(e) {}
    setTimeout(function() {
      window.location.href = '${FRONTEND_URL + profilePath}';
    }, 1500);
  </script>
</body>
</html>`);

  } catch (error) {
    console.log("❌ Error en pago-exitoso:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;