'use client';

import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { SessionProvider } from "next-auth/react";
// --- FIX 1: Import the StaffProvider ---
import { StaffProvider } from "@/context/StaffContext"; 

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* It's good practice to make the body a flex container for this layout */}
      <body className={`${inter.className} bg-gray-50 flex`}>
        <SessionProvider>
          <Sidebar />

          {/* --- FIX 3: Corrected the main content layout --- */}
          {/* Use ml-64 (or the width of your sidebar) to prevent content from hiding underneath it. */}
          {/* `flex-1` allows the main content to fill the remaining space. */}
          <main className="flex-1 ml-64 p-8">
          
            {/* --- FIX 2: Wrap the children with the StaffProvider --- */}
            {/* This makes the staff context available to all pages. */}
            <StaffProvider>
              {children}
            </StaffProvider>

          </main>
          
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </SessionProvider>
      </body>
    </html>
  );
}