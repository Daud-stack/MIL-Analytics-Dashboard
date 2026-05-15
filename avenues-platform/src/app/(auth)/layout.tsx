import { APP_NAME } from "@/lib/app-config";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-12">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-teal-500/5 blur-3xl" />
      </div>

      {/* Content container */}
      <div className="relative w-full max-w-md">
        {/* Logo/Branding */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-teal-600 mb-4 mx-auto">
            <span className="text-white font-bold text-lg">{APP_NAME.charAt(0).toUpperCase()}</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {APP_NAME}
          </h1>
          <p className="text-slate-400 text-sm">
            Healthcare Analytics & Insights Platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="relative z-10 rounded-xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm shadow-2xl overflow-hidden">
          {/* Gradient border effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-teal-600/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />

          <div className="relative">
            {children}
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-xs text-slate-500 mt-6">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
