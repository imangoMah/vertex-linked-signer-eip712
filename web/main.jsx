import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import init, { EIP712Signer } from '../pkg/eip712_signer.js';

async function run() {
  try {
    await init();
    window.EIP712Signer = EIP712Signer;
    console.log('WebAssembly module initialized in main.jsx');
    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
  } catch (error) {
    console.error("Failed to initialize the app:", error);
  }
}

run();