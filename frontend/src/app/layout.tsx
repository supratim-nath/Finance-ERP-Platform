import './globals.css'
import React from 'react'

export const metadata = {
  title: 'ERP Migration - Expense Audit V1.0',
  description: 'AI-Native Enterprise ERP and Financial Intelligence Audit Control Plane',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-background">
        {children}
      </body>
    </html>
  )
}
