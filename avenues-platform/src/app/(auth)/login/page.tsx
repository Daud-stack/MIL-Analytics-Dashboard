"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/app-config";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Please try again.");
      } else if (result?.ok) {
        // Validate callback URL to prevent open redirect attacks
        const rawCallback = searchParams.get("callbackUrl") || "/hospital";
        const callbackUrl = rawCallback.startsWith("/") && !rawCallback.startsWith("//")
          ? rawCallback
          : "/hospital";
        window.location.href = callbackUrl;
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-6 py-8 sm:px-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Sign In</h2>
        <p className="text-slate-400 text-sm mt-1">
          Welcome back to {APP_NAME}
        </p>
      </div>

      {/* Demo credentials hint — only in development */}
      {/* Error message */}
      {error && (
        <div className="mb-6 rounded-lg bg-rose-900/20 border border-rose-700/30 p-4 flex items-start gap-3">
          <div className="flex-shrink-0 text-rose-400 mt-0.5">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5" suppressHydrationWarning>
        {/* Email Field */}
        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-slate-200">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              suppressHydrationWarning
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-500 transition-all duration-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-200">
              Password
            </label>
            <Link
              href="/forgot-password"
              prefetch={false}
              className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              suppressHydrationWarning
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-500 transition-all duration-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={isLoading}
          suppressHydrationWarning
          className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 disabled:from-slate-600 disabled:to-slate-500 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-teal-500/25 disabled:shadow-none"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Signing In..." : "Sign In"}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-6 pt-6 border-t border-slate-700/60 space-y-3">
        <p className="text-center text-sm text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-teal-400 hover:text-teal-300 transition-colors"
          >
            Create one
          </Link>
        </p>

        <p className="text-center text-xs text-slate-500 font-medium tracking-wide pt-1">
          Created & Engineered by{" "}
          <span className="text-teal-400 font-semibold hover:text-teal-300 transition-colors">
            Daud Sibanda
          </span>
        </p>
      </div>
    </div>
  );
}
