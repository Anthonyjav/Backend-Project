const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { Orden, OrdenItem, Carrito, CarritoItem } = require('../models');
const router = express.Router();

/* ============================
   🔐 CREDENCIALES TEST
   ============================ */
const USER = "84426447";
const PASS = "testpassword_kvARN8IKqaHBiXcz6WDpYhmqNWhWWLI5pHkH8ejFNLSfn";
const HMAC_TEST = "RchKwjeyINw0fOWVikl0jrYiAevWsP0KRU535oYgIXNbx";

/* ============================
   Helpers robustos para metadata/items
   ============================ */
function generateServerOrderId() {
  return `SV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// Robust parser para metadata.items (maneja stringified JSON, doble-escaped, arrays, objetos)
function parseMetadataItems(itemsRaw) {
  if (!itemsRaw) return [];
  try {
    // Si ya es array
    if (Array.isArray(itemsRaw)) return itemsRaw;

    // Si ya es objeto -> retornarlo (posible que sea un único item o estructura)
    if (typeof itemsRaw === 'object') return itemsRaw;

    // Si es string, intentamos múltiples estrategias
    if (typeof itemsRaw === 'string') {
      const s = itemsRaw.trim();

      // Intento 1: parse directo
      try {
        return JSON.parse(s);
      } catch (e1) {
        // Intento 2: des-escape de comillas internas
        try {
          const unescaped = s.replace(/\\"/g, '"');
          return JSON.parse(unescaped);
        } catch (e2) {
          // Intento 3: limpiar escapes comunes y parsear
          try {
            const cleaned = s
              .replace(/\\n/g, '')
              .replace(/\\'/g, "'")
              .replace(/\\"/g, '"')
              .replace(/"\\\{/g, '{')
              .replace(/\}\""/g, '}');
            return JSON.parse(cleaned);
          } catch (e3) {
            console.warn('parseMetadataItems: no se pudo parsear items (intentos), devolviendo []', e3);
            return [];
          }
        }
      }
    }

    return [];
  } catch (err) {
    console.error('parseMetadataItems error', err);
    return [];
  }
}

// Extrae metadata revisando varias rutas y tratando strings JSON
function getIzipayMetadata(answer, reqBody) {
  if (!answer && !reqBody) return {};

  // 1) transactions[0].metadata
  try {
    const tx = answer && Array.isArray(answer.transactions) ? answer.transactions[0] : null;
    if (tx && tx.metadata) {
      if (typeof tx.metadata === 'string') {
        try { return JSON.parse(tx.metadata); } catch (e) { return tx.metadata; }
      }
      return tx.metadata;
    }
  } catch (e) { /* ignore */ }

  // 2) orderDetails.metadata
  try {
    if (answer && answer.orderDetails && answer.orderDetails.metadata) {
      if (typeof answer.orderDetails.metadata === 'string') {
        try { return JSON.parse(answer.orderDetails.metadata); } catch (e) { return answer.orderDetails.metadata; }
      }
      return answer.orderDetails.metadata;
    }
  } catch (e) {}

  // 3) top-level answer.metadata
  if (answer && answer.metadata) {
    if (typeof answer.metadata === 'string') {
      try { return JSON.parse(answer.metadata); } catch (e) { return answer.metadata; }
    }
    return answer.metadata;
  }

  // 4) fallback: req.body['kr-hash-metadata'] o req.body.metadata (cuando IziPay envía)
  try {
    if (reqBody && (reqBody['kr-hash-metadata'] || reqBody.metadata)) {
      const raw = reqBody['kr-hash-metadata'] || reqBody.metadata;
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch (e) {
          try { return JSON.parse(raw.replace(/\\"/g, '"')); } catch (e2) { return raw; }
        }
      }
      return raw;
    }
  } catch (e) {}

  return {};
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

    // Obtener metadata robusta
    const metadata = getIzipayMetadata(data, req.body) || {};
    console.log("🔥 METADATA (extraída):", JSON.stringify(metadata, null, 2));

    const customer = data.customer?.billingDetails || {};
    const orderDetails = data.orderDetails || {};
    const transaction = data.transactions?.[0] || {};

    // parse items dentro de metadata (si viene string)
    let productos = [];
    if (metadata.items) {
      productos = parseMetadataItems(metadata.items);
    }
    if ((!productos || productos.length === 0) && (req.body.items || req.body.item)) {
      productos = parseMetadataItems(req.body.items || req.body.item);
    }
    console.log("📦 ITEMS PARSEADOS (webhook):", productos);

    // Determinar orderId de aplicación y método de envío (prioridad: metadata -> body -> trans.metadata -> generar)
    const appOrderId = metadata.orderId || req.body.orderId || (transaction && transaction.metadata && transaction.metadata.orderId) || generateServerOrderId();
    const metodoEnvio = req.body.metodoEnvio || metadata.metodoEnvio || (transaction && transaction.metadata && transaction.metadata.metodoEnvio) || metadata.shippingMethod || null;

    // Determinar ubicación (intenta metadata primero)
    const departamento = metadata.department || metadata.departamento || customer.state || (data.customer?.shippingDetails?.state) || null;
    const provincia = metadata.state || metadata.provincia || customer.city || (data.customer?.shippingDetails?.city) || null;
    const distrito = metadata.city || metadata.distrito || (data.customer?.shippingDetails?.district) || null;

    console.log("Decisiones: appOrderId=", appOrderId, "metodoEnvio=", metodoEnvio);

    // Evitar duplicados: intentar buscar por transaction.uuid o orderIdIzipay
    let ordenExistente = null;
    try {
      ordenExistente = await Orden.findOne({
        where: {
          transactionId: transaction.uuid
        }
      });
    } catch (e) {
      console.warn('Error buscando orden existente:', e.message);
    }

    let nuevaOrden;
    if (ordenExistente) {
      // actualizar
      ordenExistente.paymentStatus = data.orderStatus || ordenExistente.paymentStatus;
      ordenExistente.paymentResponse = JSON.stringify(data);
      ordenExistente.estado = (data.orderStatus || ordenExistente.estado || 'pagado').toLowerCase();
      ordenExistente.total = (orderDetails.orderPaidAmount || transaction.amount || 0) / 100;
      await ordenExistente.save();
      nuevaOrden = ordenExistente;
      console.log('Orden ya existía, actualizada ID:', nuevaOrden.id);
    } else {
      nuevaOrden = await Orden.create({
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
        referencia: metadata.referencia || req.body.referencia || "",
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
    }

    // Guardar items incluyendo imagen y color si vienen en metadata
    if (Array.isArray(productos) && productos.length > 0) {
      for (const item of productos) {
        try {
          await OrdenItem.create({
            ordenId: nuevaOrden.id,
            productoId: item.productoId || item.id,
            cantidad: item.cantidad || 1,
            precio: item.precio || item.price || 0,
            talla: item.talla || null,
            nombreProducto: item.nombreProducto || item.nombre || null,
            imagen: item.imagen || item.image || null,
            color: item.color || null
          });
        } catch (e) {
          console.warn('Error guardando OrdenItem (webhook):', e.message, item);
          // Intentar guardar sin imagen/color si falla por columnas inexistentes
          try {
            await OrdenItem.create({
              ordenId: nuevaOrden.id,
              productoId: item.productoId || item.id,
              cantidad: item.cantidad || 1,
              precio: item.precio || item.price || 0,
              talla: item.talla || null,
              nombreProducto: item.nombreProducto || item.nombre || null
            });
          } catch (e2) {
            console.error('Segundo intento falló al guardar OrdenItem:', e2);
          }
        }
      }
      console.log("🛒 ITEMS GUARDADOS:", productos.length);
    } else {
      console.log("ℹ️ No hay items para guardar en metadata");
    }

    // Intentar vaciar carrito del usuario (si viene usuarioId)
    const usuarioToClear = metadata.usuarioId || data.usuarioId || null;
    if (usuarioToClear) {
      try {
        const carrito = await Carrito.findOne({ where: { usuarioId: usuarioToClear } });
        if (carrito) {
          await CarritoItem.destroy({ where: { carritoId: carrito.id } });
          console.log(`Carrito vaciado para usuario ${usuarioToClear}`);
        } else {
          console.log(`No se encontró carrito para usuario ${usuarioToClear}`);
        }
      } catch (e) {
        console.warn('Error vaciando carrito:', e.message);
      }
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

/* ============================
   /pago-exitoso: endpoint llamado por IziPay (kr-post-url-success)
   Devuelve HTML que escribe en localStorage y redirige al perfil del frontend
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

    const metadata = getIzipayMetadata(answer, req.body) || {};
    console.log("Metadata extraída en pago-exitoso:", JSON.stringify(metadata, null, 2));

    const usuarioId = metadata.usuarioId || req.query.usuarioId || null;
    let items = [];
    if (metadata.items) items = parseMetadataItems(metadata.items);
    if ((!items || items.length === 0) && (req.body.items || req.body.item)) items = parseMetadataItems(req.body.items || req.body.item);
    console.log("Items parseados (pago-exitoso):", items);

    const transaction = answer.transactions?.[0];
    if (!transaction) {
      return res.status(400).json({ error: "Transacción inválida" });
    }

    const amount = transaction.amount;
    const orderIdIzipay = answer.orderDetails?.orderId;
    const customer = answer.customer.billingDetails;

    // Priorizar metadata.orderId o req.body.orderId, guardar metodoEnvio si viene
    const appOrderId = metadata.orderId || req.body.orderId || (transaction && transaction.metadata && transaction.metadata.orderId) || generateServerOrderId();
    const metodoEnvio = req.body.metodoEnvio || metadata.metodoEnvio || (transaction && transaction.metadata && transaction.metadata.metodoEnvio) || metadata.shippingMethod || null;

    const departamento = metadata.department || metadata.departamento || customer.state || (answer.customer?.shippingDetails?.state) || null;
    const provincia = metadata.state || metadata.provincia || customer.city || (answer.customer?.shippingDetails?.city) || null;
    const distrito = metadata.city || metadata.distrito || (answer.customer?.shippingDetails?.district) || null;

    // 1) Evitar duplicados
    let ordenExistente = null;
    try {
      ordenExistente = await Orden.findOne({ where: { transactionId: transaction.uuid } });
    } catch (e) {
      console.warn('Error buscando orden existente:', e.message);
    }

    let nuevaOrden;
    if (ordenExistente) {
      ordenExistente.paymentStatus = transaction.status || ordenExistente.paymentStatus;
      ordenExistente.paymentResponse = JSON.stringify(answer);
      ordenExistente.estado = (answer.orderStatus || ordenExistente.estado || 'pagado').toLowerCase();
      ordenExistente.total = (transaction.amount || (answer.orderDetails && answer.orderDetails.orderPaidAmount) || 0) / 100;
      await ordenExistente.save();
      nuevaOrden = ordenExistente;
      console.log('Orden ya existía, actualizada ID:', nuevaOrden.id);
    } else {
      nuevaOrden = await Orden.create({
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
        referencia: metadata.referencia || req.body.referencia || "",

        metodoEnvio: metodoEnvio,

        // Info de pago
        transactionId: transaction.uuid,
        paymentStatus: transaction.status,
        paymentResponse: JSON.stringify(answer),
        paymentDate: transaction.creationDate || new Date(),
      });

      console.log("✅ ORDEN GUARDADA ID:", nuevaOrden.id, "orderId(app)=", appOrderId);
    }

    // Guardar items incluyendo imagen y color si vienen
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        try {
          await OrdenItem.create({
            ordenId: nuevaOrden.id,
            productoId: item.productoId || item.id,
            cantidad: item.cantidad || 1,
            precio: item.precio || item.price || 0,
            talla: item.talla || null,
            nombreProducto: item.nombreProducto || item.nombre || null,
            imagen: item.imagen || item.image || null,
            color: item.color || null
          });
        } catch (e) {
          console.warn('Error guardando OrdenItem (pago-exitoso):', e.message, item);
          try {
            await OrdenItem.create({
              ordenId: nuevaOrden.id,
              productoId: item.productoId || item.id,
              cantidad: item.cantidad || 1,
              precio: item.precio || item.price || 0,
              talla: item.talla || null,
              nombreProducto: item.nombreProducto || item.nombre || null
            });
          } catch (e2) {
            console.error('Segundo intento falló al guardar OrdenItem (pago-exitoso):', e2);
          }
        }
      }
    }

    console.log("🛒 ITEMS GUARDADOS:", Array.isArray(items) ? items.length : 0);

    // VACIAR CARRITO del usuario usando modelos directos (más fiable)
    if (usuarioId) {
      try {
        const carrito = await Carrito.findOne({ where: { usuarioId } });
        if (carrito) {
          await CarritoItem.destroy({ where: { carritoId: carrito.id } });
          console.log(`Carrito vaciado para usuario ${usuarioId}`);
        } else {
          console.log(`No se encontró carrito para usuario ${usuarioId}`);
        }
      } catch (e) {
        console.warn('Error vaciando carrito:', e.message);
      }
    }

    // RESPUESTA HTML: escribe en localStorage y redirige al perfil del frontend
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const profilePath = '/usuario/perfil';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>
  <script>
    try {
      localStorage.setItem('pago_result', JSON.stringify({ status: 'success', orderId: '${appOrderId}', ordenDbId: ${nuevaOrden.id} })); 
    } catch(e) {}
    window.location.href = '${FRONTEND_URL + profilePath}';
  </script>
  <p>Procesando pago... Si no se redirige, <a href="${FRONTEND_URL + profilePath}">haz clic aquí</a>.</p>
</body></html>`);

  } catch (error) {
    console.log("❌ Error en pago-exitoso:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;