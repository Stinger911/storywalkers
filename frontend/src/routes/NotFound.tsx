import { Button } from "~/components/ui/button";
import { useNavigate } from "@solidjs/router";

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div class="page">
      <div class="panel panel--center">
        <h2>Page not found</h2>
        <p>The page you are looking for does not exist.</p>
        <Button class="btn" onClick={() => navigate("/", { replace: true })}>
          Back home
        </Button>
      </div>
    </div>
  );
}
