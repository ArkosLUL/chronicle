import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/Card/Card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/Alert/Alert"
import { MagicLogo } from "@/components/MagicLogo"
import { useAuthProviders } from "@/api/queries"
import { useAuth } from "@/hooks/useAuth"

const DISCORD_URL = "https://discord.gg/gz97ABFVAj"

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { data: providers = [], isLoading: providersLoading, isError: providersError, error: providersErrorMsg } = useAuthProviders()
  const loading = (authLoading || providersLoading) && !providersError
  const authError = searchParams.get("error")

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true })
    }
  }, [isAuthenticated, navigate])

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
    window.location.assign(`/auth/${providerName}?from=${encodeURIComponent(redirectUri)}`)
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center pb-50">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <MagicLogo
            src="/c/chronicle/ChronicleLogoCenter.svg"
            alt="Chronicle Logo"
            className="mx-auto h-80 w-80"
          />
        </div>

        <Card className="p-8">
          {authError === "not_in_discord" && (
            <Alert className="mb-4">
              <AlertTitle>Join Discord first</AlertTitle>
              <AlertDescription>
                You need to join our Discord server before signing in. {" "}
                <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="underline">
                  Join Discord
                </a>
              </AlertDescription>
            </Alert>
          )}
          {(loading) ? (
            <div className="text-center text-muted-foreground">
              Loading authentication providers...
            </div>
          ) : providersError ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {providersErrorMsg?.message || "Failed to load authentication providers"}
              </AlertDescription>
            </Alert>
          ) : providers.length === 0 ? (
            <div className="text-center text-muted-foreground">
              No authentication providers configured
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-center mb-4 text-muted-foreground">
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

        <p className="text-center text-xs text-muted-foreground">
          Authentication is handled by external identity providers
        </p>
      </div>
    </div>
  )
}
