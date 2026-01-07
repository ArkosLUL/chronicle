import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse, delay } from "msw"
import { Login } from "./Login"

const meta: Meta<typeof Login> = {
  title: "Pages/Login",
  component: Login,
  parameters: {
    layout: "fullscreen",
  },
}

export default meta
type Story = StoryObj<typeof Login>

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/auth/list", async () => {
          await delay("infinite")
          return HttpResponse.json([])
        }),
      ],
    },
  },
}

export const NoProviders: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/auth/list", () => HttpResponse.json([])),
      ],
    },
  },
}

export const MultipleProviders: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get("/auth/list", () => HttpResponse.json(["discord", "github", "google"])),
      ],
    },
  },
}
