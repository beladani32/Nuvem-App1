import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Objeto de serviço que será exportado
const tokenService = {};

// 🔹 Reseta a tabela na inicialização para garantir um esquema limpo.
(async () => {
  try {
    await pool.query(`DROP TABLE IF EXISTS tokens;`); // Apaga a tabela antiga
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tokens (
        user_id BIGINT PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        scope TEXT,
        token_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela "tokens" verificada/recriada com sucesso.');
  } catch (err) {
    console.error("🔥 Erro ao recriar a tabela de tokens:", err);
  }
})();

tokenService.saveToken = async (userId, tokenData) => {
  await pool.query(
    `INSERT INTO tokens (user_id, access_token, refresh_token, scope, token_type)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id)
     DO UPDATE SET
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       scope = EXCLUDED.scope,
       token_type = EXCLUDED.token_type,
       created_at = NOW()`,
    [
      userId,
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.scope,
      tokenData.token_type,
    ]
  );
};

tokenService.getToken = async (userId) => {
  const result = await pool.query("SELECT * FROM tokens WHERE user_id = $1", [userId]);
  return result.rows[0];
};

tokenService.getAllTokens = async () => {
  const result = await pool.query("SELECT * FROM tokens");
  return result.rows;
};

export default tokenService;
