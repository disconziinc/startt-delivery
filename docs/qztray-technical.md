# QZ Tray no Startt Delivery

## Objetivo

Imprimir pedidos automaticamente em impressoras térmicas 80mm no Windows 10 usando QZ Tray.

## Variáveis opcionais

- `VITE_QZ_CERTIFICATE_URL`: endpoint público que retorna o certificado público usado pelo QZ Tray.
- `VITE_QZ_SIGN_URL`: endpoint server-side que recebe `{ "request": "..." }` e retorna `{ "signature": "..." }`.

Em desenvolvimento, se essas variáveis não existirem, o frontend usa modo demo/local sem chave privada. O QZ Tray pode pedir confirmação manual.

## Como testar localmente

1. Instale o QZ Tray em `https://qz.io/download/`.
2. Abra o QZ Tray no Windows e deixe o ícone ativo perto do relógio.
3. Rode `npm install`.
4. Rode `npm run dev`.
5. Entre em `/{slug}/admin/impressao`.
6. Clique em `Conectar QZ Tray`.
7. Clique em `Buscar impressoras`.
8. Selecione a impressora térmica 80mm.
9. Clique em `Salvar impressora`.
10. Clique em `Imprimir teste QZ`.
11. Ative `Impressão automática de pedidos`.
12. Faça um pedido no cardápio público e confira se o pedido imprime uma única vez.

## Segurança

Não coloque private key no frontend. Para produção, implemente assinatura em endpoint server-side e informe a URL em `VITE_QZ_SIGN_URL`. O frontend já está preparado para buscar certificado e assinatura por HTTP.

## QA antes de produção

- QZ Tray instalado e aberto no Windows 10.
- Impressora aparece em `Buscar impressoras`.
- Teste QZ imprime com corte correto.
- Pedido novo imprime automaticamente quando a tela admin está aberta.
- Pedido fica marcado como impresso e não entra em loop.
- Botão `Reimprimir` funciona manualmente.
- Sem QZ Tray instalado, a tela mostra download e erro amigável.
- Build passa com `npm run build`.
- Migração `20260525160000_qz_tray_printing.sql` aplicada no Supabase.
- Realtime do Supabase habilitado para melhor chegada de pedidos, com polling de fallback no painel.

## Tutorial para lojista

Arquivo visual pronto para exportar PDF:

`public/docs/qztray-startt.html`
