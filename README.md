# vertex-eip712-signature-project


## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) (v14 or later)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/eip712-signature-project.git
   cd eip712-signature-project
   ```

2. Install wasm-pack:
   ```
   curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
   ```

3. Install Node.js dependencies:
   ```
   npm install
   ```

## Building the Project

1. Build the Rust/Wasm module:
   ```
   wasm-pack build --target web
   ```

2. Build the Vite/React project:
   ```
   npm run build
   ```

## Running the Project

To run the project in development mode:

```
npm run dev
```

To preview the production build:

```
npm run preview
```

## Usage

1. Connect your MetaMask wallet to the application.
2. Enter the signer's wallet address.
3. Click the "Sign with MetaMask" button to generate and sign the EIP-712 structured data.
4. The signature and related details will be displayed on the page.


## License

This project is licensed under the MIT License.