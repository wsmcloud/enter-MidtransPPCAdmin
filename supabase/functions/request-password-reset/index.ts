import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find user in profiles by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("email", email)
      .maybeSingle();

    // Always return success to prevent email enumeration
    if (!profile) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Delete old OTPs for this email
    await supabase.from("password_reset_otps").delete().eq("email", email);

    // Insert new OTP with user_id
    await supabase.from("password_reset_otps").insert({
      email,
      user_id: profile.id,
      otp,
      expires_at: expiresAt,
    });

    const name = profile.full_name || email;

    // Send email via Brevo
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "IklanCuan", email: "otp@iklancuan.com" },
        to: [{ email, name }],
        subject: "Kode Reset Password - IklanCuan",
        htmlContent: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:bold;">Reset Password</h1>
              <p style="color:#fef3c7;margin:8px 0 0;font-size:14px;">IklanCuan - Klik Iklan Dapat Uang</p>
            </div>
            <div style="padding:32px;">
              <p style="color:#374151;font-size:16px;margin:0 0 16px;">Halo <strong>${name}</strong>,</p>
              <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
                Kami menerima permintaan reset password untuk akun Anda. Gunakan kode OTP berikut untuk melanjutkan:
              </p>
              <div style="background:#fef9f0;border:2px solid #f59e0b;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
                <p style="color:#92400e;font-size:13px;margin:0 0 8px;font-weight:bold;">Kode OTP Reset Password</p>
                <p style="color:#d97706;font-size:40px;font-weight:bold;letter-spacing:10px;margin:0;">${otp}</p>
                <p style="color:#9ca3af;font-size:12px;margin:8px 0 0;">Berlaku selama <strong>15 menit</strong></p>
              </div>
              <p style="color:#ef4444;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:0;">
                Jika Anda tidak meminta reset password, abaikan email ini. Akun Anda tetap aman.
              </p>
            </div>
            <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">IklanCuan &mdash; otp@iklancuan.com</p>
            </div>
          </div>
        `,
      }),
    });

    console.log(`Password reset OTP sent to ${email}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("request-password-reset error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
