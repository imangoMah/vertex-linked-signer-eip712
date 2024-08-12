import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const EIP712SignatureComponent = () => {
    const [signature, setSignature] = useState('');
    const [error, setError] = useState('');
    const [signerAddress, setSignerAddress] = useState('');
    const [currentWallet, setCurrentWallet] = useState('');
    const [provider, setProvider] = useState(null);
    const [signatureDetails, setSignatureDetails] = useState(null);
    const [eip712Signer, setEip712Signer] = useState(null);

    const connectWallet = async () => {
        try {
            if (typeof window.ethereum !== 'undefined') {
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                setProvider(provider);
                const accounts = await provider.send("eth_requestAccounts", []);
                setCurrentWallet(accounts[0]);
                setError('');
            } else {
                setError("MetaMask is not installed");
            }
        } catch (err) {
            setError("Failed to connect to MetaMask: " + err.message);
        }
    };

    const disconnectWallet = () => {
        setCurrentWallet('');
        setProvider(null);
        setSignature('');
        setSignatureDetails(null);
        setError('');
    };

    const signMessage = async () => {
        try {
            if (!provider) {
                throw new Error('Provider not initialized');
            }

            if (!ethers.utils.isAddress(signerAddress)) {
                throw new Error('Invalid signer address');
            }

            const signer = provider.getSigner();
            const nonceValue = await provider.getTransactionCount(currentWallet);
            const nonce = nonceValue.toString();
            const network = await provider.getNetwork();
            const chainId = network.chainId.toString();

            console.log('Chain ID:', chainId);
            console.log('Nonce:', nonce);

            // Create EIP712Signer instance with chainId as string
            const eip712SignerInstance = new window.EIP712Signer('Vertex', '0.0.1', chainId);
            setEip712Signer(eip712SignerInstance);

            // Ensure addresses are in the correct format
            const formattedCurrentWallet = ethers.utils.getAddress(currentWallet);
            const formattedSignerAddress = ethers.utils.getAddress(signerAddress);

            console.log('Calling get_typed_data with:', formattedCurrentWallet, formattedSignerAddress, nonce);
            const typedDataString = eip712SignerInstance.get_typed_data(
                formattedCurrentWallet,
                formattedSignerAddress,
                nonce
            );

            console.log('Raw Typed Data String:', typedDataString);
            
            const typedData = JSON.parse(typedDataString);
            console.log('Parsed Typed Data:', JSON.stringify(typedData, null, 2));

            // Check if typedData has the expected structure
            if (!typedData || typeof typedData !== 'object' || Object.keys(typedData).length === 0) {
                console.error('Unexpected typedData structure:', typedData);
                throw new Error('Invalid typed data structure');
            }

            if (!typedData.types || !typedData.types.LinkSigner) {
                console.error('Missing LinkSigner type in typedData:', typedData);
                throw new Error('Invalid typed data structure: Missing LinkSigner type');
            }

            // Use eth_signTypedData_v4 for EIP-712 structured data
            const signature = await signer._signTypedData(
                typedData.domain,
                { LinkSigner: typedData.types.LinkSigner },
                typedData.message
            );

            setSignature(signature);
            setSignatureDetails({
                sender: typedData.message.sender,
                signer: formattedSignerAddress,
                nonce: nonce,
                contractAddress: eip712SignerInstance.get_contract_address(),
            });
            setError('');
        } catch (err) {
            console.error('Error in signMessage:', err);
            setError(err.message);
            setSignature('');
            setSignatureDetails(null);
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
                    Sign with MetaMask
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