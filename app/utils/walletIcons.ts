// Utility file for wallet icons
export const walletIcons = {
  metamask: 'https://cryptologos.cc/logos/metamask-logo.png',
  phantom: 'https://cryptologos.cc/logos/phantom-logo.png',
  solflare: 'https://cryptologos.cc/logos/solflare-logo.png',
  backpack: 'https://cryptologos.cc/logos/backpack-logo.png',
  trust: 'https://cryptologos.cc/logos/trust-wallet-logo.png',
  coinbase: 'https://cryptologos.cc/logos/coinbase-wallet-logo.png',
} as const;

export type WalletIconKey = keyof typeof walletIcons;
