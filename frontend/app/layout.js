import './globals.css';
import { AuthProvider } from './providers';
import Navbar from '../components/Navbar';

export const metadata = {
  title: 'Dhaka Tesla Pool',
  description: 'Ride pooling MVP for Dhaka',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
