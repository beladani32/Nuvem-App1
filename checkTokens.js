import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pkg;

async function checkTokens() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Conectado ao banco de dados!");

    const res = await client.query("SELECT * FROM tokens ORDER BY created_at DESC");
    if (res.rows.length === 0) {
      console.log("⚠️ Nenhum token encontrado ainda.");
    } else {
      console.log("🔍 Tokens encontrados:");
      res.rows.forEach(row => {
        console.log(`🛍️ Loja ${row.user_id} | Token: ${row.access_token.substring(0, 10)}...`);
      });
    }

    console.log("\n📊 Verificando duplicatas...");
    const dup = await client.query(`
      SELECT user_id, COUNT(*) 
      FROM tokens 
      GROUP BY user_id 
      HAVING COUNT(*) > 1
    `);
    if (dup.rows.length > 0) {
      console.log("⚠️ Duplicatas encontradas:", dup.rows);
    } else {
      console.log("✅ Nenhuma duplicata encontrada.");
    }

  } catch (err) {
    console.error("❌ Erro ao acessar o banco:", err);
  } finally {
    await client.end();
  }
}

checkTokens();