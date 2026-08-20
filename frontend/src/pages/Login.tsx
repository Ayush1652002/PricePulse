import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { login, googleLogin } from "../services/api";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const onGoogleSuccess = async (credentialResponse: any) => {
    try {
      await googleLogin(credentialResponse.credential!);
      navigate("/feed");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Google login failed."
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-violet-500">PricePulse</div>
          <p className="text-slate-400 mt-2">
            Track prices. Buy at the right time.
          </p>
          <div className="mt-3 inline-block bg-violet-950/60 border border-violet-800/60 text-violet-300 text-xs px-3 py-1.5 rounded-lg">
            ✨ Currently supporting automatic price tracking for Amazon & Flipkart (full & short links). Meesho, Croma & eBay coming soon!
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-2xl font-semibold mb-2">Welcome back</h1>
          <p className="text-slate-400 mb-6">
            Login to continue to PricePulse.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
              required
            />
            <div className="relative">
  <input
    type={showPassword ? "text" : "password"}
    placeholder="Password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 pr-12"
    required
  />

  <button
    type="button"
    onClick={() => setShowPassword((prev) => !prev)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
    aria-label={showPassword ? "Hide password" : "Show password"}
  >
    {showPassword ? "🙈" : "👁️"}
  </button>
</div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-lg py-3 font-medium transition-colors"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px bg-slate-700 flex-1" />
            <span className="text-slate-500 text-sm">OR</span>
            <div className="h-px bg-slate-700 flex-1" />
          </div>

          <div className="relative w-full" style={{ height: "44px" }}>
            <div
              className="absolute inset-0 flex items-center justify-center gap-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-medium"
              style={{ pointerEvents: "none" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </div>

            <div
              className="absolute inset-0 overflow-hidden rounded-xl cursor-pointer"
              style={{ opacity: 0.01 }}
            >
              <GoogleLogin
                width={500}
                size="large"
                theme="filled_black"
                shape="rectangular"
                onSuccess={onGoogleSuccess}
                onError={() => alert("Google login failed.")}
              />
            </div>
          </div>

          <p className="text-center text-slate-400 mt-6 text-sm">
            Don't have an account?
            <Link to="/register" className="text-violet-400 ml-2">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}