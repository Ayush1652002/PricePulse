import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register, verifyOtp, resendOtp } from "../services/api";

export default function Register() {
  const navigate = useNavigate();

  // Step 1 state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"register" | "otp">("register");
  const [loading, setLoading] = useState(false);

  // Step 2 state
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start 60s resend countdown when OTP step begins
  useEffect(() => {
    if (step === "otp") {
      startResendTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  function startResendTimer() {
    setResendCooldown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Step 1: Submit email + password → send OTP
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password);
      setStep("otp");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP → create account → redirect
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    setVerifying(true);
    try {
      await verifyOtp(email, otp);
      navigate("/feed");
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Invalid OTP.");
    } finally {
      setVerifying(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setResending(true);
    setOtpError("");
    try {
      await resendOtp(email);
      startResendTimer();
    } catch (error) {
      setOtpError(error instanceof Error ? error.message : "Could not resend OTP.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-violet-500">PricePulse</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">

          {/* ── STEP 1: Email + Password ── */}
          {step === "register" && (
            <>
              <h1 className="text-2xl font-semibold mb-2">Create account</h1>
              <p className="text-slate-400 mb-6">
                Start tracking your favourite products.
              </p>

              <form onSubmit={handleRegister} className="space-y-4">
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
                  placeholder="Password (min. 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3"
                  minLength={6}
                  required
                />

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-lg py-3 font-medium transition-colors"
                >
                  {loading ? "Sending OTP..." : "Create account"}
                </button>
              </form>

              <p className="text-center text-slate-400 mt-6 text-sm">
                Already have an account?
                <Link to="/" className="text-violet-400 ml-2">Login</Link>
              </p>
            </>
          )}

          {/* ── STEP 2: OTP Verification ── */}
          {step === "otp" && (
            <>
              <h1 className="text-2xl font-semibold mb-2">Verify your email</h1>
              <p className="text-slate-400 mb-1">
                We sent a 6-digit code to
              </p>
              <p className="text-violet-400 font-medium mb-6">{email}</p>

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-center text-2xl tracking-widest font-bold"
                  maxLength={6}
                  required
                />

                {otpError && (
                  <p className="text-amber-400 text-sm text-center">{otpError}</p>
                )}

                <button
                  type="submit"
                  disabled={verifying || otp.length !== 6}
                  className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 rounded-lg py-3 font-medium transition-colors"
                >
                  {verifying ? "Verifying..." : "Verify & Continue"}
                </button>
              </form>

              <div className="mt-4 text-center">
                {resendCooldown > 0 ? (
                  <p className="text-slate-500 text-sm">
                    Resend OTP in <span className="text-slate-300">{resendCooldown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="text-violet-400 hover:text-violet-300 text-sm disabled:opacity-50"
                  >
                    {resending ? "Resending..." : "Resend OTP"}
                  </button>
                )}
              </div>

              <button
                onClick={() => { setStep("register"); setOtp(""); setOtpError(""); }}
                className="mt-4 w-full text-slate-500 hover:text-slate-300 text-sm"
              >
                ← Change email or password
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}