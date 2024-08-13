import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'


async function run() {
  try {

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