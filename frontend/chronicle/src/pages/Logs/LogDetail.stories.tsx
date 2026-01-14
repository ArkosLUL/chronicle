import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import { LogDetailView } from "./LogDetail";
import type { WoWLogGroupState, JobStatus } from "@/api/queries";

const mockJobStatus: JobStatus = {
  id: 12345,
  state: "pending",
  kind: "parse_log",
  attempt: 1,
  max_attempts: 3,
  created_at: "2026-01-10T14:30:00Z",
  scheduled_at: "2026-01-10T14:30:00Z",
  attempted_at: null,
  finalized_at: null,
  errors: [],
};

const mockLog: WoWLogGroupState = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  owner: "user-123",
  created_at: { Time: "2026-01-10T14:30:00Z", Valid: true },
  updated_at: { Time: "2026-01-10T14:35:00Z", Valid: true },
  files: [
    {
      id: "file-001-abcd-efgh-ijkl",
      owner: "user-123",
      wow_log_id: "550e8400-e29b-41d4-a716-446655440000",
      hash: "abc123def456",
      size_bytes: 1024 * 1024 * 25, // 25MB
      mime_type: "text/plain",
      created_at: { Time: "2026-01-10T14:30:00Z", Valid: true },
      updated_at: { Time: "2026-01-10T14:30:00Z", Valid: true },
    },
    {
      id: "file-002-abcd-efgh-ijkl",
      owner: "user-123",
      wow_log_id: "550e8400-e29b-41d4-a716-446655440000",
      hash: "ghi789jkl012",
      size_bytes: 1024 * 500, // 500KB
      mime_type: "text/plain",
      created_at: { Time: "2026-01-10T14:30:00Z", Valid: true },
      updated_at: { Time: "2026-01-10T14:30:00Z", Valid: true },
    },
  ],
  status: mockJobStatus,
};

const defaultProps = {
  isAuthenticated: true,
  authLoading: false,
  log: mockLog,
  logLoading: false,
  logError: null,
  onDelete: () => console.log("Delete clicked"),
  isDeleting: false,
  showDeleteConfirm: false,
  setShowDeleteConfirm: () => {},
  onReparse: () => console.log("Reparse clicked"),
  isReparsing: false,
  onRefresh: () => console.log("Refresh clicked"),
  isRefreshing: false,
};

const meta: Meta<typeof LogDetailView> = {
  title: "Pages/Logs/LogDetail",
  component: LogDetailView,
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
};

export default meta;
type Story = StoryObj<typeof LogDetailView>;

export const NotAuthenticated: Story = {
  args: {
    isAuthenticated: false,
    authLoading: false,
    log: undefined,
  },
};

export const Loading: Story = {
  args: {
    isAuthenticated: true,
    logLoading: true,
    log: undefined,
  },
};

export const NotFound: Story = {
  args: {
    isAuthenticated: true,
    log: undefined,
    logLoading: false,
  },
};

export const LoadError: Story = {
  args: {
    isAuthenticated: true,
    log: undefined,
    logError: new Error("Failed to load log details. Please try again."),
  },
};

export const Pending: Story = {
  args: {
    log: {
      ...mockLog,
      status: { ...mockJobStatus, state: "pending" },
    },
  },
};

export const Scheduled: Story = {
  args: {
    log: {
      ...mockLog,
      status: { ...mockJobStatus, state: "scheduled" },
    },
  },
};

export const Processing: Story = {
  args: {
    log: {
      ...mockLog,
      status: {
        ...mockJobStatus,
        state: "running",
        attempted_at: "2026-01-10T14:31:00Z",
      },
    },
  },
};

export const Completed: Story = {
  args: {
    log: {
      ...mockLog,
      status: {
        ...mockJobStatus,
        state: "completed",
        attempted_at: "2026-01-10T14:31:00Z",
        finalized_at: "2026-01-10T14:35:00Z",
      },
    },
  },
};

export const ReparseInProgress: Story = {
  args: {
    log: {
      ...mockLog,
      status: {
        ...mockJobStatus,
        kind: "reparse_log",
        state: "running",
        attempted_at: "2026-01-10T15:00:00Z",
      },
    },
  },
};

export const ReparseCompleted: Story = {
  args: {
    log: {
      ...mockLog,
      status: {
        ...mockJobStatus,
        kind: "reparse_log",
        state: "completed",
        attempted_at: "2026-01-10T15:00:00Z",
        finalized_at: "2026-01-10T15:02:00Z",
      },
    },
  },
};

export const Reparsing: Story = {
  args: {
    log: {
      ...mockLog,
      status: {
        ...mockJobStatus,
        state: "completed",
        finalized_at: "2026-01-10T14:35:00Z",
      },
    },
    isReparsing: true,
  },
};



export const Retryable: Story = {
  args: {
    log: {
      ...mockLog,
      status: {
        ...mockJobStatus,
        state: "retryable",
        attempted_at: "2026-01-10T14:31:00Z",
        errors: [
          {
            at: "2026-01-10T14:32:00Z",
            attempt: 1,
            error: "Connection timeout while processing log file",
            trace: "",
          },
        ],
      },
    },
  },
};

export const Failed: Story = {
  args: {
    log: {
      ...mockLog,
      status: {
        ...mockJobStatus,
        state: "discarded",
        attempt: 3,
        max_attempts: 3,
        attempted_at: "2026-01-10T14:31:00Z",
        finalized_at: "2026-01-10T14:35:00Z",
        errors: [
          {
            at: "2026-01-10T14:32:00Z",
            attempt: 1,
            error: "Connection timeout while processing log file",
            trace: "",
          },
          {
            at: "2026-01-10T14:34:00Z",
            attempt: 2,
            error: "Database connection failed during processing",
            trace: "",
          },
          {
            at: "2026-01-10T14:35:00Z",
            attempt: 3,
            error: "Invalid log format: expected COMBAT_LOG_VERSION header",
            trace: "goroutine 1 [running]:\nmain.processLog()\n\t/app/process.go:42\nmain.main()\n\t/app/main.go:15",
          },
        ],
      },
    },
  },
};

export const Cancelled: Story = {
  args: {
    log: {
      ...mockLog,
      status: {
        ...mockJobStatus,
        state: "cancelled",
        finalized_at: "2026-01-10T14:33:00Z",
      },
    },
  },
};

export const CancelledWithErrors: Story = {
  args: {
    log: {
      ...mockLog,
      status: {
        ...mockJobStatus,
        state: "cancelled",
        attempt: 2,
        max_attempts: 3,
        attempted_at: "2026-01-10T14:31:00Z",
        finalized_at: "2026-01-10T14:33:00Z",
        errors: [
          {
            at: "2026-01-10T14:31:30Z",
            attempt: 1,
            error: "Connection timeout during processing",
            trace: "",
          },
          {
            at: "2026-01-10T14:32:00Z",
            attempt: 2,
            error: "Job cancelled by user request",
            trace: "",
          },
        ],
      },
    },
  },
};

export const DeleteConfirmation: Story = {
  args: {
    log: mockLog,
    showDeleteConfirm: true,
  },
};

export const Deleting: Story = {
  args: {
    log: mockLog,
    showDeleteConfirm: true,
    isDeleting: true,
  },
};

export const SingleFile: Story = {
  args: {
    log: {
      ...mockLog,
      files: [mockLog.files[0]],
      status: { ...mockJobStatus, state: "completed", finalized_at: "2026-01-10T14:35:00Z" },
    },
  },
};

export const NoFiles: Story = {
  args: {
    log: {
      ...mockLog,
      files: [],
    },
  },
};
