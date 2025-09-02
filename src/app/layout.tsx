// This can now be a Server Component, which is better!
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // <-- Import your new component
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const inter = Inter({ subsets: ["latin"] });

// You can also add metadata here if you want
// export const metadata = {
//   title: 'Fresh Face Salon',
//   description: 'Salon Management System',
// };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        {/*
          Now, the SessionProvider is correctly wrapped inside its own client component,
          and it wraps everything else in your application.
        */}
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