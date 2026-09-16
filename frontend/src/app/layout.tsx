import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
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
};

import { AuthProvider } from "@/context/AuthContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${orbitron.variable} ${shareTechMono.variable} bg-jarvis-dark text-jarvis-white min-h-screen overflow-hidden font-shareTechMono`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
