// app/layout.tsx
'use client'

import { Inter } from "next/font/google"
import "./globals.css"
// DO NOT import Sidebar here
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { SessionProvider } from "next-auth/react"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        {/* SessionProvider wraps everything, which is correct */}
        <SessionProvider>
          {/* 
            The `children` here will be your actual pages.
            For routes like /login, it will be the login page.
            For routes like /dashboard, it will be the MainLayout, which in turn contains the dashboard page.
          */}
          {children}
          
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
  )
}