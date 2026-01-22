'use client'
import { useState, useEffect } from 'react'

interface Wallet {
  name: string
  icon: string
  is: string
  type: 'evm' | 'solana'
  deepLink?: string
}

export default function WalletConnect({ onConnect }: { onConnect: (wallet: Wallet) => void }) {
  const [showWallets, setShowWallets] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null)
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  const wallets: Wallet[] = [
    { 
      name: 'MetaMask', 
      icon: '🦊', 
      is: 'isMetaMask', 
      type: 'evm',
      deepLink: 'https://metamask.app/'
    },
    { 
      name: 'Phantom', 
      icon: '👻', 
      is: 'isPhantom', 
      type: 'solana',
      deepLink: 'https://phantom.app/'
    },
    { 
      name: 'Backpack', 
      icon: '🎒', 
      is: 'isBackpack', 
      type: 'solana',
      deepLink: 'https://www.backpack.app/'
    },
    { 
      name: 'Solflare', 
      icon: '☀️', 
      is: 'isSolflare', 
      type: 'solana',
      deepLink: 'https://solflare.com/'
    },
    { 
      name: 'Trust Wallet', 
      icon: '🛡️', 
      is: 'isTrust', 
      type: 'evm',
      deepLink: 'https://trustwallet.com/'
    },
    { 
      name: 'Coinbase Wallet', 
      icon: '🔵', 
      is: 'isCoinbaseWallet', 
      type: 'evm',
      deepLink: 'https://www.coinbase.com/wallet'
    },
  ]

  const handleWalletSelect = (wallet: Wallet) => {
    setSelectedWallet(wallet)
    onConnect(wallet)
  }

  const handleOpenApp = () => {
    if (selectedWallet?.deepLink) {
      window.open(selectedWallet.deepLink, '_blank')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      {!showWallets && !selectedWallet ? (
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-8">Connect Your Wallet</h1>
          <button
            onClick={() => setShowWallets(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full text-lg transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      ) : selectedWallet ? (
        <div className="text-center">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
            <div className="text-5xl mb-4">{selectedWallet.icon}</div>
            <h2 className="text-2xl font-bold mb-4">Open in {selectedWallet.name}</h2>
            <p className="text-gray-600 mb-6">
              Please open {selectedWallet.name} to continue connecting your wallet.
            </p>
            <div className="flex flex-col space-y-4">
              <button
                onClick={handleOpenApp}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Open {selectedWallet.name}
              </button>
              <button
                onClick={() => {
                  setSelectedWallet(null)
                  setShowWallets(false)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                Back to wallet selection
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Select Wallet</h2>
              <button 
                onClick={() => setShowWallets(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  onClick={() => handleWalletSelect(wallet)}
                  className="flex items-center w-full p-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <span className="text-2xl mr-3">{wallet.icon}</span>
                  <span className="font-medium">{wallet.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
