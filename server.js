import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import tokenService from "./services/tokenService.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static("views"));

const { CLIENT_ID, CLIENT_SECRET } = process.env;
const AUTH_URL = "https://www.nuvemshop.com.br/apps/authorize/token";

// ✅ Rota inicial (teste rápido)
app.get("/", (req, res) => {
  res.send("🚀 App Nuvemshop rodando!");
});

// ✅ Callback OAuth — troca o código pelo token e salva no banco
app.get("/oauth/callback", async (req, res) => {
  console.log("🔄 Callback recebido:", req.query);
  const { code } = req.query; // Ignoramos o store_id da URL, ele não é confiável

  try {
    const tokenRes = await axios.post(AUTH_URL, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    });

    const data = tokenRes.data;
    console.log("🔐 Token recebido:", data);

    // ❗️ CORREÇÃO: Usar SEMPRE o user_id do token, que é o ID canônico e correto.
    const storeId = String(data.user_id);

    if (!data.access_token || !storeId) {
      return res.status(400).send("❌ Falha ao obter token ou ID da loja da Nuvemshop.");
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

  if (!token) {
    return res.status(404).send(`Token não encontrado para esta loja.`);
  }

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

// ✅ Inicia o servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
