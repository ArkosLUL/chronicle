import { Routes, Route, Navigate } from "react-router-dom"
import { Login } from "./pages/Login"
import { Home } from "./pages/Home"
import { Empty } from "./pages/Empty"
import { Layout } from "./components/Layout/Layout"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/empty" element={<Empty />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App