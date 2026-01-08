import { Routes, Route, Navigate } from "react-router-dom"
import { Login } from "./pages/Login"
import { Home } from "./pages/Home"
import { Empty } from "./pages/Empty"
import { Upload } from "./pages/Upload"
import { 
  AccountLayout, 
  ProfileSettings, 
  NotificationSettings, 
  PrivacySettings, 
  AppearanceSettings 
} from "./pages/Settings"
import { Layout } from "./components/Layout/Layout"

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/empty" element={<Empty />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<Navigate to="/account/settings" replace />} />
          <Route path="settings" element={<ProfileSettings />} />
          <Route path="notifications" element={<NotificationSettings />} />
          <Route path="privacy" element={<PrivacySettings />} />
          <Route path="appearance" element={<AppearanceSettings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App