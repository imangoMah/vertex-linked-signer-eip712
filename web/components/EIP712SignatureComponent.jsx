import React, { useState } from 'react';
import { ethers } from 'ethers';

// API endpoints for different chain IDs
const API_ENDPOINTS = {
    42161: 'https://gateway.prod.vertexprotocol.com/v1/',  // Arbitrum One
    81457: 'https://gateway.blast-prod.vertexprotocol.com/v1/', // Blast
    5000: 'https://gateway.mantle-prod.vertexprotocol.com/v1/',  // Mantle
};

const CONTRACT_ADDRESSES = {
    42161: "0xbbee07b3e8121227afcfe1e2b82772246226128e", // Arbitrum One
    81457: "0x00f076fe36f2341a1054b16ae05fce0c65180ded", // Blast
    5000: "0x526d7c7ea3677eff28cb5ba457f9d341f297fd52",  // Mantle
};

function toBytes12(s) {
    const result = new Uint8Array(12);
    const bytes = new TextEncoder().encode(s);
    const len = Math.min(bytes.length, 12);
    result.set(bytes.slice(0, len));
    return result;
}
function addressToBytes32(address) {
    // 移除 '0x' 前缀，如果存在的话
    const cleanAddress = address.toLowerCase().replace(/^0x/, '');
    // 在地址后面补零，直到达到 64 个字符（32 字节）
    const paddedAddress = cleanAddress.padEnd(64, '0');
    // 添加 '0x' 前缀并返回
    return '0x' + paddedAddress;
}
function concatToBytes32(address, name) {
    const result = new Uint8Array(32);
    result.set(address);
    result.set(name, 20);
    return result;
}

function createSubaccount(address) {
    const addressBytes = ethers.utils.arrayify(address);
    const subaccountName = toBytes12("default");
    const bytes32 = concatToBytes32(addressBytes, subaccountName);
    return ethers.utils.hexlify(bytes32);
}

const EIP712SignatureComponent = () => {
    const [signature, setSignature] = useState('');
    const [error, setError] = useState('');
    const [signerAddress, setSignerAddress] = useState('');
    const [currentWallet, setCurrentWallet] = useState('');
    const [provider, setProvider] = useState(null);
    const [signatureDetails, setSignatureDetails] = useState(null);
    const [isMultiSig, setIsMultiSig] = useState(false);
    const [isSendDisabled, setIsSendDisabled] = useState(true);
    const [chainId, setChainId] = useState(null);
    const [apiResponse, setApiResponse] = useState(null);

    const getContractAddress = (chainId) => {
        const address = CONTRACT_ADDRESSES[chainId];
        if (!address) {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        }
        return address;
    };

    const connectWallet = async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                setProvider(provider);
                const accounts = await provider.send("eth_requestAccounts", []);
                setCurrentWallet(accounts[0]);
                
                const network = await provider.getNetwork();
                setChainId(network.chainId);
                
                // Check if the wallet is a multi-sig
                const code = await provider.getCode(accounts[0]);
                setIsMultiSig(code !== '0x'); // If code is not '0x', it's a contract (potentially multi-sig)

                setError('');
            } else {
                setError("MetaMask is not installed");
            }
        } catch (err) {
            setError("Failed to connect to wallet: " + err.message);
        }
    };

    const disconnectWallet = () => {
        setCurrentWallet('');
        setProvider(null);
        setSignature('');
        setSignatureDetails(null);
        setError('');
        setIsMultiSig(false);
        setChainId(null);
        setIsSendDisabled(true);
        setApiResponse(null);
    };

 const signMessage = async () => {
        try {
            if (!provider) {
                throw new Error('Provider not initialized');
            }

            if (!currentWallet) {
                throw new Error('Wallet not connected');
            }

            const signer = provider.getSigner();
            const nonceValue = await getNoceValue(currentWallet);
            if (nonceValue === undefined) {
                throw new Error('Failed to get nonce value');
            }
            const nonce = nonceValue.toString();
            const network = await provider.getNetwork();
            const chainId = network.chainId;

            console.log('Chain ID:', chainId);
            console.log('Nonce:', nonce);

            const formattedCurrentWallet = ethers.utils.getAddress(currentWallet);
            const formattedSignerAddress = ethers.utils.getAddress(signerAddress);

            const contractAddress = getContractAddress(chainId);

            // Create subaccount for sender
            const sender = createSubaccount(formattedCurrentWallet);

            // Convert signer address to 32-byte hex with zeros padded at the end
            const signer32Bytes = addressToBytes32(formattedSignerAddress);

            // EIP-712 typed data
            const domain = {
                name: 'Vertex',
                version: '0.0.1',
                chainId: chainId,
                verifyingContract: contractAddress
            };

            const types = {
                LinkSigner: [
                    { name: 'sender', type: 'bytes32' },
                    { name: 'signer', type: 'bytes32' },
                    { name: 'nonce', type: 'uint64' }
                ]
            };

            const message = {
                sender: sender,
                signer: signer32Bytes,
                nonce: nonce
            };

            let signature;
            if (isMultiSig) {
                // 多签名钱包的逻辑保持不变
                const multiSigContract = new ethers.Contract(currentWallet, ['function submitTransaction(address to, uint256 value, bytes data) public'], signer);
                const data = ethers.utils.defaultAbiCoder.encode(['bytes32'], [ethers.utils._TypedDataEncoder.hash(domain, types, message)]);
                const tx = await multiSigContract.submitTransaction(currentWallet, 0, data);
                await tx.wait();
                signature = "Multi-sig transaction submitted: " + tx.hash;
            } else {
                // 标准 EIP-712 签名
                signature = await signer._signTypedData(domain, types, message);
            }

            setSignature(signature);
            setSignatureDetails({
                currentWallet: currentWallet,
                sender: sender,
                signer: signer32Bytes,
                nonce: nonce,
                contractAddress: contractAddress,
                isMultiSig: isMultiSig
            });
            setError('');
            setIsSendDisabled(false);
        } catch (err) {
            console.error('Error in signMessage:', err);
            setError(err.message);
            setSignature('');
            setSignatureDetails(null);
            setIsSendDisabled(true);
        }
    };

    async function getNoceValue(currentWallet) {
        if (!chainId) return;
        const apiEndpoint = API_ENDPOINTS[chainId];
        if (!apiEndpoint) {
            setError(`No API endpoint configured for chain ID ${chainId}`);
            return;
        }
        const apiData = {
            type: "nonces",
            address: currentWallet
        };
        try {
            const response = await fetch(apiEndpoint + 'query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(apiData),
            });

            const result = await response.json();
            console.log("API response:", result);
            setApiResponse(result);

            if (!response.ok || result.status === "failure") {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }
        
            setError('');
            return result?.data?.tx_nonce;
        } catch (err) {
            console.error("Error sending data to API:", err);
            setError(`Failed to send data to API: ${err.message}`);
        }
    }

    const sendToApi = async () => {
        if (!signatureDetails || !signature) {
            setError("Please sign the message before sending.");
            return;
        }

        if (!chainId) return;
        const apiEndpoint = API_ENDPOINTS[chainId];
        if (!apiEndpoint) {
            setError(`No API endpoint configured for chain ID ${chainId}`);
            return;
        }

        const apiData = {
            link_signer: {
                tx: {
                    sender: signatureDetails.sender,
                    signer: signatureDetails.signer,
                    nonce: signatureDetails.nonce
                },
                signature: signature
            }
        };

        console.log("Sending data to API:", JSON.stringify(apiData, null, 2));

        try {
            const response = await fetch(apiEndpoint + 'execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(apiData, null, 2),
            });

            const result = await response.json();
            console.log("API response:", result);
            setApiResponse(result);

            if (!response.ok || result.status === "failure") {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            setError('');
        } catch (err) {
            console.error("Error sending data to API:", err);
            setError(`Failed to send data to API: ${err.message}`);
        }
    };

    return (
        <div className="p-4 space-y-4">
            {!currentWallet ? (
                <button onClick={connectWallet} className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    Connect Wallet
                </button>
            ) : (
                <div>
                    <p>Current Wallet: {currentWallet}</p>
                    <p>Chain ID: {chainId}</p>
                    <p>Wallet Type: {isMultiSig ? 'Multi-Signature' : 'Standard'}</p>
                    <button onClick={disconnectWallet} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-2">
                        Disconnect Wallet
                    </button>
                </div>
            )}
            <div>
                <input
                    type="text"
                    placeholder="Enter signer wallet address"
                    value={signerAddress}
                    onChange={(e) => setSignerAddress(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />
            </div>
            <div>
                <button 
                    onClick={signMessage} 
                    disabled={!currentWallet}
                    className={`bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ${!currentWallet && 'opacity-50 cursor-not-allowed'}`}
                >
                    {isMultiSig ? 'Submit Multi-Sig Transaction' : 'Sign with Wallet'}
                </button>
            </div>
            <div>
                <button 
                    onClick={sendToApi} 
                    disabled={isSendDisabled}
                    className={`bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded ${isSendDisabled && 'opacity-50 cursor-not-allowed'}`}
                >
                    Send to API
                </button>
            </div>
            {signatureDetails && (
                <div className="mt-4 p-4 border rounded-md">
                    <h3 className="font-bold text-lg mb-2">Signature Result</h3>
                    <p><strong>Signature:</strong> {signature}</p>
                    <p><strong>Sender:</strong> {signatureDetails.sender}</p>
                    <p><strong>Signer:</strong> {signatureDetails.signer}</p>
                    <p><strong>Nonce:</strong> {signatureDetails.nonce}</p>
                    <p><strong>Contract Address:</strong> {signatureDetails.contractAddress}</p>
                    <p><strong>Wallet Type:</strong> {signatureDetails.isMultiSig ? 'Multi-Signature' : 'Standard'}</p>
                </div>
            )}
            {apiResponse && (
                <div className="mt-4 p-4 border rounded-md">
                    <h3 className="font-bold text-lg mb-2">API Response</h3>
                    <p><strong>Status:</strong> {apiResponse.status}</p>
                    {apiResponse.error && <p><strong>Error:</strong> {apiResponse.error}</p>}
                    {apiResponse.error_code && <p><strong>Error Code:</strong> {apiResponse.error_code}</p>}
                    <p><strong>Request Type:</strong> {apiResponse.request_type}</p>
                    <p><strong>Signature:</strong> {apiResponse.signature}</p>
                </div>
            )}
            {error && (
                <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    <h3 className="font-bold text-lg mb-2">Error:</h3>
                    <p>{error}</p>
                </div>
            )}
        </div>
    );
};

export default EIP712SignatureComponent;