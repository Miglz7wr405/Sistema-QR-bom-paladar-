# Bom Paladar — Pedidos por QR Code

Cada mesa do Bom Paladar tem um QR Code próprio. O cliente lê o QR com o telemóvel, vê o cardápio, escolhe e envia o pedido; o pedido chega na hora ao painel do administrador, já com a mesa. Não há app, conta nem pagamento online: o cliente paga no fim, ao atendente ou no caixa.

- **Cliente** (público): `/m/<token>` — cardápio, carrinho, envio e "Os meus pedidos".
- **Administrador** (com senha): `/admin` — mesas em tempo real, detalhe e estados, histórico, cardápio, mesas e QR Codes.

Vite + React + TypeScript + React Router + Tailwind CSS, com Supabase (Postgres, Auth, Realtime, Storage) e publicação na Vercel. A especificação completa está em [`docs/especificacao.pdf`](docs/especificacao.pdf); o cardápio real em [`dados/CARDAPIO.md`](dados/CARDAPIO.md).

## 1. Supabase

O projeto **Bom Paladar QR** já foi criado (região `eu-central-1`, ref `zvxownsxaaznyqdqzhgc`) e já tem as três migrações aplicadas. Para um projeto novo:

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Corra as migrações por ordem, no **SQL Editor** (ou com `supabase db push`):
   - `supabase/migrations/20261019000001_esquema.sql` — tabelas, regras de acesso (RLS), funções `get_table_info`, `get_table_orders` e `create_order`, tempo real;
   - `supabase/migrations/20261019000002_seed.sql` — 10 mesas e o cardápio real (17 categorias, 125 pratos);
   - `supabase/migrations/20261019000003_fotos.sql` — bucket `pratos` para as fotos.
3. **Desative o registo público**: Authentication → Sign In / Providers → desligue **Allow new users to sign up**.

O seed é gerado a partir de `dados/cardapio.json` com `npm run seed`. Itens sem preço no cardápio impresso (a linha "Shots" dos cocktails) ficam de fora; os shots com preço estão em "Espirituosas (Gin) / Shots".

## 2. Administrador

O painel abre só com a **palavra-passe** (não pede email). Por trás há uma única conta no Supabase Auth, `admin@bompaladar.co.mz`, já criada no projeto Bom Paladar QR com o papel de administrador. A palavra-passe foi combinada com o restaurante e **não está escrita no código nem no Git**.

**Mudar a palavra-passe:** Supabase → Authentication → Users → `admin@bompaladar.co.mz` → **Reset password** não serve (o email não recebe mensagens); use o SQL Editor:

```sql
update auth.users
set encrypted_password = extensions.crypt('NovaPalavraPasse', extensions.gen_salt('bf'))
where email = 'admin@bompaladar.co.mz';
```

**Num projeto novo:** Authentication → Users → **Add user** com esse email (marque **Auto Confirm User**) e depois dê-lhe o papel de administrador:

```sql
update auth.users
set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
where email = 'admin@bompaladar.co.mz';
```

Para usar outro email, defina `VITE_ADMIN_EMAIL`. Só contas com `app_metadata.role = 'admin'` veem dados: mesmo que alguém crie uma conta, as regras da base não lhe dão acesso a nada.

## 3. Variáveis de ambiente

Copie `.env.example` para `.env`:

| Variável | Onde encontrar |
| --- | --- |
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → chave **publishable** (ou a `anon` legacy) |
| `VITE_SITE_URL` | Endereço público do site, sem barra no fim (é o que fica nos QR Codes) |
| `VITE_ADMIN_EMAIL` | Opcional. Email da conta de administrador (por omissão `admin@bompaladar.co.mz`) |

A chave **service role nunca** entra no projeto. O `.env` não vai para o Git.

## 4. Correr localmente

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes do carrinho e da formatação
npm run build      # verificação de tipos + build de produção em dist/
```

Abra `http://localhost:5173/admin` para o painel. Para o link de uma mesa, vá a **Gerir mesas → Ver QR** (ou `select numero, qr_token from restaurant_tables` no Supabase) e abra `/m/<qr_token>`.

### Testes da base de dados

`supabase/tests/create_order.sql` testa a lógica crítica: token inválido, mesa desativada, preço adulterado pelo cliente, prato esgotado, opções, isolamento entre mesas, sessão nova depois de fechar a mesa, limite de 5 pedidos por minuto e o que o visitante anónimo consegue ler. Cole-o no **SQL Editor** e corra: tudo é desfeito no fim, e a mensagem **`TESTES OK: 11 verificações`** quer dizer que passou (qualquer outra mensagem diz o que falhou).

## 5. Publicar na Vercel

**Não é preciso configurar variáveis:** o endereço e a chave pública do projeto Bom Paladar QR já estão no código, e os QR Codes usam o endereço onde o painel está aberto. Basta importar o repositório e carregar em **Deploy**. As variáveis abaixo só servem para usar outro projeto Supabase ou fixar o domínio dos QR.

1. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório. A Vercel deteta o Vite (build `npm run build`, saída `dist`).
2. Em **Environment Variables**, defina `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SITE_URL` (o domínio final, ex.: `https://pedidos.bompaladar.co.mz`).
3. **Deploy**. O `vercel.json` manda todas as rotas para o `index.html`, para o React Router funcionar.
4. No Supabase → Authentication → URL Configuration, ponha o domínio da Vercel em **Site URL**.
5. No painel, **QR Codes → ⬇ Descarregar PDF**: todas as mesas em A4, 4 cartões A6 por folha com linhas de corte (ou **⬇ Imagem (PNG)** de uma só mesa, para a gráfica ou WhatsApp). Os QR apontam sempre para `https://sistema-qr-bom-paladar.vercel.app` (ou para `VITE_SITE_URL`, se definida). Se mudar o domínio, volte a imprimir (o QR guarda o endereço).

**Primeiro teste depois de publicar:** abra o link de duas mesas em dois telemóveis, faça um pedido em cada um e confirme que cada pedido cai só na mesa certa.

## Como funciona

- **Mesa pelo token**: o QR tem um código secreto (`/m/k7x9q2…`), não o número da mesa. A mesa de um pedido vem sempre do token, nunca de algo que o cliente escreve.
- **Sessões**: o primeiro pedido abre a sessão da mesa; os seguintes juntam-se a ela. **Fechar mesa** fecha a sessão: o histórico fica e o mesmo QR abre uma sessão nova e vazia.
- **Segurança**: o visitante anónimo só lê `categories` e `menu_items`. Tudo o resto passa por três funções `SECURITY DEFINER` (`get_table_info`, `get_table_orders`, `create_order`) que validam o token. O Supabase avisa que estas funções são executáveis por anónimos: é intencional, é assim que o cliente pede sem conta. Também estão abertas a contas com sessão iniciada, para o administrador conseguir testar o QR no mesmo telemóvel.
- **Preços**: `create_order` lê os preços da base (ignora qualquer preço enviado), valida pratos esgotados e opções, e copia nome, opção e preço para `order_items` — o histórico não muda quando o cardápio muda.
- **Cardápio igual ao impresso**: a página da mesa replica os cartões do restaurante (buffets, Pasta/Lasanha, Cocktail, Carta de Vinhos e a folha do bar), com um botão **Pedir já** em cada item. O estilo escolhe-se pelo nome da categoria (`src/components/cliente/CardapioImpresso.tsx`); categorias novas aparecem no estilo da folha do bar. "Pedir já" junta o item ao pedido e abre logo **O meu pedido** (antes pergunta a opção ou o número de pessoas, se for preciso). Lá dentro, **Adicionar bebida** fecha o pedido e leva o cliente aos Cocktails. As notas ("sem cebola") escrevem-se no carrinho, e o botão final é **Pedir agora**.
- **Opções**: linhas do cardápio com vários produtos ao mesmo preço (ex.: "Super Bock ou Castle Lite", gins, whiskies) têm `opcoes`; o cliente escolhe uma e ela aparece no pedido.
- **Buffets**: pedem-se por pessoa (a quantidade é o número de pessoas) e mostram o que incluem.
- **Tempo real**: o painel subscreve `orders` com Supabase Realtime (só o administrador recebe eventos). Pedido novo: sininho, leitura em voz (ver **Voz dos pedidos**), aviso no canto que fica no ecrã e a mesa fica destacada. "Os meus pedidos" do cliente atualiza por polling a cada 10 s.
- **Pedidos que desaparecem**: no painel, cada pedido por atender tem **✓ Atendido** (e Cancelar); ao carregar, sai da lista "Por atender". No detalhe da mesa, os atendidos ficam à vista 20 minutos e depois desaparecem. No telemóvel do cliente, "Os meus pedidos" mostra só os pedidos dos últimos 20 minutos (`get_table_orders`). Nada se apaga: tudo fica no **Histórico**. Os 20 minutos estão em `JANELA_MINUTOS` (`src/lib/format.ts`) e na migração `20261019000004_pedidos_recentes.sql`.
- **Anti-spam**: no máximo 5 pedidos por mesa por minuto (verificado na base) e o botão de enviar ignora o duplo clique.
- **Horas**: guardadas em UTC e mostradas em `Africa/Maputo`, formato 24h.

## Voz dos pedidos

Cada pedido novo no painel toca um sininho e a seguir é lido em voz alta, na voz **Dinis** (português de Portugal) da ElevenLabs: *"Mesa 1 pediu duas Massa Bolonhesa e Mojito."*

- **Ligar**: liga-se sozinho ao entrar no painel; se o navegador ainda não deixar (só deixa tocar som depois de um toque), liga-se no primeiro toque em qualquer sítio do ecrã. Deixe o painel aberto, com o ecrã ligado e o volume alto. O botão passa a **🔔🗣 Som e voz ativos**; um toque muda para **🔔 Só sininho**.
- **Ordem**: com vários pedidos ao mesmo tempo, lê um de cada vez, pela ordem em que foram feitos. Nunca fala dois ao mesmo tempo.
- **Aviso no ecrã**: cada pedido fica num cartão no canto (🔊 no que está a ser lido, notas a amarelo). Sai quando o pedido é marcado **✓ Atendido** (ou Cancelado), ou com ✕. **🔊 Ler de novo** no cartão do pedido repete a leitura.
- **Notas**: são texto livre do cliente e não se podem gravar antes na voz Dinis, por isso são lidas a seguir pela voz portuguesa do próprio aparelho: *"Nota para Mojito: sem gelo."* Se o aparelho não tiver voz portuguesa, a voz diz *"Com nota, veja no ecrã"*. A nota aparece sempre destacada no ecrã.
- **O que não tem voz gravada** (prato ou mesa criados depois ou quantidade acima de 20) é dito como *"…e mais itens, veja no ecrã"*, e uma mesa sem gravação como *"Novo pedido"*. O pedido aparece sempre completo no ecrã.

Como funciona: não há chave de API no site. A voz foi gravada uma vez com a conta ElevenLabs, em pedaços (`public/voz/*.mp3`, índice em `public/voz/indice.json`), e o painel junta-os (`src/lib/frase.ts` monta a frase, `src/lib/anuncios.ts` toca a fila). O sininho (`public/sons/sino.mp3`) é sintetizado por `scripts/voz/sino.py`; se não carregar, toca um bip.

**Gravar os pedaços em falta** (quando os créditos da ElevenLabs renovarem, ou depois de juntar pratos ou mesas):
1. Atualize `scripts/voz/pedacos.json.in` com os nomes e opções da base (e `MESAS` em `pedacos.py`, se houver mais mesas).
2. `python3 -I scripts/voz/pedacos.py --faltam 9000` → `scripts/voz/lotes/faltam.txt` (o que falta, os mais pedidos primeiro; baixe o número para caber nos créditos: ~0,35 créditos por caráter com o modelo Flash v2.5).
3. Peça ao Claude para gravar `faltam.txt` na ElevenLabs (voz Dinis, `eleven_flash_v2_5`, 1 geração) e guardar o áudio como `<pasta>/faltam.mp3`.
4. `python3 -I scripts/voz/cortar.py <pasta>` → corta pelos silêncios e atualiza o índice (pára se o número de trechos não bater com o de pedaços). Publique.

## Fora desta versão

Pagamento online (proibido: sem M-Pesa, e-Mola, cartões ou gateways), contas de empregado/cozinha, impressão de talão e relatórios.

## Por confirmar com o restaurante

Ver a lista em [`dados/CARDAPIO.md`](dados/CARDAPIO.md#por-confirmar-com-o-restaurante) (nomes de vinhos, cerveja de pressão em ml/cl, shots sem preço, menu de pizzas que ainda falta).
