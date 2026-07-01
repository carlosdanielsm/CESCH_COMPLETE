This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Búsqueda de nuevos enlaces

La operación **Operaciones → Buscar enlaces** recibe un archivo `.xlsx`, `.xls` o
`.csv` exportado desde Google Sheets. Requiere estas columnas:

- `DESCRIPTION NUEVA ESPAÑOL`
- `DESCRIPTION NUEVA INGLES`
- `TOTAL UNIT`
- `PRICE`
- `LINKS ORIGINAL`

Cada fila dispara dos investigaciones independientes y simultáneas mediante OpenAI
Responses API: una restringida a Alibaba y otra a Made-in-China. Los candidatos se
comparan por identidad del producto, MOQ, tramo de precio correspondiente a
`TOTAL UNIT` y diferencia frente a `PRICE`. Alibaba gana cuando las opciones son
comparables; Made-in-China puede ganar si la evidencia es materialmente mejor.

La carga masiva procesa dos filas a la vez (cuatro búsquedas web simultáneas como
máximo). Esto reduce el tiempo total sin producir una ráfaga excesiva de peticiones.
Cada fila puede consumir dos llamadas de Responses API, más reintentos si un modelo
falla.

Variables de entorno necesarias:

```bash
OPENAI_API_KEY=...
# Opcional; el valor predeterminado es gpt-4.1-mini
PRODUCT_SEARCH_MODEL=gpt-4.1-mini
# Opcional; se usa si el modelo principal falla o no entrega JSON
PRODUCT_SEARCH_FALLBACK_MODEL=gpt-5.4-mini
# Opcional; diferencia máxima recomendada antes de bajar la confianza
PRODUCT_MAX_PRICE_DIFFERENCE_PERCENT=35
```

La suscripción ChatGPT Plus no incluye consumo de API. La cuenta de API asociada a
la clave debe tener facturación y acceso al modelo/herramienta de búsqueda.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
