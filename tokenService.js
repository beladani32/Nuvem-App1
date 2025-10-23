import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Necessário para conexões com o Render
});

// Cria a tabela 'tokens' automaticamente se ela não existir
(async () => {
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
  console.log('✅ Tabela "tokens" verificada/criada com sucesso');
})();

export async function saveToken(userId, tokenData) {
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
}

export async function getToken(userId) {
  const result = await pool.query("SELECT * FROM tokens WHERE user_id = $1", [userId]);
  return result.rows[0];
}

export async function getAllTokens() {
  const result = await pool.query("SELECT * FROM tokens");
  return result.rows;
}
