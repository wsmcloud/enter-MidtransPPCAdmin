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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user from token
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id } = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Verifying payment for order: ${order_id}, user: ${user.id}`);

    // Find transaction — only allow user's own
    const { data: transaction, error: txErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("midtrans_order_id", order_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (txErr || !transaction) {
      console.error("Transaction not found:", order_id, txErr);
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already credited
    if (transaction.status === "success") {
      console.log("Transaction already success:", order_id);
      return new Response(JSON.stringify({ status: "success", already_credited: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query Midtrans status API
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const isProduction = !serverKey.includes("SB-");
    const baseUrl = isProduction
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com";

    const statusRes = await fetch(`${baseUrl}/v2/${order_id}/status`, {
      headers: {
        "Authorization": `Basic ${btoa(serverKey + ":")}`,
        "Content-Type": "application/json",
      },
    });

    const midtransData = await statusRes.json();
    console.log("Midtrans status response:", JSON.stringify(midtransData));

    const { transaction_status, fraud_status } = midtransData;

    let newStatus = "pending";
    if (transaction_status === "capture" || transaction_status === "settlement") {
      newStatus = (fraud_status === "accept" || !fraud_status) ? "success" : "failed";
    } else if (["cancel", "deny", "expire"].includes(transaction_status)) {
      newStatus = "failed";
    } else if (transaction_status === "pending") {
      newStatus = "pending";
    }

    // Update transaction status
    await supabase
      .from("transactions")
      .update({ status: newStatus })
      .eq("id", transaction.id);

    // Credit balance if success
    if (newStatus === "success") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", user.id)
        .single();

      if (profile) {
        const newBalance = (profile.balance || 0) + parseFloat(transaction.amount);
        await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", user.id);

        console.log(`Balance credited: ${user.id} +${transaction.amount} = ${newBalance}`);
      }
    }

    return new Response(JSON.stringify({ status: newStatus, midtrans_status: transaction_status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("verify-midtrans-payment error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
