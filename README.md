# Startt Delivery

SaaS multiempresa de delivery produzido por **Startt Facilities**.

O projeto usa Vite, React, TypeScript e Tailwind CSS. Os dados atuais ficam em uma camada mock persistida no `localStorage`, preparada para futura integração com Supabase/PostgreSQL.

## Rotas principais

- Cardápio público: `/dogexpress`, `/pizzariadojoao`, `/burguerdopaulo`
- Admin da empresa: `/:companySlug/admin/login`
- Admin Master: `/master/login`

## Acessos de teste

Admin Master:

```txt
master@startt.com
123456
```

Admins de empresas:

```txt
admin@dogexpress.com / 123456
admin@pizzariadojoao.com / 123456
admin@burguerdopaulo.com / 123456
```

## Desenvolvimento local

```bash
npm install
npm run dev
```

Abra:

```txt
http://127.0.0.1:5173
```

## Build de produção

```bash
npm run build
```

O build final é gerado em `dist/`.

## Deploy na Vercel

Configuração recomendada:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

O arquivo `vercel.json` já contém rewrite para SPA, permitindo reload direto em rotas como:

```txt
/dogexpress/admin/dashboard
/master/empresas
```

## Observações

- Não há backend real neste estágio.
- O `localStorage` simula persistência de empresas, usuários, pedidos, caixa, planos e configurações.
- Para reiniciar os dados demo, limpe o `localStorage` do navegador.
