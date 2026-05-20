import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sign In' }

export default function LoginPage() {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-2xl font-semibold text-gray-800 mb-1">Welcome back</h2>
      <p className="text-gray-500 text-sm mb-6">Sign in to your account</p>
      {/* LoginForm component goes here */}
      <p className="text-center text-xs text-gray-400 mt-6">Login form coming soon</p>
    </div>
  )
}
