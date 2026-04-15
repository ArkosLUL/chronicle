import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { fetchSharedView } from "@/api/queries";

export function SharedViewRedirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const shared = await fetchSharedView(code);
        if (cancelled) return;
        const identifier = shared.instance_slug || shared.instance_id;
        navigate(`/instances/${identifier}?import=${encodeURIComponent(code)}`, { replace: true });
      } catch {
        if (cancelled) return;
        toast.error("Share link not found");
        navigate("/", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return <div className="p-6 text-sm text-muted-foreground">Opening shared view…</div>;
}
