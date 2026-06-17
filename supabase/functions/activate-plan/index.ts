import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { order_id, plan_id } = await req.json();
    if (!order_id || !plan_id) return new Response(JSON.stringify({ error: "order_id and plan_id required" }), { status: 400, headers: corsHeaders });

    // Idempotency: check if already activated
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, status")
      .eq("midtrans_order_id", order_id)
      .eq("status", "success")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, message: "Already activated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify with Midtrans
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const isProduction = serverKey.startsWith("Mid-server-") && !serverKey.includes("sandbox");
    const baseUrl = isProduction ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";

    const mtRes = await fetch(`${baseUrl}/v2/${order_id}/status`, {
      headers: { Authorization: `Basic ${btoa(`${serverKey}:`)}`, Accept: "application/json" },
    });
    const mtData = await mtRes.json();
    console.log("Midtrans status:", mtData.transaction_status, "for order:", order_id);

    const isSuccess = ["capture", "settlement"].includes(mtData.transaction_status);
    if (!isSuccess) {
      return new Response(JSON.stringify({ error: "Pembayaran belum dikonfirmasi", status: mtData.transaction_status }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get plan
    const { data: plan } = await supabase.from("plans").select("*").eq("id", plan_id).maybeSingle();
    if (!plan) return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers: corsHeaders });

    const expiresAt = plan.duration_days > 0
      ? new Date(Date.now() + plan.duration_days * 86400000).toISOString()
      : null;

    // Activate the plan
    await supabase.from("user_plans").insert({
      user_id: user.id,
      plan_id: plan.id,
      expires_at: expiresAt,
      is_active: true,
    });

    // Update profile
    await supabase.from("profiles").update({
      plan_id: plan.id,
      plan_expires_at: expiresAt,
    }).eq("id", user.id);

    // Update transaction status to success
    await supabase.from("transactions")
      .update({ status: "success" })
      .eq("midtrans_order_id", order_id)
      .eq("user_id", user.id);

    console.log(`Plan ${plan.name} activated for user ${user.id}`);

    return new Response(JSON.stringify({ success: true, plan_name: plan.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("activate-plan error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
