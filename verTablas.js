const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://proyecto_back_ab6l_user:t4cZJaubZN11fbmaj2ycrqyEJyl8aA3L@dpg-d49c4eali9vc739p30e0-a.oregon-postgres.render.com:5432/proyecto_back_ab6l?sslmode=require"
});

async function verColumnas() {
  try {
    await client.connect();
    console.log("Conectado a la base de datos.");

    const res = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'Ordens';
    `);

    console.log("Columnas de Ordens:");
    console.table(res.rows);

  } catch (error) {
    console.error(error);
  } finally {
    await client.end();
    console.log("Conexión cerrada.");
  }
}

verColumnas();
