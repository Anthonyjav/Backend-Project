import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/izipay/crear-pago", async (req, res) => {
  try {
    const { total, email } = req.body;

    const data = {
      amount: Math.round(total * 100),
      currency: "PEN",
      orderId: "ORD-" + Date.now(),
      customer: {
        email: email || "cliente@ejemplo.com"
      },
      formAction: "PAYMENT",
      mode: "TEST", 
      captureMode: "AUTOMATIC",
      returnUrl: "https://tu-dominio.com/pago-exitoso",
      cancelUrl: "https://tu-dominio.com/pago-cancelado"
    };

    const response = await axios.post(
      "https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment",
      data,
      {
        auth: {
          username: "TU_LOGIN_IZIPAY",
          password: "TU_PASSWORD_IZIPAY"
        },
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const formToken = response.data.answer.formToken;
    res.json({ formToken });
  } catch (error) {
    console.error("Error al crear pago IZIPAY:", error.response?.data || error.message);
    res.status(500).json({ error: "Error al crear sesión de pago" });
  }
});

export default router;
