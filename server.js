import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import tokenService from './services/tokenService.js';
import dotenv from 'dotenv';
import axios from 'axios';
import { URLSearchParams } from 'url'; // Import URLSearchParams

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This ensures express can parse URL-encoded bodies, which is good practice
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'views')));


// Rota para o callback da Nuvemshop - Este é o fluxo principal
app.get('/oauth/callback', (req, res) => {
    const { code } = req.query;

    if (!code) {
        console.error('Callback recebido sem o código de autorização.');
        return res.status(400).send('Código de autorização ausente.');
    }

    const authUrl = `https://www.nuvemshop.com.br/apps/authorize/token`;

    // A API da Nuvemshop espera os dados como 'application/x-www-form-urlencoded'
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', process.env.CLIENT_ID);
    params.append('client_secret', process.env.CLIENT_SECRET);
    params.append('code', code);

    axios.post(authUrl, params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    })
    .then(response => {
        const { access_token, user_id } = response.data; // user_id é o store_id
        tokenService.saveToken(user_id, access_token);
        console.log(`Token salvo com sucesso para a loja: ${user_id}`);
        // Redireciona para o painel de controle que mostrará o token
        res.redirect('/dashboard');
    })
    .catch(error => {
        // Log detalhado do erro para depuração
        console.error('--- ERRO AO OBTER TOKEN DE ACESSO ---');
        if (error.response) {
            // A requisição foi feita e o servidor respondeu com um status de erro
            console.error('Data:', error.response.data);
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
        } else if (error.request) {
            // A requisição foi feita mas nenhuma resposta foi recebida
            console.error('Request:', error.request);
        } else {
            // Algo aconteceu ao configurar a requisição que acionou um erro
            console.error('Error Message:', error.message);
        }
        console.error('Config:', error.config);
        console.error('--- FIM DO ERRO ---');
        res.status(500).send('Ocorreu um erro ao autenticar a loja. Verifique os logs do servidor.');
    });
});


// Rota para exibir o painel de controle
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Rota para obter todos os tokens salvos (para o dashboard)
app.get('/tokens', (req, res) => {
    try {
        const tokens = tokenService.getAllTokens();
        res.json(tokens);
    } catch (error) {
        console.error('Erro ao ler tokens:', error);
        res.status(500).json({ error: 'Falha ao ler tokens' });
    }
});

// Rota de fallback para qualquer outra coisa, apenas para garantir que o servidor não quebre
app.get('*', (req, res) => {
  res.send('Rota não encontrada.');
});


// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    console.log(`Seu serviço está no ar`);
    console.log(`Disponível em seu URL principal https://nuvem-app1.onrender.com`);
});
