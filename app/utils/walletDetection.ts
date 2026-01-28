import { ethers } from 'ethers';

export const detectWallets = () => {
  if (typeof window === 'undefined') {
    return { evm: false, solana: false };
  }
  
  const ethereum = (window as any).ethereum;
  const solana = (window as any).solana || 
                (window as any).phantom?.solana || 
                (window as any).backpack || 
                (window as any).solflare;

  return {
    evm: !!ethereum,
    solana: !!solana,
  };
};

export const connectEVM = async () => {
  if (typeof window === 'undefined') throw new Error('Window is not defined');
  
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('No EVM wallet found');

  try {
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();
    
    return {
      address,
      network: 'evm',
      provider,
      signer,
      chainId: Number(network.chainId),
    };
  } catch (error) {
    console.error('Failed to connect EVM wallet:', error);
    throw error;
  }
};

export const connectSolana = async () => {
  if (typeof window === 'undefined') throw new Error('Window is not defined');
  
  const solana = (window as any).solana || 
                (window as any).phantom?.solana || 
                (window as any).backpack || 
                (window as any).solflare;
  
  if (!solana) throw new Error('No Solana wallet found');

  try {
    if (solana.connect) await solana.connect();
    const publicKey = solana.publicKey;
    if (!publicKey) throw new Error('Failed to get public key');
    
    return {
      address: publicKey.toString(),
      network: 'solana',
      provider: solana,
    };
  } catch (error) {
    console.error('Failed to connect Solana wallet:', error);
    throw error;
  }
};
