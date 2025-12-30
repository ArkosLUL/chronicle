import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implement actual authentication logic
    console.log("Login attempt:", { email, password })
    // For now, just navigate to home on any login attempt
    navigate("/")
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <img 
            src="/icons/class_mage.png" 
            alt="Chronicle Logo" 
            className="mx-auto h-20 w-20"
          />
          <h1 className="mt-6 text-3xl font-bold tracking-tight">
            Welcome to Chronicle
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Sign in to your account to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4 rounded-lg bg-white p-8 shadow-md dark:bg-gray-950">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </div>

          <div className="text-center text-sm">
            <a href="#" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
              Forgot your password?
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
