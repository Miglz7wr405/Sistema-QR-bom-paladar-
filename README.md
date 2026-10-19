# Bom Paladar — Pedidos por QR Code

Cada mesa do Bom Paladar tem um QR Code próprio. O cliente lê o QR com o telemóvel, vê o cardápio, escolhe e envia o pedido; o pedido chega na hora ao painel do administrador, já com a mesa. Não há app, conta nem pagamento online: o cliente paga no fim, ao empregado ou no caixa.

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

## 2. Criar o administrador

O administrador é criado à mão:

1. Authentication → Users → **Add user** → **Create new user**, com email e senha (marque **Auto Confirm User**).
2. No **SQL Editor**, dê-lhe o papel de administrador (troque o email):

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
   where email = 'admin@exemplo.com';
   ```

3. Se já tinha a sessão aberta no painel, saia e entre de novo.

Só contas com `app_metadata.role = 'admin'` veem dados: mesmo que alguém crie uma conta, as regras da base não lhe dão acesso a nada.

## 3. Variáveis de ambiente

Copie `.env.example` para `.env`:

| Variável | Onde encontrar |
| --- | --- |
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → chave **publishable** (ou a `anon` legacy) |
| `VITE_SITE_URL` | Endereço público do site, sem barra no fim (é o que fica nos QR Codes) |

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

1. Em [vercel.com](https://vercel.com) → **Add New → Project** → importe o repositório. A Vercel deteta o Vite (build `npm run build`, saída `dist`).
2. Em **Environment Variables**, defina `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_SITE_URL` (o domínio final, ex.: `https://pedidos.bompaladar.co.mz`).
3. **Deploy**. O `vercel.json` manda todas as rotas para o `index.html`, para o React Router funcionar.
4. No Supabase → Authentication → URL Configuration, ponha o domínio da Vercel em **Site URL**.
5. No painel, **QR Codes → Imprimir**. Se mudar o domínio, volte a imprimir (o QR guarda o endereço).

**Primeiro teste depois de publicar:** abra o link de duas mesas em dois telemóveis, faça um pedido em cada um e confirme que cada pedido cai só na mesa certa.

## Como funciona

- **Mesa pelo token**: o QR tem um código secreto (`/m/k7x9q2…`), não o número da mesa. A mesa de um pedido vem sempre do token, nunca de algo que o cliente escreve.
- **Sessões**: o primeiro pedido abre a sessão da mesa; os seguintes juntam-se a ela. **Fechar mesa** fecha a sessão: o histórico fica e o mesmo QR abre uma sessão nova e vazia.
- **Segurança**: o visitante anónimo só lê `categories` e `menu_items`. Tudo o resto passa por três funções `SECURITY DEFINER` (`get_table_info`, `get_table_orders`, `create_order`) que validam o token. O Supabase avisa que estas funções são executáveis por anónimos: é intencional, é assim que o cliente pede sem conta. Também estão abertas a contas com sessão iniciada, para o administrador conseguir testar o QR no mesmo telemóvel.
- **Preços**: `create_order` lê os preços da base (ignora qualquer preço enviado), valida pratos esgotados e opções, e copia nome, opção e preço para `order_items` — o histórico não muda quando o cardápio muda.
- **Opções**: linhas do cardápio com vários produtos ao mesmo preço (ex.: "Super Bock ou Castle Lite", gins, whiskies) têm `opcoes`; o cliente escolhe uma e ela aparece no pedido.
- **Buffets**: pedem-se por pessoa (a quantidade é o número de pessoas) e mostram o que incluem.
- **Tempo real**: o painel subscreve `orders` com Supabase Realtime (só o administrador recebe eventos). Pedido novo: aviso no topo, som (depois de carregar em **Ativar som**, porque os navegadores bloqueiam som sem um clique) e a mesa fica destacada. "Os meus pedidos" do cliente atualiza por polling a cada 10 s.
- **Anti-spam**: no máximo 5 pedidos por mesa por minuto (verificado na base) e o botão de enviar ignora o duplo clique.
- **Horas**: guardadas em UTC e mostradas em `Africa/Maputo`, formato 24h.

## Fora desta versão

Pagamento online (proibido: sem M-Pesa, e-Mola, cartões ou gateways), contas de empregado/cozinha, impressão de talão e relatórios.

## Por confirmar com o restaurante

Ver a lista em [`dados/CARDAPIO.md`](dados/CARDAPIO.md#por-confirmar-com-o-restaurante) (nomes de vinhos, cerveja de pressão em ml/cl, shots sem preço, menu de pizzas que ainda falta).
