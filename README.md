# Integration Demo

A small merchant checkout flow used to stage a payment provider integration. An Express API
serves a hardcoded product and a mock checkout endpoint; a React app walks through the
purchase.

## Running it

```bash
npm install   # at the repo root - npm workspaces installs server/ and client/ too
npm run dev   # starts both apps with concurrently
```

- Client: http://localhost:5173
- API: http://localhost:4000/api/product

Vite proxies `/api` to `localhost:4000`, so the browser only ever talks to port 5173.

Node 18 or newer is required. This machine uses a Node installed through
[nvm](https://github.com/nvm-sh/nvm); if `node` is not found, load it first:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

## What phase 1 does

Phase 1 is a **fake checkout with no payment processor**. Nothing is charged, no card data is
collected anywhere, and the order ID is a constant.

The flow is: product page, then a custom checkout form asking only for name and email, then a
confirmation screen showing the mock order ID.

```
integration-demo/
├── server/
│   ├── index.js              Express app, port 4000 (PORT overrides), CORS + JSON body parsing
│   ├── .env.example           Copy to server/.env; nothing is required for phase 1
│   └── routes/
│       ├── index.js           Mounts every route under /api - the seam for a provider route
│       ├── product.js         GET /api/product -> hardcoded { name: "Sword", price: 10.99, ... }
│       └── checkout.js        POST /api/checkout -> validates name/email, waits 1.2s, returns
│                              { success: true, orderId: "demo_12345" }
└── client/
    ├── vite.config.js         Dev server on 5173, proxies /api to localhost:4000
    └── src/
        ├── App.jsx            Holds the step state: product -> checkout -> confirmation
        ├── api.js             fetchProduct() and submitCheckout()
        └── components/
            ├── Product.jsx        Product details and the Checkout button
            ├── Checkout.jsx       The whole checkout form (name, email, submit, errors)
            └── Confirmation.jsx   Success screen with the order ID
```

The 1.2 second delay in `POST /api/checkout` is artificial, standing in for real processor
latency so the submitting state is visible.

## Phase 2 (upcoming)

Coinflow is not installed and no Coinflow code exists yet. Two files are the integration
points:

**`client/src/components/Checkout.jsx`** replaces its form with `<CoinflowPurchase>`. `App.jsx`
only passes `product`, `onSuccess(order)`, and `onCancel()`, and reads nothing else from this
component, so the swap stays contained to this one file.

**`server/routes/checkout.js`** becomes the server side of that flow: issuing the session key
and JWT token that `<CoinflowPurchase>` needs, and verifying the resulting charge before
recording an order. `server/routes/index.js` has a marked spot to mount those endpoints under
`/api/coinflow`, and `server/.env.example` has the commented-out `COINFLOW_API_KEY` and
`COINFLOW_MERCHANT_ID` they will read.
