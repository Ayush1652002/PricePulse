import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { login, googleLogin } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      navigate("/feed");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-violet-500">PricePulse</div>
          <p className="text-slate-400 mt-2">Track prices. Buy at the right time.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-2xl font-semibold mb-2">Welcome back</h1>
          <p className="text-slate-400 mb-6">Login to continue to PricePulse.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-lg py-3 font-medium"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px bg-slate-700 flex-1" />
            <span className="text-slate-500 text-sm">OR</span>
            <div className="h-px bg-slate-700 flex-1" />
          </div>

          <div className="google-login-wrap w-full flex justify-center overflow-hidden">
            <GoogleLogin
              width="350"
              theme="filled_black"
              shape="rectangular"
              size="large"
              onSuccess={async (credentialResponse) => {
                try {
                  await googleLogin(credentialResponse.credential!);
                  navigate("/feed");
                } catch (error) {
                  alert(error instanceof Error ? error.message : "Google login failed.");
                }
              }}
              onError={() => alert("Google login failed.")}
            />
          </div>

          <p className="text-center text-slate-400 mt-6 text-sm">
            Don't have an account?
            <Link to="/register" className="text-violet-400 ml-2">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
