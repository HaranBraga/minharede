import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Minha Rede",
  description: "Cadastro e gestão de rede de apoiadores",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className + " bg-gray-50 text-gray-900 min-h-screen"}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
