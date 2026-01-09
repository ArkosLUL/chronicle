import type { Meta, StoryObj } from "@storybook/react-vite"
import { http, HttpResponse, delay } from "msw"
import { MemoryRouter } from "react-router-dom"
import { Upload } from "./Upload"

const meta: Meta<typeof Upload> = {
  title: "Pages/Upload",
  component: Upload,
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
}

export default meta
type Story = StoryObj<typeof Upload>

export const NotAuthenticated: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/whoami", () => new HttpResponse(null, { status: 401 })),
      ],
    },
  },
}

export const Authenticated: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/whoami", () => HttpResponse.json({ id: "1", name: "User" })),
      ],
    },
  },
}

export const UploadInProgress: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/whoami", () => HttpResponse.json({ id: "1", name: "User" })),
        http.post("/api/v1/raidlogs/upload", async () => {
          await delay("infinite")
          return HttpResponse.json({})
        }),
      ],
    },
  },
}

export const UploadFailed: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/whoami", () => HttpResponse.json({ id: "1", name: "User" })),
        http.post("/api/v1/raidlogs/upload", () => 
          HttpResponse.json({ message: "Invalid combat log format" }, { status: 400 })
        ),
      ],
    },
  },
}

export const UploadSucceeded: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/api/v1/whoami", () => HttpResponse.json({ id: "1", name: "User" })),
        http.post("/api/v1/raidlogs/upload", () => 
          HttpResponse.json({ 
            log_id: "123e4567-e89b-12d3-a456-426614174000",
            files: ["file1", "file2"],
            message: "Raid log uploaded successfully" 
          })
        ),
      ],
    },
  },
}
