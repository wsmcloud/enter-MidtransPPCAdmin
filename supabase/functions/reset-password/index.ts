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
    const { email, otp, new_password } = await req.json();

    if (!email || !otp || !new_password) {
      return new Response(JSON.stringify({ error: "Email, OTP, dan password baru wajib diisi" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: "Password minimal 6 karakter" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find and validate OTP
    const { data: otpRecord } = await supabase
      .from("password_reset_otps")
      .select("*")
      .eq("email", email)
      .eq("otp", otp)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!otpRecord) {
      return new Response(JSON.stringify({ error: "Kode OTP tidak valid atau sudah kadaluwarsa" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Mark OTP as used
    await supabase.from("password_reset_otps").update({ used: true }).eq("id", otpRecord.id);

    // Update user password using stored user_id
    const { error: updateError } = await supabase.auth.admin.updateUserById(otpRecord.user_id, {
      password: new_password,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    console.log(`Password reset successful for ${email}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("reset-password error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
