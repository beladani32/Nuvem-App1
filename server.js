import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import tokenService from "./services/tokenService.js";
import pkg from "pg";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static("views"));

const { Client } = pkg;
const { CLIENT_ID, CLIENT_SECRET } = process.env;
const AUTH_URL = "https://www.nuvemshop.com.br/apps/authorize/token";

// ✅ Rota inicial (teste rápido)
app.get("/", (req, res) => {
  res.send("🚀 App Nuvemshop rodando!");
});

// ✅ Callback OAuth — troca o código pelo token e salva no banco
app.get("/oauth/callback", async (req, res) => {
  console.log("🔄 Callback recebido:", req.query);
  const { code, store_id } = req.query;

  try {
    const tokenRes = await axios.post(AUTH_URL, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    });

    const data = tokenRes.data;
    console.log("🔐 Token recebido:", data);

    const storeId = store_id || data.user_id || "6822200";

    if (!data.access_token || !storeId) {
      return res.status(400).send("❌ Falha ao obter token da Nuvemshop (store_id ausente)");
    }

    await tokenService.saveToken(storeId, data);
    console.log(`✅ Token salvo com sucesso para a loja ${storeId}`);

    res.send(`
      <h2>✅ App conectado com sucesso!</h2>
      <p>Loja: ${storeId}</p>
      <pre>${JSON.stringify(data, null, 2)}</pre>
      <a href="/dashboard">Acessar painel</a>
    `);
  } catch (err) {
    console.error("🔥 Erro no callback:", err.response?.data || err.message);
    res.status(500).send("Ocorreu um erro ao autenticar a loja.");
  }
});

// ✅ Painel visual
app.get("/dashboard", (req, res) => {
  res.sendFile(process.cwd() + "/views/dashboard.html");
});

// ✅ Endpoint para listar tokens salvos
app.get("/tokens", async (req, res) => {
  const tokens = await tokenService.getAllTokens();
  res.json(tokens);
});

// ✅ Teste de API — busca produtos da loja
app.get("/test-api/:userId", async (req, res) => {
  const { userId } = req.params;
  const token = await tokenService.getToken(userId);

  if (!token) return res.status(404).send("Token não encontrado para esta loja.");

  try {
    const resp = await axios.get(
      `https://api.nuvemshop.com.br/v1/${userId}/products`,
      {
        headers: {
          "Authentication": `bearer ${token.access_token}`,
          "User-Agent": "LayoutApp (contato@dcriar.com.br)",
        },
      }
    );

    res.json(resp.data);
  } catch (err) {
    console.error("❌ Erro ao chamar API:", err.response?.data || err.message);
    res.status(500).send("Erro ao acessar API da Nuvemshop.");
  }
});

// ✅ Atualização de token (refresh)
app.post("/refresh/:userId", async (req, res) => {
  const { userId } = req.params;
  const token = await tokenService.getToken(userId);

  if (!token?.refresh_token) {
    return res.status(400).send("Loja sem refresh_token salvo.");
  }

  try {
    const resp = await axios.post(AUTH_URL, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    });

    await tokenService.saveToken(userId, resp.data);
    res.send("🔄 Token atualizado com sucesso!");
  } catch (err) {
    console.error("Erro no refresh:", err.response?.data || err.message);
    res.status(500).send("Falha ao atualizar o token.");
  }
});

// 🕵️‍♂️ Função de diagnóstico do banco de dados
async function checkDatabase() {
  // Atraso de 5 segundos para garantir que a tabela foi criada pelo tokenService
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log("\n\n--- INICIANDO DIAGNÓSTICO DO BANCO DE DADOS ---");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Conectado ao banco para diagnóstico!");

    const res = await client.query("SELECT * FROM tokens ORDER BY created_at DESC");
    if (res.rows.length === 0) {
      console.log("⚠️ Nenhum token encontrado na tabela 'tokens'.");
    } else {
      console.log("🔍 Tokens encontrados:");
      res.rows.forEach(row => {
        console.log(`🛍️ Loja ${row.user_id} | Token: ${row.access_token.substring(0, 10)}... | Criado em: ${row.created_at}`);
      });
    }

    console.log("\n📊 Verificando duplicatas...");
    const dup = await client.query("SELECT user_id, COUNT(*) FROM tokens GROUP BY user_id HAVING COUNT(*) > 1");
    if (dup.rows.length > 0) {
      console.log("⚠️ Duplicatas encontradas:", dup.rows);
    } else {
      console.log("✅ Nenhuma duplicata encontrada.");
    }

  } catch (err) {
    console.error("❌ Erro no script de diagnóstico:", err);
  } finally {
    await client.end();
    console.log("--- FIM DO DIAGNÓSTICO ---\n");
  }
}

// ✅ Inicia o servidor e executa o diagnóstico
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  // Executa o diagnóstico após o servidor iniciar
  checkDatabase();
});
