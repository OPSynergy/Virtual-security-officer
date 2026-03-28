import { Link } from "react-router-dom";
import { Button } from "./ui/button";

function DemoBanner({ onDismiss }) {
  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-amber-100 shadow-lg shadow-amber-900/20 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-amber-50">Demo Mode — Viewing sample scan for demo-company.com | Virtual Security Officer</p>
          <p className="text-sm text-amber-200/80">Sign up to scan your own domain with Virtual Security Officer</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="secondary">Sign Up Free</Button>
          </Link>
          <button className="rounded px-2 py-1 text-sm text-amber-200/80 hover:bg-amber-900/50 hover:text-amber-50" onClick={onDismiss}>
            X
          </button>
        </div>
      </div>
    </div>
  );
}

export default DemoBanner;
