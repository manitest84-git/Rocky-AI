import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const orbitron = Orbitron({ 
  subsets: ["latin"], 
  weight: ['400', '500', '600', '700'],
  variable: '--font-orbitron'
});

const shareTechMono = Share_Tech_Mono({ 
  subsets: ["latin"], 
  weight: ['400'],
  variable: '--font-share-tech-mono'
});

export const metadata: Metadata = {
  title: "Rocky AI",
  description: "Rocky AI Voice Assistant",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Defensive guard against browser extension Web3 / Wallet injection errors (Brave Wallet, MetaMask, Safari Web3)
              try {
                if (typeof window !== 'undefined') {
                  if (!window.ethereum) {
                    window.ethereum = {};
                  }
                  window.addEventListener('error', function(e) {
                    var msg = (e && (e.message || (e.error && e.error.message))) || '';
                    if (typeof msg === 'string' && (msg.indexOf('ethereum') !== -1 || msg.indexOf('selectedAddress') !== -1)) {
                      e.stopImmediatePropagation();
                      e.preventDefault();
                    }
                  }, true);
                  window.addEventListener('unhandledrejection', function(e) {
                    var reason = (e && e.reason && (e.reason.message || e.reason.toString())) || '';
                    if (typeof reason === 'string' && (reason.indexOf('ethereum') !== -1 || reason.indexOf('selectedAddress') !== -1)) {
                      e.stopImmediatePropagation();
                      e.preventDefault();
                    }
                  }, true);
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className={`${orbitron.variable} ${shareTechMono.variable} bg-jarvis-dark text-jarvis-white min-h-screen overflow-hidden font-shareTechMono`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
