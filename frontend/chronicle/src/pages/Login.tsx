import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/Card/Card"

export function Login() {
  const [providers, setProviders] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch available auth providers from the backend
    // /auth/list returns a simple array of provider names: ["dev", "github", etc.]
    fetch("/auth/list")
      .then((res) => res.json())
      .then((data: string[]) => {
        setProviders(data || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch auth providers:", err)
        setLoading(false)
      })
  }, [])

  const handleLogin = (providerName: string) => {
    // Redirect to OAuth login endpoint
    // Check for 'from' in query params, then referrer, then default to "/"
    const params = new URLSearchParams(window.location.search)
    let redirectUri = params.get("from")
    if (!redirectUri && document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer)
        // Only use referrer if it's from the same origin
        if (referrerUrl.origin === window.location.origin) {
          redirectUri = referrerUrl.pathname + referrerUrl.search
        }
      } catch {
        // Invalid referrer URL, ignore
      }
    }
    redirectUri = redirectUri || "/"
    window.location.href = `/auth/${providerName}?from=${encodeURIComponent(redirectUri)}`
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
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
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with your account to continue
          </p>
        </div>

        <Card className="">
          {(loading) ? (
            <div className="text-center text-muted-foreground">
              Loading authentication providers...
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center text-muted-foreground">
              No authentication providers configured
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
                Choose a provider to sign in:
              </p>
              {providers.map((provider) => (
                <Button
                  key={provider}
                  onClick={() => handleLogin(provider)}
                  className="w-full"
                  variant="outline"
                >
                  <span className="capitalize">Sign in with {provider}</span>
                </Button>
              ))}
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-gray-500 dark:text-gray-500">
          Authentication is handled by external identity providers
        </p>
      </div>
    </div>
  )
}
