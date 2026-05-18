import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { amount } = await req.json();

    if (!amount || amount < 10000) {
      return new Response(
        JSON.stringify({ error: "Minimum deposit adalah Rp 10.000" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .single();

    const orderId = `DEP-${user.id.slice(0, 8)}-${Date.now()}`;
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const clientKey = Deno.env.get("MIDTRANS_CLIENT_KEY")!;
    const isProduction = serverKey.startsWith("Mid-server-") && !serverKey.includes("sandbox");
    const midtransBaseUrl = isProduction
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const origin = req.headers.get("origin") || "https://your-app.com";

    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(amount),
      },
      customer_details: {
        first_name: profile?.full_name || "User",
        email: profile?.email || user.email,
        phone: profile?.phone || "",
      },
      callbacks: {
        finish: `${origin}/dashboard/deposit?status=finish`,
        error: `${origin}/dashboard/deposit?status=error`,
        pending: `${origin}/dashboard/deposit?status=pending`,
      },
    };

    const encodedKey = btoa(`${serverKey}:`);
    const midtransResponse = await fetch(midtransBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encodedKey}`,
      },
      body: JSON.stringify(midtransPayload),
    });

    const midtransData = await midtransResponse.json();

    if (!midtransResponse.ok || !midtransData.token) {
      console.error("Midtrans error:", midtransData);
      return new Response(
        JSON.stringify({ error: "Gagal membuat transaksi pembayaran", detail: midtransData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "deposit",
      amount: amount,
      status: "pending",
      midtrans_order_id: orderId,
      midtrans_token: midtransData.token,
      midtrans_redirect_url: midtransData.redirect_url,
      notes: `Deposit via Midtrans`,
    });

    return new Response(
      JSON.stringify({
        token: midtransData.token,
        redirect_url: midtransData.redirect_url,
        order_id: orderId,
        client_key: clientKey,
        is_production: isProduction,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
