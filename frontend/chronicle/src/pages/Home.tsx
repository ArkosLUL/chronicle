import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"

export function Home() {
  const navigate = useNavigate()

  const handleLogout = () => {
    // TODO: Implement actual logout logic
    navigate("/login")
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <img src="/icons/class_mage.png" alt="Chronicle" className="mb-4" />
      <h1 className="text-3xl font-bold mb-4">Welcome to Chronicle</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        You are now logged in!
      </p>
      <Button onClick={handleLogout}>Logout</Button>
    </div>
  )
}
