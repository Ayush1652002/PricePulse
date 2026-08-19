import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getProfile } from "../services/api";

export default function ProtectedRoute() {
  const [state, setState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    getProfile().then(() => setState("authenticated")).catch(() => setState("unauthenticated"));
  }, []);

  if (state === "loading") return <div className="min-h-screen bg-slate-950 text-slate-400 grid place-items-center">Checking your session...</div>;
  return state === "authenticated" ? <Outlet /> : <Navigate to="/" replace />;
}
