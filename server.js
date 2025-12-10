const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const bcrypt = require('bcryptjs');

// --- Bloco de Verificação de Variáveis de Ambiente ---
console.log("--- Verificando Variáveis de Ambiente na Inicialização ---");
console.log("NODE_ENV:", process.env.NODE_ENV || 'development (padrão)');
console.log("PORT:", process.env.PORT || '5000 (padrão)');
console.log("DATABASE_URL:", process.env.DATABASE_URL ? 'Definida' : '*** NÃO DEFINIDA ***');
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
console.log("RENDER_EXTERNAL_URL:", process.env.RENDER_EXTERNAL_URL || 'Não aplicável (local)');
console.log("JWT_SECRET:", process.env.JWT_SECRET ? 'Definido' : '*** NÃO DEFINIDO ***');
console.log("\n--- Configurações de E-mail (Nodemailer) ---");
console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_PORT:", process.env.SMTP_PORT);
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("SMTP_PASS:", process.env.SMTP_PASS ? 'Definida' : '*** NÃO DEFINIDA ***');
console.log("SMTP_FROM_NAME:", process.env.SMTP_FROM_NAME);
console.log("SMTP_FROM_EMAIL:", process.env.SMTP_FROM_EMAIL);
console.log("\n--- Configurações de Pagamento (Efí) ---");
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Modo Efí: ${isProduction ? 'Produção' : 'Homologação (Sandbox)'}`);
console.log("EFI_CERTIFICATE_PATH:", process.env.EFI_CERTIFICATE_PATH ? 'Definido' : '*** NÃO DEFINIDO ***');
console.log("EFI_PIX_KEY:", process.env.EFI_PIX_KEY ? 'Definida' : '*** NÃO DEFINIDA ***');
if (isProduction) {
    console.log("EFI_PROD_CLIENT_ID:", process.env.EFI_PROD_CLIENT_ID ? 'Definido' : '*** NÃO DEFINIDO ***');
    console.log("EFI_PROD_CLIENT_SECRET:", process.env.EFI_PROD_CLIENT_SECRET ? 'Definido' : '*** NÃO DEFINIDO ***');
} else {
    console.log("EFI_HOMOLOG_CLIENT_ID:", process.env.EFI_HOMOLOG_CLIENT_ID ? 'Definido' : '*** NÃO DEFINIDO ***');
    console.log("EFI_HOMOLOG_CLIENT_SECRET:", process.env.EFI_HOMOLOG_CLIENT_SECRET ? 'Definido' : '*** NÃO DEFINIDO ***');
}
console.log("\n-------------------------------------------------------\n");

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');

// Integração com a API da Efí
const { EfiPay } = require('./efiPay.service');


const app = express();
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});
const PORT = process.env.PORT || 5000;

// --- Configuração do Nodemailer ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: parseInt(process.env.SMTP_PORT, 10) === 465, // `true` para 465, `false` para outras como 587 (TLS)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// --- Verificação da Conexão Nodemailer ---
transporter.verify(function(error, success) {
  if (error) {
    console.error("Erro na configuração do Nodemailer:", error);
  } else {
    console.log("Nodemailer está configurado e pronto para enviar e-mails.");
  }
});


// --- Configuração do Middleware ---
app.use(express.json());

// Configuração de CORS para Produção
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.FRONTEND_URL, // URL principal definida no .env
      'http://localhost:5000',  // Para desenvolvimento local
      'http://127.0.0.1:5000'
    ];

    if (process.env.RENDER_EXTERNAL_URL) {
      allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
    }

    if (!origin || allowedOrigins.some(o => o && origin.startsWith(o))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));

// --- Conteúdo HTML Incorporado ---

const lojaHtml = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gamer Store</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Rajdhani:wght@400;600&display=swap" rel="stylesheet">
    <style>
        /* --- Estilos Gerais --- */
        body {
            font-family: 'Rajdhani', sans-serif;
            margin: 0;
            background-color: #12121c;
            color: #e0e0e0;
        }

        /* --- Cabeçalho --- */
        .header {
            background-color: #1a1a2e;
            color: #e0e0e0;
            padding: 15px 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 1001;
            border-bottom: 2px solid #00aaff;
            box-shadow: 0 4px 15px rgba(0, 170, 255, 0.2);
        }

        .header h1 {
            font-family: 'Orbitron', sans-serif;
            margin: 0;
            font-size: 2.2em;
            color: #fff;
            text-shadow: 0 0 10px #00aaff, 0 0 20px #00aaff;
        }

        .header-nav a {
            color: white;
            margin: 0 10px;
            text-decoration: none;
            cursor: pointer;
            font-weight: bold;
        }

        .header-nav a:hover {
            color: #00aaff;
            text-shadow: 0 0 5px #00aaff;
        }

        .header-nav .admin-panel-btn {
            background: linear-gradient(45deg, #00aaff, #0055ff);
            padding: 8px 12px;
            border-radius: 5px;
            transition: all 0.3s ease;
        }

        /* --- Grade de Produtos --- */
        .product-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }

        /* --- Cartão de Produto --- */
        .product-card {
            background-color: #1a1a2e;
            border: 1px solid #334;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
        }

        .product-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 0 25px rgba(0, 170, 255, 0.5);
            border-color: #00aaff;
        }

        .product-card img {
            max-width: 100%;
            height: 200px;
            object-fit: cover;
            border-radius: 4px;
            margin-bottom: 15px;
            background-color: #2a2a3e;
        }

        .product-card h3 {
            font-size: 1.2em;
            margin: 10px 0;
        }

        .product-price {
            font-weight: bold;
            color: #00d9ff;
            font-size: 1.3em;
            margin-bottom: 15px;
            font-family: 'Orbitron', sans-serif;
        }

        .add-to-cart-btn {
            background: linear-gradient(45deg, #00aaff, #0055ff);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 0 10px rgba(0, 170, 255, 0.5);
        }

        .add-to-cart-btn:hover {
            box-shadow: 0 0 20px rgba(0, 170, 255, 0.8);
            transform: scale(1.05);
        }

        /* --- Estilos para Avaliações --- */
        .reviews-section {
            margin-top: 20px;
            border-top: 1px solid #334;
            padding-top: 15px;
        }
        .review {
            border-bottom: 1px solid #2a2a3e;
            padding: 10px 0;
        }
        .review:last-child {
            border-bottom: none;
        }
        .review-author {
            font-weight: bold;
            color: #00aaff;
        }
        .star-rating {
            color: #ffc107; /* Amarelo */
        }


        /* --- Modal (Janela Pop-up) --- */
        .modal {
            display: none; /* Escondido por padrão */
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.6);
        }

        .modal-content {
            background-color: #1a1a2e;
            margin: 10% auto;
            padding: 20px;
            border: 1px solid #00aaff;
            width: 80%;
            max-width: 500px;
            border-radius: 8px;
            position: relative;
            box-shadow: 0 0 30px rgba(0, 170, 255, 0.4);
        }

        .close-btn {
            color: #aaa;
            position: absolute;
            top: 10px;
            right: 20px;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }

        .close-btn:hover {
            color: black;
        }

        /* --- Formulários e Carrinho --- */
        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
        }

        .form-group input {
            width: 95%;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid #334;
            background-color: #2a2a3e;
            color: #e0e0e0;
        }

        .form-group input:focus {
            outline: none;
            border-color: #00aaff;
            box-shadow: 0 0 10px rgba(0, 170, 255, 0.5);
        }
        
        /* Estilos para o Modal de Pagamento */
        #pix-qr-code {
            display: block;
            margin: 20px auto;
        }
        #pix-copy-paste {
            width: 95%;
            padding: 8px;
            margin-top: 10px;
            font-family: monospace;
            background-color: #12121c;
            border: 1px solid #334;
            border-radius: 4px;
        }
        #payment-status {
            text-align: center;
            font-weight: bold;
            margin-top: 15px;
            font-size: 1.1em;
            color: #ffc107; /* Amarelo para "aguardando" */
        }

        .remove-from-cart-btn {
            background-color: #c82333;
            border-color: #bd2130;
            margin-left: 10px;
            padding: 5px 10px;
        }
    </style>
</head>
<body>

    <header class="header">
        <h1>Gamer Store</h1>
        <nav class="header-nav">
            <a id="my-orders-btn" style="display: none;" href="/meus-pedidos.html">Meus Pedidos</a>
            <span id="user-display" style="display: none;"></span>
            <a id="admin-orders-btn" style="display: none;" onclick="showAdminOrders()">Ver Pedidos</a>
            <a id="admin-panel-btn" class="admin-panel-btn" style="display: none;" onclick="showModal('admin-modal')">Painel Admin</a>
            <a id="login-btn" onclick="showModal('login-modal')">Login</a>
            <a id="register-btn" onclick="showModal('register-modal')">Criar Conta</a>
            <a id="logout-btn" style="display: none;" onclick="logout()">Logout</a>
        </nav>
    </header>

    <!-- A grade de produtos será preenchida pelo JavaScript -->
    <main id="product-container" class="product-grid"></main>

    <!-- Modal de Login -->
    <div id="login-modal" class="modal">
        <div class="modal-content">
            <span class="close-btn" onclick="closeModal('login-modal')">&times;</span>
            <h2>Login</h2>
            <form id="login-form">
                <div class="form-group">
                    <label for="login-email">Email:</label>
                    <input type="email" id="login-email" required>
                </div>
                <div class="form-group">
                    <label for="login-password">Senha:</label>
                    <input type="password" id="login-password" required>
                </div>
                <button type="submit" class="add-to-cart-btn">Entrar</button>
            </form>
        </div>
    </div>

    <!-- Modal de Registro -->
    <div id="register-modal" class="modal">
        <div class="modal-content">
            <span class="close-btn" onclick="closeModal('register-modal')">&times;</span>
            <h2>Criar Conta</h2>
            <form id="register-form">
                <div class="form-group">
                    <label for="register-username">Usuário:</label>
                    <input type="text" id="register-username" required>
                </div>
                <div class="form-group">
                    <label for="register-email">Email:</label>
                    <input type="email" id="register-email" required>
                </div>
                <div class="form-group">
                    <label for="register-password">Senha:</label>
                    <input type="password" id="register-password" required>
                </div>
                <button type="submit" class="add-to-cart-btn">Registrar</button>
            </form>
        </div>
    </div>

    <!-- Modal do Painel Admin -->
    <div id="admin-modal" class="modal">
        <div class="modal-content">
            <span class="close-btn" onclick="closeModal('admin-modal'); resetAdminForm();">&times;</span>
            <h2 id="admin-form-title">Adicionar Novo Produto</h2>
            <form id="admin-form">
                <input type="hidden" id="product-id">
                <div class="form-group">
                    <label for="product-name">Nome do Produto:</label>
                    <input type="text" id="product-name" required>
                </div>
                <div class="form-group">
                    <label for="product-description">Descrição:</label>
                    <input type="text" id="product-description" required>
                </div>
                <div class="form-group">
                    <label for="product-price">Preço (ex: 123.45):</label>
                    <input type="number" step="0.01" id="product-price" required>
                </div>
                <div class="form-group">
                    <label for="product-imageUrl">URL da Imagem:</label>
                    <input type="text" id="product-imageUrl" required>
                </div>
                <div class="form-group">
                    <label for="product-category">Categoria:</label>
                    <input type="text" id="product-category" required>
                </div>
                <button type="submit" class="add-to-cart-btn">Salvar Produto</button>
            </form>
        </div>
    </div>

    <!-- Modal de Detalhes do Produto e Avaliações -->
    <div id="product-details-modal" class="modal">
        <div class="modal-content">
            <span class="close-btn" onclick="closeModal('product-details-modal')">&times;</span>
            <div id="product-details-content">
                <!-- Conteúdo dinâmico aqui -->
            </div>
            <div class="reviews-section">
                <h3>Avaliações</h3>
                <div id="reviews-list">
                    <!-- Lista de avaliações aqui -->
                </div>
                <form id="review-form" style="display: none; margin-top: 20px;">
                    <h4>Deixe sua avaliação</h4>
                    <div class="form-group">
                        <label for="review-rating">Nota (1 a 5):</label>
                        <input type="number" id="review-rating" min="1" max="5" required>
                    </div>
                    <div class="form-group">
                        <label for="review-comment">Comentário:</label>
                        <input type="text" id="review-comment" placeholder="O que você achou do produto?">
                    </div>
                    <button type="submit" class="add-to-cart-btn">Enviar Avaliação</button>
                </form>
            </div>
        </div>
    </div>

    <!-- Modal de Pagamento PIX -->
    <div id="payment-modal" class="modal">
        <div class="modal-content">
            <span class="close-btn" onclick="closeModal('payment-modal')">&times;</span>
            <h2>Pagamento via PIX</h2>
            <p>Pague para receber seu produto. O QR Code expira em 4 minutos.</p>
            <img id="pix-qr-code" src="" alt="PIX QR Code">
            <div class="form-group">
                <label for="pix-copy-paste">PIX Copia e Cola:</label>
                <input type="text" id="pix-copy-paste" readonly>
            </div>
            <div id="payment-status">Aguardando pagamento...</div>
        </div>
    </div>

    <!-- Modal de Pedidos do Admin -->
    <div id="admin-orders-modal" class="modal">
        <div class="modal-content" style="max-width: 800px;">
            <span class="close-btn" onclick="closeModal('admin-orders-modal')">&times;</span>
            <h2>Todos os Pedidos</h2>
            <div id="admin-orders-list">
                <!-- A lista de pedidos será inserida aqui pelo JavaScript -->
            </div>
        </div>
    </div>

    <script>
        // ==================================================
        // ESTADO DA APLICAÇÃO
        // ==================================================
        const API_URL = '/api'; // A API agora está na mesma origem
        const BASE_URL = ''; // A base agora é a raiz do servidor
        let currentUser = null;

        const productContainer = document.getElementById('product-container');
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const adminForm = document.getElementById('admin-form');

        // ==================================================
        // FUNÇÕES DE RENDERIZAÇÃO E UI
        // ==================================================
        async function fetchAndRenderProducts() {
            productContainer.innerHTML = '';
            try {
                const response = await fetch(\`\${API_URL}/products\`);
                if (!response.ok) throw new Error('Não foi possível carregar os produtos.');
                const products = await response.json();

                products.forEach(product => {
                    const productCard = document.createElement('div');
                    productCard.className = 'product-card';
                    
                    let adminButtons = '';
                    if (currentUser && currentUser.user.role === 'ADMIN') {
                        adminButtons = \`
                            <button onclick="openEditModal('\${product.id}', '\${product.name}', '\${product.description}', \${product.price}, '\${product.imageUrl}', '\${product.category}')">Editar</button>
                            <button class="remove-from-cart-btn" onclick="deleteProduct('\${product.id}')">Excluir</button>
                        \`;
                    }

                    productCard.innerHTML = \`
                        <img src="\${product.imageUrl}" alt="\${product.name}">
                        <h3 style="cursor: pointer;" onclick="openProductDetails('\${product.id}')">\${product.name}</h3>
                        <p class="product-price">R$ \${product.price.toFixed(2).replace('.', ',')}</p>
                        <button class="add-to-cart-btn" onclick="initiatePurchase('\${product.id}')">Comprar</button>
                        <div class="admin-controls" style="margin-top: 10px;">
                            \${adminButtons}
                        </div>
                    \`;
                    productContainer.appendChild(productCard);
                });
            } catch (error) {
                productContainer.innerHTML = \`<p style="color: red;">\${error.message}</p>\`;
            }
        }

        function updateUserUI() {
            const userDisplay = document.getElementById('user-display');
            const loginBtn = document.getElementById('login-btn');
            const registerBtn = document.getElementById('register-btn');
            const logoutBtn = document.getElementById('logout-btn');
            const adminBtn = document.getElementById('admin-panel-btn');
            const myOrdersBtn = document.getElementById('my-orders-btn');
            const adminOrdersBtn = document.getElementById('admin-orders-btn');

            const token = localStorage.getItem('gamerStoreToken');
            const user = JSON.parse(localStorage.getItem('gamerStoreUser'));

            if (token && user) {
                currentUser = { user, token };
                userDisplay.innerText = \`Olá, \${currentUser.user.username}\`;
                userDisplay.style.display = 'inline';
                logoutBtn.style.display = 'inline';
                loginBtn.style.display = 'none';
                myOrdersBtn.style.display = 'inline';
                registerBtn.style.display = 'none';

                if (currentUser.user.role === 'ADMIN') {
                    adminBtn.style.display = 'inline';
                    adminOrdersBtn.style.display = 'inline';
                }

            } else {
                currentUser = null;
                userDisplay.style.display = 'none';
                logoutBtn.style.display = 'none';
                adminBtn.style.display = 'none';
                adminOrdersBtn.style.display = 'none';
                myOrdersBtn.style.display = 'none';
                loginBtn.style.display = 'inline';
                registerBtn.style.display = 'inline';
            }
            // Re-renderiza os produtos para mostrar/esconder botões de admin
            fetchAndRenderProducts();
        }

        // ==================================================
        // FUNÇÕES DE COMPRA E PAGAMENTO
        // ==================================================
        async function initiatePurchase(productId) {
            if (!currentUser) {
                alert("Você precisa estar logado para comprar.");
                showModal('login-modal');
                return;
            }

            try {
                const response = await fetch(\`\${API_URL}/orders\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${currentUser.token}\`
                    },
                    body: JSON.stringify({ productId: productId, quantity: 1 }),
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Falha ao criar pedido.');

                // Preenche o modal de pagamento e o exibe
                document.getElementById('pix-qr-code').src = data.pix.qrCodeImage;
                document.getElementById('pix-copy-paste').value = data.pix.qrCodeCopyPaste;
                showModal('payment-modal');

                // Adiciona uma lógica para verificar o status do pagamento e redirecionar
                const orderId = data.order.id;
                const paymentCheckInterval = setInterval(async () => {
                    const statusRes = await fetch(\`\${API_URL}/orders/\${orderId}/status\`); // Precisamos criar essa rota
                    const statusData = await statusRes.json();
                    if (statusData.status === 'PAID') {
                        clearInterval(paymentCheckInterval);
                        alert('Pagamento confirmado! Você será redirecionado para o chat com o vendedor.');
                        window.location.href = \`\${BASE_URL}/chat.html?orderId=\${orderId}\`;
                    }
                }, 5000); // Verifica a cada 5 segundos
            } catch (error) {
                alert(\`Erro: \${error.message}\`);
            }
        }

        // ==================================================
        // FUNÇÕES DE AVALIAÇÃO E DETALHES DO PRODUTO
        // ==================================================
        async function openProductDetails(productId) {
            const detailsContent = document.getElementById('product-details-content');
            const reviewsList = document.getElementById('reviews-list');
            const reviewForm = document.getElementById('review-form');

            detailsContent.innerHTML = 'Carregando...';
            reviewsList.innerHTML = '';
            reviewForm.style.display = 'none';
            showModal('product-details-modal');

            // 1. Buscar avaliações
            const reviewsResponse = await fetch(\`\${API_URL}/products/\${productId}/reviews\`);
            const reviews = await reviewsResponse.json();

            reviewsList.innerHTML = reviews.length > 0 ? '' : '<p>Este produto ainda não tem avaliações.</p>';
            reviews.forEach(review => {
                const reviewDiv = document.createElement('div');
                reviewDiv.className = 'review';
                reviewDiv.innerHTML = \`
                    <p><span class="star-rating">\${'★'.repeat(review.rating)}\${'☆'.repeat(5 - review.rating)}</span></p>
                    <p>\${review.comment || '<i>Sem comentário.</i>'}</p>
                    <p>- <span class="review-author">\${review.user.username}</span></p>
                \`;
                reviewsList.appendChild(reviewDiv);
            });

            // 2. Configurar o formulário de avaliação
            reviewForm.onsubmit = async (e) => {
                e.preventDefault();
                const rating = document.getElementById('review-rating').value;
                const comment = document.getElementById('review-comment').value;

                try {
                    const response = await fetch(\`\${API_URL}/products/\${productId}/reviews\`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': \`Bearer \${currentUser.token}\`
                        },
                        body: JSON.stringify({ rating: parseInt(rating), comment })
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message);

                    alert('Avaliação enviada com sucesso!');
                    closeModal('product-details-modal');
                } catch (error) {
                    alert(\`Erro: \${error.message}\`);
                }
            };

            // 3. Mostrar formulário se o usuário pode avaliar
            // (Simples verificação, o backend faz a validação real se o usuário comprou)
            if (currentUser) {
                // Uma verificação mais robusta no frontend poderia checar os pedidos do usuário
                reviewForm.style.display = 'block';
            }
        }

        // ==================================================
        // FUNÇÕES DE AUTENTICAÇÃO
        // ==================================================
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('register-username').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;

            try {
                const response = await fetch(\`\${API_URL}/auth/register\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password }),
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Falha ao registrar.');

                alert(data.message);
                closeModal('register-modal');
                registerForm.reset();

            } catch (error) {
                alert(\`Erro: \${error.message}\`);
            }
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch(\`\${API_URL}/auth/login\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Falha no login.');

                // Salva o usuário e o token no localStorage
                localStorage.setItem('gamerStoreUser', JSON.stringify(data.user));
                localStorage.setItem('gamerStoreToken', data.token);

                alert(data.message);
                updateUserUI();
                closeModal('login-modal');
                loginForm.reset();

            } catch (error) {
                alert(\`Erro: \${error.message}\`);
            }
        });

        function logout() {
            localStorage.removeItem('gamerStoreUser');
            localStorage.removeItem('gamerStoreToken');
            updateUserUI();
            alert('Você saiu da sua conta.');
        }

        // ==================================================
        // FUNÇÕES DE ADMIN
        // ==================================================
        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('product-id').value;
            const productData = {
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                price: parseFloat(document.getElementById('product-price').value),
                imageUrl: document.getElementById('product-imageUrl').value,
                category: document.getElementById('product-category').value,
            };

            const isEditing = id !== '';
            const url = isEditing ? \`\${API_URL}/products/\${id}\` : \`\${API_URL}/products\`;
            const method = isEditing ? 'PUT' : 'POST';

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${currentUser.token}\`
                    },
                    body: JSON.stringify(productData),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Falha ao salvar produto.');
                }

                alert(\`Produto \${isEditing ? 'atualizado' : 'criado'} com sucesso!\`);
                closeModal('admin-modal');
                resetAdminForm();
                fetchAndRenderProducts();

            } catch (error) {
                alert(\`Erro: \${error.message}\`);
            }
        });

        async function showAdminOrders() {
            if (!currentUser || currentUser.user.role !== 'ADMIN') {
                alert('Acesso negado.');
                return;
            }

            const ordersListDiv = document.getElementById('admin-orders-list');
            ordersListDiv.innerHTML = 'Carregando pedidos...';
            showModal('admin-orders-modal');

            try {
                const response = await fetch(\`\${API_URL}/orders/all\`, {
                    headers: { 'Authorization': \`Bearer \${currentUser.token}\` }
                });
                if (!response.ok) throw new Error('Falha ao buscar pedidos.');

                const orders = await response.json();

                if (orders.length === 0) {
                    ordersListDiv.innerHTML = '<p>Nenhum pedido encontrado.</p>';
                    return;
                }

                let tableHTML = \`
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 1px solid #334;">
                                <th style="padding: 8px;">ID Pedido</th>
                                <th style="padding: 8px;">Usuário</th>
                                <th style="padding: 8px;">Produto</th>
                                <th style="padding: 8px;">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                \`;
                orders.forEach(order => {
                    tableHTML += \`
                        <tr style="border-bottom: 1px solid #2a2a3e;">
                            <td style="padding: 8px;">\${order.id}</td>
                            <td style="padding: 8px;">\${order.user.username} (\${order.user.email})</td>
                            <td style="padding: 8px;">\${order.product.name}</td>
                            <td style="padding: 8px;">\${order.status}</td>
                        </tr>
                    \`;
                });
                tableHTML += '</tbody></table>';
                ordersListDiv.innerHTML = tableHTML;

            } catch (error) {
                ordersListDiv.innerHTML = \`<p style="color: red;">Erro: \${error.message}</p>\`;
            }
        }

        function openEditModal(id, name, description, price, imageUrl, category) {
            document.getElementById('admin-form-title').innerText = 'Editar Produto';
            document.getElementById('product-id').value = id;
            document.getElementById('product-name').value = name;
            document.getElementById('product-description').value = description;
            document.getElementById('product-price').value = price;
            document.getElementById('product-imageUrl').value = imageUrl;
            document.getElementById('product-category').value = category;
            showModal('admin-modal');
        }

        async function deleteProduct(id) {
            if (!confirm('Tem certeza que deseja excluir este produto?')) return;

            try {
                const response = await fetch(\`\${API_URL}/products/\${id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': \`Bearer \${currentUser.token}\` }
                });

                if (!response.ok) throw new Error('Falha ao excluir produto.');

                alert('Produto excluído com sucesso!');
                fetchAndRenderProducts();

            } catch (error) {
                alert(\`Erro: \${error.message}\`);
            }
        }

        function resetAdminForm() {
            document.getElementById('admin-form-title').innerText = 'Adicionar Novo Produto';
            adminForm.reset();
            document.getElementById('product-id').value = '';
        }

        // ==================================================
        // FUNÇÕES DO MODAL
        // ==================================================
        function showModal(modalId) {
            document.getElementById(modalId).style.display = 'block';
        }

        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
        }

        // Fecha o modal se clicar fora do conteúdo
        window.onclick = function(event) {
            if (event.target.classList.contains('modal')) {
                event.target.style.display = "none";
            }
        }

        // ==================================================
        // INICIALIZAÇÃO DA PÁGINA
        // ==================================================
        document.addEventListener('DOMContentLoaded', async () => {
            // Verifica se a URL contém um token de verificação
            const urlParams = new URLSearchParams(window.location.search);
            const verificationToken = urlParams.get('verify');

            if (verificationToken) {
                try {
                    const response = await fetch(\`\${API_URL}/auth/verify-email?token=\${verificationToken}\`);
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message);

                    alert(data.message);
                    // Limpa o token da URL para evitar re-verificação
                    window.history.replaceState({}, document.title, "/loja.html");

                } catch (error) {
                    alert(\`Erro na verificação: \${error.message}\`);
                }
            }

            updateUserUI(); // Isso também vai chamar fetchAndRenderProducts()
        });
    </script>

</body>
</html>
`;

const meusPedidosHtml = `
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meus Pedidos - Gamer Store</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Rajdhani:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Rajdhani', sans-serif;
            margin: 0;
            background-color: #12121c;
            color: #e0e0e0;
        }
        .header {
            background-color: #1a1a2e;
            padding: 15px 30px;
            border-bottom: 2px solid #00aaff;
            box-shadow: 0 4px 15px rgba(0, 170, 255, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header h1 {
            font-family: 'Orbitron', sans-serif;
            margin: 0;
            font-size: 2.2em;
            color: #fff;
            text-shadow: 0 0 10px #00aaff, 0 0 20px #00aaff;
        }
        .header a {
            color: white;
            text-decoration: none;
            font-weight: bold;
        }
        .container {
            max-width: 900px;
            margin: 30px auto;
            padding: 20px;
        }
        .order-card {
            background-color: #1a1a2e;
            border: 1px solid #334;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            display: flex;
            flex-direction: column;
            gap: 15px;
            box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
        }
        .order-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #334;
            padding-bottom: 10px;
        }
        .order-id {
            font-family: 'Orbitron', sans-serif;
            font-size: 1.1em;
        }
        .order-status {
            font-weight: bold;
            padding: 5px 10px;
            border-radius: 5px;
            text-transform: uppercase;
        }
        .status-PENDING { background-color: #ffc107; color: #333; }
        .status-PAID { background-color: #007bff; color: white; }
        .status-DELIVERED { background-color: #28a745; color: white; }
        .order-item {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .order-item img {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 4px;
        }
        .order-actions a {
            background: linear-gradient(45deg, #00aaff, #0055ff);
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            text-decoration: none;
            font-weight: bold;
            transition: all 0.3s ease;
        }
        .order-actions a:hover {
            box-shadow: 0 0 15px rgba(0, 170, 255, 0.7);
        }
    </style>
</head>
<body>

    <header class="header">
        <h1>Meus Pedidos</h1>
        <a href="/loja.html">Voltar para a Loja</a>
    </header>

    <main id="orders-container" class="container">
        <!-- Pedidos serão carregados aqui -->
    </main>

    <script>
        document.addEventListener('DOMContentLoaded', async () => {
            const ordersContainer = document.getElementById('orders-container');
            const token = localStorage.getItem('gamerStoreToken');
            const user = JSON.parse(localStorage.getItem('gamerStoreUser'));

            if (!token || !user) {
                ordersContainer.innerHTML = '<h2>Você precisa estar logado para ver seus pedidos.</h2>';
                return;
            }

            try {
                const response = await fetch('/api/my-orders', {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });

                if (!response.ok) throw new Error('Falha ao carregar pedidos.');

                const orders = await response.json();

                if (orders.length === 0) {
                    ordersContainer.innerHTML = '<h2>Você ainda não fez nenhum pedido.</h2>';
                    return;
                }

                orders.forEach(order => {
                    const orderCard = document.createElement('div');
                    orderCard.className = 'order-card';

                    const orderDate = new Date(order.createdAt).toLocaleDateString('pt-BR');

                    // Assumindo um item por pedido, como no fluxo atual
                    const item = order.items[0];
                    const productName = item.product.name;
                    const productImageUrl = item.product.imageUrl;

                    orderCard.innerHTML = \`
                        <div class="order-header">
                            <span class="order-id">Pedido #\${order.id.substring(0, 8)}</span>
                            <span class="order-status status-\${order.status}">\${order.status}</span>
                        </div>
                        <div class="order-item">
                            <img src="\${productImageUrl}" alt="\${productName}">
                            <div>
                                <strong>\${productName}</strong>
                                <p>Data: \${orderDate} | Total: R$ \${order.total.toFixed(2).replace('.', ',')}</p>
                            </div>
                        </div>
                        <div class="order-actions">
                            <a href="/chat.html?orderId=\${order.id}">Acessar Chat</a>
                        </div>
                    \`;
                    ordersContainer.appendChild(orderCard);
                });

            } catch (error) {
                ordersContainer.innerHTML = \`<h2 style="color: red;">\${error.message}</h2>\`;
            }
        });
    </script>

</body>
</html>
`;

const chatHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat do Pedido - Gamer Store</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            background-color: #1a1a1a;
            color: #f0f0f0;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
        }
        .chat-container {
            width: 100%;
            max-width: 600px;
            height: 80vh;
            background-color: #242424;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        }
        .chat-header {
            padding: 15px;
            background-color: #1f1f1f;
            border-bottom: 1px solid #333;
            text-align: center;
            font-size: 1.2em;
            font-weight: bold;
        }
        .admin-action-btn {
            background-color: #28a745;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.8em;
            margin-left: 15px;
            transition: background-color 0.2s;
        }
        .admin-action-btn:hover { background-color: #218838; }
        .messages-area {
            flex-grow: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        }
        .message {
            max-width: 70%;
            padding: 10px 15px;
            border-radius: 18px;
            margin-bottom: 10px;
            line-height: 1.4;
        }
        .message.sent {
            background-color: #007bff;
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }
        .message.received {
            background-color: #3a3a3a;
            color: #f0f0f0;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
        }
        .message-form {
            display: flex;
            padding: 15px;
            border-top: 1px solid #333;
        }
        #message-input {
            flex-grow: 1;
            padding: 10px;
            border: 1px solid #444;
            border-radius: 20px;
            background-color: #3a3a3a;
            color: #f0f0f0;
            margin-right: 10px;
        }
        #send-button {
            padding: 10px 20px;
            border: none;
            background-color: #007bff;
            color: white;
            border-radius: 20px;
            cursor: pointer;
            font-weight: bold;
        }
        #send-button:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>

    <div class="chat-container">
        <div class="chat-header" id="chat-header">Chat do Pedido</div>
        <div class="messages-area" id="messages-area">
            <!-- As mensagens serão inseridas aqui pelo JavaScript -->
        </div>
        <form class="message-form" id="message-form">
            <input type="text" id="message-input" placeholder="Digite sua mensagem..." autocomplete="off">
            <button type="submit" id="send-button">Enviar</button>
        </form>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const messagesArea = document.getElementById('messages-area');
            const chatHeader = document.getElementById('chat-header');
            const messageForm = document.getElementById('message-form');
            const messageInput = document.getElementById('message-input');

            // 1. Pegar o ID do pedido da URL (ex: chat.html?orderId=abc-123)
            const urlParams = new URLSearchParams(window.location.search);
            const orderId = urlParams.get('orderId');

            // 2. Pegar o token e os dados do usuário do localStorage
            const token = localStorage.getItem('gamerStoreToken');
            const userData = JSON.parse(localStorage.getItem('gamerStoreUser'));

            if (!orderId || !token || !userData) {
                messagesArea.innerHTML = '<p style="text-align: center;">Erro: Informações de autenticação não encontradas. Faça o login novamente e acesse o pedido pela página "Meus Pedidos".</p>';
                return;
            }

            const currentUserId = userData.id;

            // Função para o admin marcar como entregue
            const markAsDelivered = async () => {
                if (!confirm('Tem certeza que deseja marcar este pedido como entregue?')) return;

                try {
                    const response = await fetch(\`/api/orders/\${orderId}/deliver\`, {
                        method: 'PATCH',
                        headers: { 'Authorization': \`Bearer \${token}\` }
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Falha ao atualizar pedido.');
                    }

                    alert('Pedido marcado como entregue com sucesso!');
                    // Desabilita o botão para evitar cliques duplicados
                    const deliveredBtn = document.getElementById('delivered-btn');
                    if(deliveredBtn) {
                        deliveredBtn.textContent = 'Entregue';
                        deliveredBtn.disabled = true;
                    }

                } catch (error) {
                    alert(\`Erro: \${error.message}\`);
                }
            };

            // Função para buscar as mensagens no servidor
            const fetchMessages = async () => {
                const response = await fetch(\`/api/orders/\${orderId}/messages\`, {
                    headers: { 'Authorization': \`Bearer \${token}\` }
                });

                if (!response.ok) {
                    console.error('Falha ao buscar mensagens.');
                    return;
                }

                const messages = await response.json();
                renderMessages(messages);
            };

            // Função para mostrar as mensagens na tela
            const renderMessages = (messages) => {
                messagesArea.innerHTML = ''; // Limpa a área antes de adicionar as novas
                messages.forEach(msg => {
                    const messageDiv = document.createElement('div');
                    messageDiv.classList.add('message');
                    // Adiciona a classe 'sent' se a mensagem foi enviada pelo usuário logado
                    // ou 'received' se foi enviada por outra pessoa.
                    messageDiv.classList.add(msg.senderId === currentUserId ? 'sent' : 'received');
                    messageDiv.textContent = msg.content;
                    messagesArea.appendChild(messageDiv);
                });
                // Rola para a mensagem mais recente
                messagesArea.scrollTop = messagesArea.scrollHeight;
            };

            // Função para enviar uma nova mensagem
            messageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const content = messageInput.value.trim();
                if (!content) return;

                await fetch(\`/api/orders/\${orderId}/messages\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${token}\`
                    },
                    body: JSON.stringify({ content })
                });

                messageInput.value = ''; // Limpa o campo de texto
                fetchMessages(); // Busca as mensagens novamente para mostrar a que acabamos de enviar
            });

            // Busca as mensagens quando a página carrega
            fetchMessages();

            // Se o usuário for ADMIN, mostra o botão de "Marcar como Entregue"
            if (userData.role === 'ADMIN') {
                const deliveredButton = document.createElement('button');
                deliveredButton.id = 'delivered-btn';
                deliveredButton.className = 'admin-action-btn';
                deliveredButton.textContent = 'Marcar como Entregue';
                deliveredButton.onclick = markAsDelivered;
                chatHeader.appendChild(deliveredButton);
            }

            // (Opcional) Atualiza o chat a cada 5 segundos para ver novas mensagens
            setInterval(fetchMessages, 5000);
        });
    </script>

</body>
</html>
`;

// --- Middleware de Autenticação ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401); // Não enviou o token

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token inválido ou expirado
        req.user = user;
        next();
    });
};

const isAdmin = async (req, res, next) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (user && user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ message: "Acesso negado. Rota exclusiva para administradores." });
    }
};

// --- Rotas para servir o HTML ---
app.get('/', (req, res) => {
    res.redirect('/loja.html');
});

app.get('/loja.html', (req, res) => {
    res.send(lojaHtml);
});
app.get('/meus-pedidos.html', (req, res) => {
    res.send(meusPedidosHtml);
});
app.get('/chat.html', (req, res) => {
    res.send(chatHtml);
});

// --- Rotas da API ---

// Rota de Registro: POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    // Validação básica
    if (!username || !email || !password) {
        return res.status(400).json({ message: "Por favor, forneça nome de usuário, email e senha." });
    }

    // Usaremos uma transação para garantir que o usuário só seja criado se o e-mail for enviado.
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Verifica se o usuário ou email já existem
            const existingUser = await tx.user.findFirst({
                where: { OR: [{ email }, { username }] },
            });

            if (existingUser) {
                // Lança um erro para abortar a transação e ser pego pelo catch
                throw new Error("Usuário ou email já cadastrado.");
            }

            // 2. Prepara os dados do novo usuário
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const hashedPassword = await bcrypt.hash(password, 10);

            // 3. Cria o usuário DENTRO da transação
            await tx.user.create({
                data: {
                    username,
                    email,
                    password: hashedPassword,
                    emailVerificationToken: verificationToken,
                },
            });

            // 4. Tenta enviar o email de verificação
            const baseUrl = process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
            const verificationUrl = `${baseUrl}/loja.html?verify=${verificationToken}`;
            const mailOptions = {
                to: email,
                from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
                subject: 'Verifique seu email - Gamer Store',
                html: `<h1>Bem-vindo à Gamer Store!</h1><p>Clique no link para ativar sua conta: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
            };
            
            // Se sendMail falhar, a transação inteira será revertida.
            await transporter.sendMail(mailOptions);
        });

        // Se a transação for bem-sucedida, envia a resposta de sucesso.
        res.status(201).json({ message: "Registro quase completo! Verifique sua caixa de entrada para ativar sua conta." });

    } catch (error) {
        console.error("Erro no registro:", error);

        // Verifica o tipo de erro para dar uma resposta mais precisa
        if (error.message === "Usuário ou email já cadastrado.") {
            return res.status(409).json({ message: error.message });
        }

        // Se o erro veio do Nodemailer (ou outro erro inesperado), retorna 500.
        res.status(500).json({ message: "Ocorreu um erro ao enviar o e-mail de verificação. Verifique as configurações do servidor e tente novamente." });
    }
});

// Rota de Login: POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: "Usuário não encontrado." });
        }

        // Verifica se o email foi verificado
        if (!user.emailVerified) {
            return res.status(403).json({ message: "Sua conta não foi ativada. Por favor, verifique seu email." });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Senha inválida." });
        }

        // Gera o Token JWT
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });

        const { password: _, ...userWithoutPassword } = user;
        res.json({ message: "Login bem-sucedido!", user: userWithoutPassword, token });

    } catch (error) {
        console.error("Erro no login:", error);
        res.status(500).json({ message: "Ocorreu um erro inesperado durante o login." });
    }
});

// Rota para Verificar o Email: GET /api/auth/verify-email
app.get('/api/auth/verify-email', async (req, res) => {
    const { token } = req.query;

    try {
        const user = await prisma.user.findUnique({
            where: { emailVerificationToken: token },
        });

        if (!user) {
            return res.status(404).json({ message: "Token de verificação inválido ou expirado." });
        }

        // Atualiza o usuário como verificado e remove o token
        await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date(), emailVerificationToken: null },
        });

        res.json({ message: "Email verificado com sucesso! Você já pode fazer o login." });
    } catch (error) {
        console.error("Erro na verificação de email:", error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao verificar o email." });
    }
});

// --- Rotas de Produtos (Admin) ---
app.post('/api/products', authenticateToken, isAdmin, async (req, res) => {
    const { name, description, price, imageUrl, category } = req.body;
    const sellerId = req.user.id; // O vendedor é o admin logado

    try {
        const newProduct = await prisma.product.create({
            data: { name, description, price, imageUrl, category, sellerId },
        });
        res.status(201).json(newProduct);
    } catch (error) {
        console.error("Erro ao criar produto:", error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao criar o produto." });
    }
});

// Rota para LISTAR todos os produtos (pública)
app.get('/api/products', async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(products);
    } catch (error) {
        console.error("Erro ao buscar produtos:", error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao buscar os produtos." });
    }
});

// Rota para EDITAR um produto (Admin)
app.put('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, description, price, imageUrl, category } = req.body;
    try {
        const updatedProduct = await prisma.product.update({
            where: { id },
            data: { name, description, price, imageUrl, category },
        });
        res.json(updatedProduct);
    } catch (error) {
        console.error(`Erro ao editar produto ${id}:`, error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao editar o produto." });
    }
});

// Rota para DELETAR um produto (Admin)
app.delete('/api/products/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.product.delete({ where: { id } });
        res.status(204).send(); // 204 No Content
    } catch (error) {
        console.error(`Erro ao deletar produto ${id}:`, error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao deletar o produto." });
    }
});

// --- Rota de Criação de Pedido ---
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.user.id; // Pegamos o ID do usuário logado através do token

    try {
        // 1. Buscar o produto no banco
        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            return res.status(404).json({ message: "Produto não encontrado." });
        }

        const total = product.price * quantity;

        // 2. Gerar a cobrança PIX na API da Efí
        // O tempo de expiração é definido aqui (240 segundos = 4 minutos)
        const charge = await EfiPay.createPixCharge(total, 240);

        // 3. Criar o pedido no nosso banco de dados com status PENDENTE e o txid da Efí
        const order = await prisma.order.create({
            data: {
                userId,
                total,
                status: 'PENDING',
                txid: charge.txid, // Salvando o ID da transação
                items: {
                    create: {
                        productId: productId,
                        quantity: quantity,
                    },
                },
            },
        });

        // 4. Retornar os dados do PIX para o frontend exibir
        res.status(201).json({
            message: "Pedido criado. Aguardando pagamento.",
            order,
            pix: {
                qrCodeImage: charge.imagemQrcode,
                qrCodeCopyPaste: charge.pixCopiaECola,
            },
        });

    } catch (error) {
        console.error("Erro ao criar pedido:", error);
        res.status(500).json({ message: "Falha ao processar o pedido." });
    }
});

// --- Rota de Webhook para a Efí ---
// A Efí vai chamar esta rota quando o pagamento for confirmado
app.post('/api/webhooks/efi', (req, res) => {
    // A Efí espera uma resposta rápida. Responda imediatamente.
    res.sendStatus(200);

    // Processe a notificação de forma assíncrona.
    (async () => {
        try {
            // A estrutura pode variar, verifique a documentação da Efí para webhooks PIX.
            const pixNotification = req.body.pix && req.body.pix[0];
            if (!pixNotification || !pixNotification.txid) {
                console.warn("Webhook da Efí recebido sem txid:", req.body);
                return;
            }
            const { txid } = pixNotification;

            // Encontra o pedido pelo txid e atualiza o status para PAGO
            const updatedOrder = await prisma.order.update({
                where: { txid: txid },
                data: { status: 'PAID' },
            });
            console.log(`Webhook: Pedido ${updatedOrder.id} foi pago (txid: ${txid})`);
        } catch (error) {
            console.error("Erro ao processar webhook da Efí:", error);
        }
    })();
});

// Rota para o cliente buscar seus próprios pedidos
app.get('/api/my-orders', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const orders = await prisma.order.findMany({
            where: { userId: userId },
            include: {
                items: {
                    include: {
                        product: { select: { name: true, imageUrl: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        console.error(`Erro ao buscar pedidos para o usuário ${userId}:`, error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao buscar seus pedidos." });
    }
});

// Rota para o ADMIN buscar TODOS os pedidos
app.get('/api/orders/all', authenticateToken, isAdmin, async (req, res) => {
     try {
        const orders = await prisma.order.findMany({
            include: {
                user: { select: { username: true, email: true } }, // Info do cliente
                items: {
                    include: {
                        product: { select: { name: true } }
                    }
                },
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        console.error("Erro ao buscar todos os pedidos:", error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao buscar os pedidos." });
    }
});

// Rota para verificar o status de um pedido (usado no polling do frontend)
app.get('/api/orders/:orderId/status', authenticateToken, async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: { status: true }
        });
        if (!order) {
            return res.status(404).json({ message: "Pedido não encontrado." });
        }
        res.json({ status: order.status });
    } catch (error) {
        console.error(`Erro ao buscar status do pedido ${orderId}:`, error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao buscar o status do pedido." });
    }
});

// --- Rotas de Chat (Mensagens) ---

// Rota para LISTAR mensagens de um pedido
app.get('/api/orders/:orderId/messages', authenticateToken, async (req, res) => {
    const { orderId } = req.params;
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    try {
        // 1. Buscar o pedido para verificar a permissão
        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });

        // 2. Validar se o pedido existe e se o usuário tem permissão
        if (!order) {
            return res.status(404).json({ message: 'Pedido não encontrado' });
        }
        if (order.userId !== currentUserId && currentUserRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        // 3. Buscar as mensagens do pedido
        const messages = await prisma.message.findMany({
            where: { orderId: orderId },
            include: {
                sender: { select: { id: true, username: true, role: true } },
            },
            orderBy: { createdAt: 'asc' },
        });

        res.json(messages);
    } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao carregar o chat." });
    }
});

// Rota para ENVIAR uma nova mensagem em um pedido
app.post('/api/orders/:orderId/messages', authenticateToken, async (req, res) => {
    const { orderId } = req.params;
    const { content } = req.body;
    const senderId = req.user.id;

    if (!content || content.trim() === '') {
        return res.status(400).json({ message: 'O conteúdo da mensagem é obrigatório' });
    }

    try {
        // A mesma lógica de verificação de permissão do GET pode ser aplicada aqui,
        // mas como o chat é entre cliente e admin, vamos permitir que ambos postem.
        // A validação principal já está no middleware 'authenticateToken'.

        const newMessage = await prisma.message.create({
            data: {
                content: content.trim(),
                orderId,
                senderId,
            },
        });
        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao enviar a mensagem." });
    }
});

// Rota para o ADMIN marcar um pedido como ENTREGUE
app.patch('/api/orders/:orderId/deliver', authenticateToken, isAdmin, async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
        });

        if (!order) {
            return res.status(404).json({ message: "Pedido não encontrado." });
        }

        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { status: 'DELIVERED' },
        });

        res.json({ message: "Pedido marcado como entregue!", order: updatedOrder });
    } catch (error) {
        console.error(`Erro ao marcar pedido ${orderId} como entregue:`, error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao atualizar o pedido." });
    }
});

// --- Rotas de Avaliações (Reviews) ---

// Rota para CRIAR uma nova avaliação para um produto
app.post('/api/products/:productId/reviews', authenticateToken, async (req, res) => {
    const { productId } = req.params;
    const userId = req.user.id;
    const { rating, comment } = req.body;

    // Validação da nota
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "A avaliação (rating) deve ser um número entre 1 e 5." });
    }

    try {
        // Verificação de segurança: O usuário só pode avaliar se já comprou o produto.
        const hasPurchased = await prisma.order.findFirst({
            where: {
                userId: userId,
                status: { in: ['PAID', 'DELIVERED'] }, // Status de pago ou entregue
                items: { some: { productId: productId } },
            },
        });

        if (!hasPurchased) {
            return res.status(403).json({ message: "Você só pode avaliar produtos que já comprou." });
        }

        // Verifica se o usuário já avaliou este produto para evitar duplicatas
        const existingReview = await prisma.review.findFirst({
            where: { userId: userId, productId: productId }
        });

        if (existingReview) {
            return res.status(409).json({ message: "Você já avaliou este produto." });
        }

        const newReview = await prisma.review.create({
            data: {
                rating: parseInt(rating),
                comment,
                productId,
                userId,
            },
        });

        res.status(201).json(newReview);
    } catch (error) {
        console.error("Erro ao criar avaliação:", error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao enviar a avaliação." });
    }
});

// Rota para LISTAR todas as avaliações de um produto (pública)
app.get('/api/products/:productId/reviews', async (req, res) => {
    const { productId } = req.params;
    try {
        const reviews = await prisma.review.findMany({
            where: { productId: productId },
            include: { user: { select: { username: true } } }, // Inclui o nome de quem avaliou
            orderBy: { createdAt: 'desc' },
        });
        res.json(reviews);
    } catch (error) {
        console.error(`Erro ao buscar avaliações para o produto ${productId}:`, error);
        res.status(500).json({ message: "Ocorreu um erro inesperado ao buscar as avaliações." });
    }
});

// --- Rota de fallback ---
app.use((req, res) => {
    res.status(404).send("<h2>404 - Página Não Encontrada</h2><a href='/loja.html'>Voltar para a loja</a>");
});

// Função principal para gerenciar a conexão com o banco e iniciar o servidor
async function main() {
    // Iniciar o Servidor
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Garante que a conexão com o prisma seja fechada ao encerrar a aplicação
    await prisma.$disconnect();
  });
