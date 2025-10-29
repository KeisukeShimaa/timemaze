import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <title>TimeMaze - FHEVM Speedrun</title>
        <meta name="description" content="Encrypted on-chain speedrun records powered by FHEVM" />
      </head>
      <body>{children}</body>
    </html>
  );
}


