'use client'
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ToastContainer } from 'react-toastify';
import {StaffProvider} from '../context/StaffContext'
import 'react-toastify/dist/ReactToastify.css';

const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "ff project",
//   description: "Modern salon management system",
// };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <StaffProvider>
        <Sidebar />
        <main className="ml-64 p-8">
          {children}
        </main>
        </StaffProvider>
         <ToastContainer
          position="top-right"
          autoClose={3000} // Toasts will close automatically after 3 seconds
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </body>
    </html>
  );
}
