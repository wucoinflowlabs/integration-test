import { Buffer } from "buffer";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// @solana/web3.js, pulled in by @coinflowlabs/react, expects a global Buffer.
globalThis.Buffer ??= Buffer;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
