import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import { saveToken, getAllTokens, getToken } from "./services/tokenService.js";
import path from "path";
import { fileURLToPath } from "url";

// Configuração para usar __dirname com ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static("views"));

const { CLIENT_ID, CLIENT_SECRET } = process.env;
const AUTH_URL = "https://www.nuvemshop.com.br/apps/authorize/token";

// ✅ Rota inicial (redireciona para autorização da Nuvemshop)
app.get('/', (req, res) => {
    const url = `https://www.nuvemshop.com.br/apps/${CLIENT_ID}/authorize`;
    res.redirect(url);
});

// ✅ Callback OAuth — troca o código pelo token e salva no banco
app.get("/oauth/callback", async (req, res) => {
  console.log("🔄 Callback recebido:", req.query);
  const { code } = req.query;

  try {
    const tokenRes = await axios.post(AUTH_URL, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    });

    const data = tokenRes.data;
    console.log("🔐 Token recebido:", data);

    if (!data.access_token || !data.user_id) {
      return res.status(400).send("❌ Falha ao obter token da Nuvemshop");
    }

    await saveToken(data.user_id, data);

    res.redirect(`/dashboard?user_id=${data.user_id}`);

  } catch (err) {
    console.error("🔥 Erro no callback:", err.response?.data || err.message);
    res.status(500).send("Ocorreu um erro ao autenticar a loja.");
  }
});

// ✅ Painel visual
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// ✅ Endpoint para listar tokens salvos
app.get("/tokens", async (req, res) => {
  const tokens = await getAllTokens();
  res.json(tokens);
});

// ✅ Teste de API — busca produtos da loja
app.get("/test-api/:userId", async (req, res) => {
  const { userId } = req.params;
  const token = await getToken(userId);

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
  const token = await getToken(userId);

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

    await saveToken(userId, resp.data);
    res.send("🔄 Token atualizado com sucesso!");
  } catch (err) {
    console.error("Erro no refresh:", err.response?.data || err.message);
    res.status(500).send("Falha ao atualizar o token.");
  }
});

// ✅ Inicia o servidor
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
