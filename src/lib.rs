use ethers::types::{Address, U256};
use serde::{Deserialize, Serialize};
use serde_json::json;
use wasm_bindgen::prelude::*;
use web_sys::console;

#[derive(Serialize, Deserialize, Debug)]
struct EIP712Domain {
    name: String,
    version: String,
    #[serde(rename = "chainId")]
    chain_id: U256,
    #[serde(rename = "verifyingContract")]
    verifying_contract: Address,
}

#[derive(Serialize, Deserialize, Debug)]
struct LinkSigner {
    sender: [u8; 32],
    signer: Address,
    nonce: U256,
}

#[wasm_bindgen]
pub struct EIP712Signer {
    domain: EIP712Domain,
}

#[wasm_bindgen]
impl EIP712Signer {
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str, version: &str, chain_id: &str) -> Result<EIP712Signer, JsValue> {
        console::log_1(&format!("Creating EIP712Signer with chain_id: {}", chain_id).into());
        let chain_id = U256::from_dec_str(chain_id)
            .map_err(|e| JsValue::from_str(&format!("Invalid chain ID: {}", e)))?;

        let contract_address = match chain_id.as_u64() {
            42161 => "0xbbee07b3e8121227afcfe1e2b82772246226128e",
            81457 => "0x00f076fe36f2341a1054b16ae05fce0c65180ded",
            5000 => "0x526d7c7ea3677eff28cb5ba457f9d341f297fd52",
            _ => return Err(JsValue::from_str("Unsupported chain ID")),
        };

        let domain = EIP712Domain {
            name: name.to_string(),
            version: version.to_string(),
            chain_id,
            verifying_contract: contract_address
                .parse()
                .map_err(|e| JsValue::from_str(&format!("Invalid contract address: {}", e)))?,
        };

        console::log_1(&format!("Created domain: {:?}", domain).into());
        Ok(Self { domain })
    }

    #[wasm_bindgen]
    pub fn get_typed_data(
        &self,
        sender: &str,
        signer: &str,
        nonce: &str,
    ) -> Result<String, JsValue> {
        console::log_1(
            &format!(
                "get_typed_data called with sender: {}, signer: {}, nonce: {}",
                sender, signer, nonce
            )
            .into(),
        );

        let sender_address: Address = sender
            .parse()
            .map_err(|e| JsValue::from_str(&format!("Invalid sender address: {}", e)))?;
        let sender = self.create_subaccount(sender_address);
        let signer: Address = signer
            .parse()
            .map_err(|e| JsValue::from_str(&format!("Invalid signer address: {}", e)))?;
        let nonce = U256::from_dec_str(nonce)
            .map_err(|e| JsValue::from_str(&format!("Invalid nonce: {}", e)))?;

        let message = LinkSigner {
            sender,
            signer,
            nonce,
        };

        let typed_data = json!({
            "types": {
                "EIP712Domain": [
                    { "name": "name", "type": "string" },
                    { "name": "version", "type": "string" },
                    { "name": "chainId", "type": "uint256" },
                    { "name": "verifyingContract", "type": "address" }
                ],
                "LinkSigner": [
                    { "name": "sender", "type": "bytes32" },
                    { "name": "signer", "type": "address" },
                    { "name": "nonce", "type": "uint256" }
                ]
            },
            "primaryType": "LinkSigner",
            "domain": {
                "name": self.domain.name,
                "version": self.domain.version,
                "chainId": self.domain.chain_id.to_string(),
                "verifyingContract": format!("{:?}", self.domain.verifying_contract)
            },
            "message": {
                "sender": format!("0x{}", hex::encode(message.sender)),
                "signer": format!("{:?}", message.signer),
                "nonce": message.nonce.to_string()
            }
        });

        let json_string = typed_data.to_string();
        console::log_1(&format!("Typed data JSON string: {}", json_string).into());

        Ok(json_string)
    }

    #[wasm_bindgen]
    pub fn get_contract_address(&self) -> String {
        format!("{:?}", self.domain.verifying_contract)
    }

    fn create_subaccount(&self, address: Address) -> [u8; 32] {
        let address_bytes: [u8; 20] = address.into();
        let subaccount_name = to_bytes12("default");
        concat_to_bytes32(address_bytes, subaccount_name)
    }
}

fn to_bytes12(s: &str) -> [u8; 12] {
    let mut result = [0u8; 12];
    let bytes = s.as_bytes();
    let len = std::cmp::min(bytes.len(), 12);
    result[..len].copy_from_slice(&bytes[..len]);
    result
}

fn concat_to_bytes32(address: [u8; 20], name: [u8; 12]) -> [u8; 32] {
    let mut ret = [0; 32];
    ret[..20].clone_from_slice(&address);
    ret[20..].clone_from_slice(&name);
    ret
}
