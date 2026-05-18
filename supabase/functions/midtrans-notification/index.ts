import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha512(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const notification = await req.json();
    console.log("Midtrans notification received:", JSON.stringify(notification));

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = notification;

    // Verify signature
    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const expectedSignature = await sha512(`${order_id}${status_code}${gross_amount}${serverKey}`);

    if (signature_key !== expectedSignature) {
      console.error("Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find transaction
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("midtrans_order_id", order_id)
      .maybeSingle();

    if (txError || !transaction) {
      console.error("Transaction not found:", order_id);
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if already processed
    if (transaction.status === "success") {
      return new Response(JSON.stringify({ message: "Already processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newStatus = "pending";

    if (transaction_status === "capture" || transaction_status === "settlement") {
      if (fraud_status === "accept" || !fraud_status) {
        newStatus = "success";
      } else {
        newStatus = "failed";
      }
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

    // If success, add balance to user
    if (newStatus === "success") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", transaction.user_id)
        .single();

      if (profile) {
        const newBalance = (profile.balance || 0) + parseFloat(transaction.amount);
        await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", transaction.user_id);
      }
    }

    console.log(`Transaction ${order_id} updated to status: ${newStatus}`);

    return new Response(
      JSON.stringify({ message: "OK", status: newStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Notification error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
