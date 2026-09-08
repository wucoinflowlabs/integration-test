import { Buffer } from "buffer";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Not in the Coinflow guide. @coinflowlabs/react imports @solana/web3.js, which
// expects Node's Buffer. Without this the page renders blank.
globalThis.Buffer ??= Buffer;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
