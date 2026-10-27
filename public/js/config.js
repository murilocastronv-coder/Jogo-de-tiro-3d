/* Zona Hostil — configuração da página de venda.
   Edite preços e links de pagamento aqui. Deixe `checkout` vazio para mostrar "Em breve".
   Um link de pagamento do Mercado Pago, Stripe, Hotmart ou Kiwify funciona em `checkout`. */
window.ZH_SITE = {
  editions: [
    {
      id: 'recruta', name: 'RECRUTA', price: 'GRÁTIS', note: 'para sempre', checkout: 'jogar.html', cta: 'JOGAR AGORA',
      perks: ['Todos os modos e o mapa Pátio 07', 'Todas as armas e operadores', 'Multiplayer online e salas privadas', 'Treino offline contra bots'],
    },
    {
      id: 'veterano', name: 'VETERANO', price: 'R$ 14,90', note: 'pagamento único', checkout: '', cta: 'GARANTIR NA PRÉ-VENDA', featured: true,
      perks: ['Tudo do Recruta', 'Pacote de camuflagens Deserto e Noite*', 'Emblema dourado no placar*', 'Apoio direto ao desenvolvimento'],
    },
    {
      id: 'fundador', name: 'FUNDADOR', price: 'R$ 39,90', note: 'pagamento único', checkout: '', cta: 'SER FUNDADOR',
      perks: ['Tudo do Veterano', 'Seu codinome nos créditos do jogo*', 'Acesso antecipado aos próximos mapas*', 'Voto nas próximas armas'],
    },
  ],
  footnote: '* Itens cosméticos da pré-venda, liberados na próxima atualização. Nada que dê vantagem em combate.',
};
