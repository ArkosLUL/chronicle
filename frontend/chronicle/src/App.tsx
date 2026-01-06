import { Routes, Route, Navigate } from "react-router-dom"
import { Login } from "./pages/Login"
import { Home } from "./pages/Home"
import { Empty } from "./pages/Empty"
import { NavBar } from "./components/NavBar"

function App() {
  return (
    <>
      <NavBar />
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
      <Route path="/empty" element={<Empty />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </>
  )
}

export default App