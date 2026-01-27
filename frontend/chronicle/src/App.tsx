import { Routes, Route, Navigate } from "react-router-dom"
import { Login } from "./pages/Login/Login"
import { Home } from "./pages/Home"
import { Empty } from "./pages/Empty"
import { Upload } from "./pages/Upload/Upload"
import { LogsList } from "./pages/Logs/LogsList"
import { LogDetail } from "./pages/Logs/LogDetail"
import { InstancePage } from "./pages/Instance/InstancePage"
import { ProtoDecode } from "./pages/Debug/ProtoDecode"
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
        <Route path="/logs" element={<LogsList />} />
        <Route path="/logs/:logId" element={<LogDetail />} />
        <Route path="/instances/:instanceId" element={<InstancePage />} />
        <Route path="/debug/proto" element={<ProtoDecode />} />
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