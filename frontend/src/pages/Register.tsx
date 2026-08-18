import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "../services/api";

export default function Register() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await register(email, password);
      alert("Account created!");
      navigate("/");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Registration failed.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-violet-500">PricePulse</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-2xl font-semibold mb-2">Create account</h1>
          <p className="text-slate-400 mb-6">
            Start tracking your favourite products.
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
              className="w-full bg-violet-600 hover:bg-violet-500 rounded-lg py-3 font-medium"
            >
              Create account
            </button>
          </form>

          <p className="text-center text-slate-400 mt-6 text-sm">
            Already have an account?
            <Link to="/" className="text-violet-400 ml-2">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}