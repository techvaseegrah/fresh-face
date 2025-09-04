// src/app/layout.tsx

// This can now be a Server Component, which is better!
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // <-- Import your new component
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const inter = Inter({ subsets: ["latin"] });

// ▼▼▼ THIS IS THE FIX ▼▼▼
// Uncomment this and add the viewport property.
export const metadata = {
  title: 'Fresh Face Salon',
  description: 'Salon Management System',
  viewport: 'width=device-width, initial-scale=1', // <-- This line is essential for mobile responsiveness
};
// ▲▲▲ END OF FIX ▲▲▲

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 dark:bg-gray-800`}>
        <Providers>
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
        </Providers>
      </body>
    </html>
  ); 
}