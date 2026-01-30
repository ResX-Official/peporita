// Global TypeScript declarations

// Extend the Window interface to include ethereum and solana
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isStatus?: boolean;
      host?: string;
      pathname?: string;
      port?: string;
      request?: (request: { method: string; params?: Array<any> }) => Promise<any>;
      send?: (request: { method: string; params?: Array<any> }, callback: (error: any, response: any) => void) => void;
      sendAsync?: (request: { method: string; params?: Array<any> }, callback: (error: any, response: any) => void) => void;
      enable?: () => Promise<string[]>;
    };
    solana?: {
      isPhantom?: boolean;
      isConnected: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      publicKey?: {
        toString: () => string;
      };
    };
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        isConnected: boolean;
        connect: () => Promise<{ publicKey: { toString: () => string } }>;
        publicKey?: {
          toString: () => string;
        };
      };
    };
  }
}

export {}; // This file needs to be a module
