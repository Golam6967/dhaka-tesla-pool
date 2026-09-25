export const metadata = {
  title: 'Dhaka Tesla Pool',
  description: 'Ride pooling MVP for Dhaka',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
