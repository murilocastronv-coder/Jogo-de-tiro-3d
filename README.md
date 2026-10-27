# Zona Hostil

FPS tático em 3D que roda direto no navegador, no celular ou no PC. Tem página inicial de venda, multiplayer online com servidor próprio, salas privadas com código, bots e treino offline.

## O que tem

- **Página inicial** (`public/index.html`): cena 3D ao vivo, modos, arsenal com os números reais das armas, operadores, edições à venda, ranking ao vivo e dúvidas.
- **Jogo** (`public/jogar.html`):
  - 5 armas: Fuzil M7, Vespa 9, K-90 com luneta, Escopeta R12 e Pistola P9.
  - Granada, faca, agachar, pular, correr e troca de arma.
  - Drone de reconhecimento ao fazer 3 baixas seguidas.
  - 5 operadores com versões masculina e feminina, esqueleto e animação de passos, mira, recarga e queda.
  - Soldados e armas são gerados em código, sem arquivos de modelo.
  - HUD com minimapa, placar, kill feed e indicador de dano.
  - Ajustes de sensibilidade, campo de visão, gráficos, volume, tamanho dos botões, inverter eixo e assistência de mira.
- **Modos**:
  - Mata-mata em equipe (40 baixas).
  - Todos contra todos (25 baixas).
  - Sobrevivência cooperativa em ondas.
- **Multiplayer** (`server.js` + `public/js/sim.js`):
  - Partida rápida ou sala privada com código de 4 letras.
  - Bots completam as partidas.
  - O servidor confere movimento, cadência de tiro, munição, recarga, acertos (com compensação de latência), granadas e faca.
- **Treino offline**: a mesma simulação do servidor roda no navegador, então dá para jogar sem internet.

## Rodar no seu computador

Precisa só do Node.js 18 ou mais novo. Não há dependências para instalar.

```bash
npm start
```

Abra http://localhost:3000. Para jogar com alguém na mesma rede Wi-Fi, use o IP do seu computador, por exemplo `http://192.168.0.10:3000`.

Para rodar o teste automático do servidor:

```bash
npm test
```

## Publicar na internet (Render, plano grátis)

1. Em https://dashboard.render.com, clique em **New → Web Service** e escolha este repositório.
2. Runtime **Node**, Build Command `echo ok`, Start Command `node server.js`.
3. Pronto: o link `https://zona-hostil.onrender.com` (ou parecido) abre a página inicial, e o jogo fica em `/jogar.html`.

O arquivo `render.yaml` já tem essa configuração. No plano grátis, o servidor dorme depois de 15 minutos sem acesso. A primeira visita depois disso demora cerca de 1 minuto para acordar.

## Vender as edições

Edite `public/js/config.js`. Em cada edição, troque o preço e cole em `checkout` o seu link de pagamento (Mercado Pago, Stripe, Hotmart, Kiwify…). Com `checkout` vazio, o botão mostra "Em breve".

## Estrutura

```
server.js            servidor HTTP + WebSocket (sem dependências)
public/index.html    página inicial de venda
public/jogar.html    o jogo
public/js/shared.js  mapa, armas, classes, colisão, raios e navegação (cliente e servidor)
public/js/sim.js     simulação autoritativa de uma sala: regras, bots, ondas, placar
public/js/assets.js  texturas, cenário, soldados com esqueleto e armas 3D
public/js/game.js    cliente: controles, HUD, menus, rede, efeitos
public/js/site.js    scripts da página inicial
public/vendor/       three.js r128 (licença MIT)
test/smoke.js        teste automático do multiplayer
```

## Limitações conhecidas

- Um mapa (Pátio 07).
- O ranking fica na memória do servidor e zera quando ele reinicia.
- Os itens cosméticos das edições pagas ainda não estão no jogo.
- Não há contas de usuário nem login. O codinome fica salvo no aparelho.
