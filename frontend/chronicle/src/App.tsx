import { Button } from "@/components/ui/button"

function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <img src={"/icons/class_mage.png"} />
      <Button>Click me</Button>
      <div
      style={{
        width: '200px',
        height: '200px',
        backgroundColor: 'var(--background)',
      }}>
        test
      </div>
    </div>
  )
}

export default App