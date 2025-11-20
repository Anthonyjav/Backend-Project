const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://proyecto_back_ab6l_user:t4cZJaubZN11fbmaj2ycrqyEJyl8aA3L@dpg-d49c4eali9vc739p30e0-a.oregon-postgres.render.com:5432/proyecto_back_ab6l?sslmode=require"
});

async function agregarColumnas() {
  try {
    await client.connect();
    console.log("Conectado a la base de datos.");

    const columnas = [
      `ALTER TABLE "Ordens" ADD COLUMN IF NOT EXISTS "orderIdIzipay" VARCHAR;`,
      `ALTER TABLE "Ordens" ADD COLUMN IF NOT EXISTS "transactionId" VARCHAR;`,
      `ALTER TABLE "Ordens" ADD COLUMN IF NOT EXISTS "paymentStatus" VARCHAR;`,
      `ALTER TABLE "Ordens" ADD COLUMN IF NOT EXISTS "paymentResponse" JSON;`,
      `ALTER TABLE "Ordens" ADD COLUMN IF NOT EXISTS "paymentDate" TIMESTAMP;`
    ];

    for (const sql of columnas) {
      await client.query(sql);
      console.log(`✅ Ejecutado: ${sql}`);
    }

    console.log("Todas las columnas se agregaron correctamente.");

  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
    console.log("Conexión cerrada.");
  }
}

agregarColumnas();
