"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, AlertCircle, Loader2, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const selfRegistrationEnabled = process.env.NEXT_PUBLIC_ALLOW_SELF_REGISTRATION === "true";
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    organization: "Avenues Clinic",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Full name is required";
    }

    if (!formData.email.trim()) {
      errors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 12) {
      errors.password = "Password must be at least 12 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          organization: formData.organization,
          role: "ANALYST",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Registration failed");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="px-6 py-8 sm:px-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-teal-900/20 border border-teal-700/30 p-4">
              <CheckCircle className="h-8 w-8 text-teal-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Account Created!
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Your account has been successfully created. Redirecting to login...
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="h-2 w-2 rounded-full bg-teal-500 animate-bounce" />
            <div className="h-2 w-2 rounded-full bg-teal-500 animate-bounce delay-100" />
            <div className="h-2 w-2 rounded-full bg-teal-500 animate-bounce delay-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Create Account</h2>
        <p className="text-slate-400 text-sm mt-1">
          Join Avenues Intelligence Platform
        </p>
      </div>

      {!selfRegistrationEnabled && (
        <div className="mb-6 rounded-lg bg-amber-900/20 border border-amber-700/30 p-4 flex items-start gap-3">
          <div className="flex-shrink-0 text-amber-400 mt-0.5">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-sm text-amber-200">
            Self-registration is currently disabled. An authenticated administrator can still create accounts from this form.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg bg-rose-900/20 border border-rose-700/30 p-4 flex items-start gap-3">
          <div className="flex-shrink-0 text-rose-400 mt-0.5">
            <AlertCircle className="h-4 w-4" />
          </div>
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className="block text-sm font-medium text-slate-200">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              id="name"
              type="text"
              name="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={handleChange}
              required
              className={`w-full bg-slate-700/50 border ${
                validationErrors.name ? "border-rose-500" : "border-slate-600"
              } rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-500 transition-all duration-200 focus:outline-none ${
                validationErrors.name
                  ? "focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  : "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              }`}
            />
          </div>
          {validationErrors.name && (
            <p className="text-xs text-rose-400">{validationErrors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-slate-200">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              id="email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              className={`w-full bg-slate-700/50 border ${
                validationErrors.email ? "border-rose-500" : "border-slate-600"
              } rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-500 transition-all duration-200 focus:outline-none ${
                validationErrors.email
                  ? "focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  : "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              }`}
            />
          </div>
          {validationErrors.email && (
            <p className="text-xs text-rose-400">{validationErrors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-slate-200">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              id="password"
              type="password"
              name="password"
              placeholder="************"
              value={formData.password}
              onChange={handleChange}
              required
              className={`w-full bg-slate-700/50 border ${
                validationErrors.password ? "border-rose-500" : "border-slate-600"
              } rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-500 transition-all duration-200 focus:outline-none ${
                validationErrors.password
                  ? "focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  : "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              }`}
            />
          </div>
          {validationErrors.password && (
            <p className="text-xs text-rose-400">{validationErrors.password}</p>
          )}
          <p className="text-xs text-slate-400">
            Minimum 12 characters
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-200">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              placeholder="************"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className={`w-full bg-slate-700/50 border ${
                validationErrors.confirmPassword ? "border-rose-500" : "border-slate-600"
              } rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-slate-500 transition-all duration-200 focus:outline-none ${
                validationErrors.confirmPassword
                  ? "focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                  : "focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              }`}
            />
          </div>
          {validationErrors.confirmPassword && (
            <p className="text-xs text-rose-400">{validationErrors.confirmPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 disabled:from-slate-600 disabled:to-slate-500 text-white font-semibold py-2.5 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-teal-500/25 disabled:shadow-none mt-6"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Creating Account..." : "Create Account"}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-700">
        <p className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-teal-400 hover:text-teal-300 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
