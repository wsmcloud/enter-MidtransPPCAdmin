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

    const { plan_id } = await req.json();
    if (!plan_id) return new Response(JSON.stringify({ error: "plan_id required" }), { status: 400, headers: corsHeaders });

    // Get plan details
    const { data: plan } = await supabase.from("plans").select("*").eq("id", plan_id).eq("is_active", true).maybeSingle();
    if (!plan) return new Response(JSON.stringify({ error: "Paket tidak ditemukan" }), { status: 404, headers: corsHeaders });
    if (plan.price <= 0) return new Response(JSON.stringify({ error: "Paket gratis tidak perlu pembayaran" }), { status: 400, headers: corsHeaders });

    const { data: profile } = await supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).single();

    const orderId = `PLN-${user.id.slice(0, 8)}-${Date.now()}`;
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const clientKey = Deno.env.get("MIDTRANS_CLIENT_KEY")!;
    const isProduction = serverKey.startsWith("Mid-server-") && !serverKey.includes("sandbox");
    const midtransBaseUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const origin = req.headers.get("origin") || "https://iklancuan.com";

    const midtransPayload = {
      transaction_details: { order_id: orderId, gross_amount: Math.round(plan.price) },
      customer_details: {
        first_name: profile?.full_name || "User",
        email: profile?.email || user.email,
        phone: profile?.phone || "",
      },
      item_details: [{ id: plan.id, price: Math.round(plan.price), quantity: 1, name: `Paket ${plan.name}` }],
      callbacks: {
        finish: `${origin}/dashboard/plans?payment=finish`,
        error: `${origin}/dashboard/plans?payment=error`,
        pending: `${origin}/dashboard/plans?payment=pending`,
      },
    };

    const midtransResponse = await fetch(midtransBaseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(`${serverKey}:`)}` },
      body: JSON.stringify(midtransPayload),
    });

    const midtransData = await midtransResponse.json();
    if (!midtransResponse.ok || !midtransData.token) {
      console.error("Midtrans error:", midtransData);
      return new Response(JSON.stringify({ error: "Gagal membuat transaksi pembayaran" }), { status: 500, headers: corsHeaders });
    }

    // Record pending plan_purchase transaction
    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "plan_purchase",
      amount: plan.price,
      status: "pending",
      midtrans_order_id: orderId,
      midtrans_token: midtransData.token,
      midtrans_redirect_url: midtransData.redirect_url,
      notes: `Pembelian paket ${plan.name} via Midtrans`,
    });

    return new Response(JSON.stringify({
      token: midtransData.token,
      redirect_url: midtransData.redirect_url,
      order_id: orderId,
      client_key: clientKey,
      is_production: isProduction,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("midtrans-plan-purchase error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
