"use client";
import Link from "next/link";
import Image from "next/image";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 w-full bg-yellow-100 shadow-md z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo + Name */}
        <Link href="/" className="flex items-center space-x-2">
          <Image src="/logo.jpeg" alt="ZENTY Logo" width={32} height={32} />
          <span className="text-xl font-bold text-orange-950">ZENTY</span>
        </Link>

        {/* Navigation Links */}
        <div className="space-x-6 text-amber-900 font-medium">
          <Link href="/home" className="hover:text-orange-950 transition">Home</Link>
          <Link href="/about" className="hover:text-orange-950 transition">About</Link>
          <Link href="/dashboard" className="hover:text-orange-950 transition">Dashboard</Link>
          <Link href="/expenses" className="hover:text-orange-950 transition">Expenses</Link>
          <Link href="/stocks" className="hover:text-orange-950 transition">Get a Financial Advisor</Link>
          
          
          
        </div>
      </div>
    </nav>
  );
}
