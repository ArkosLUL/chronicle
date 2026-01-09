import type { Meta, StoryObj } from "@storybook/react-vite"
import { MemoryRouter } from "react-router-dom"
import { UploadView } from "./Upload"

const mockFile = new File(["content"], "WoWCombatLog.txt", { type: "text/plain" });
Object.defineProperty(mockFile, "size", { value: 1024 * 1024 * 5 }); // 5MB

const mockRawFile = new File(["content"], "WoWRawCombatLog.txt", { type: "text/plain" });
Object.defineProperty(mockRawFile, "size", { value: 1024 * 500 }); // 500KB

const defaultProps = {
  isAuthenticated: true,
  authLoading: false,
  combatLog: null,
  rawCombatLog: null,
  uploading: false,
  uploadProgress: 0,
  error: null,
  success: null,
  onFileSelect: () => {},
  onUpload: () => {},
  onReset: () => {},
};

const meta: Meta<typeof UploadView> = {
  title: "Pages/Upload",
  component: UploadView,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  args: defaultProps,
}

export default meta
type Story = StoryObj<typeof UploadView>

export const NotAuthenticated: Story = {
  args: {
    isAuthenticated: false,
    authLoading: false,
  },
}

export const Authenticated: Story = {
  args: {
    isAuthenticated: true,
  },
}

export const WithFilesSelected: Story = {
  args: {
    isAuthenticated: true,
    combatLog: mockFile,
    rawCombatLog: mockRawFile,
  },
}

export const UploadInProgress: Story = {
  args: {
    isAuthenticated: true,
    combatLog: mockFile,
    rawCombatLog: mockRawFile,
    uploading: true,
    uploadProgress: 45,
  },
}

export const UploadFailed: Story = {
  args: {
    isAuthenticated: true,
    combatLog: mockFile,
    rawCombatLog: mockRawFile,
    error: "Invalid combat log format. Please ensure you're uploading the correct file.",
  },
}

export const UploadSucceeded: Story = {
  args: {
    isAuthenticated: true,
    success: { message: "Raid log uploaded successfully. Processing will begin shortly." },
  },
}
