import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

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

async function processNotification(supabase: ReturnType<typeof createClient>, notification: Record<string, string>) {
  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = notification;

  // Verify signature
  const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
  const expectedSignature = await sha512(`${order_id}${status_code}${gross_amount}${serverKey}`);

  if (signature_key !== expectedSignature) {
    console.error("Invalid signature for order:", order_id);
    return { error: "Invalid signature", status: 403 };
  }

  // Find transaction
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .eq("midtrans_order_id", order_id)
    .maybeSingle();

  if (txError || !transaction) {
    console.error("Transaction not found:", order_id, txError);
    return { error: "Transaction not found", status: 404 };
  }

  // Skip if already processed
  if (transaction.status === "success") {
    console.log("Transaction already processed:", order_id);
    return { message: "Already processed", status: 200 };
  }

  let newStatus = "pending";
  if (transaction_status === "capture" || transaction_status === "settlement") {
    newStatus = (fraud_status === "accept" || !fraud_status) ? "success" : "failed";
  } else if (["cancel", "deny", "expire"].includes(transaction_status)) {
    newStatus = "failed";
  }

  // Update transaction
  const { error: updateErr } = await supabase
    .from("transactions")
    .update({ status: newStatus })
    .eq("id", transaction.id);

  if (updateErr) {
    console.error("Failed to update transaction:", updateErr);
    return { error: "Failed to update", status: 500 };
  }

  // Credit balance if success
  if (newStatus === "success") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", transaction.user_id)
      .single();

    if (profile) {
      const newBalance = (profile.balance || 0) + parseFloat(transaction.amount);
      const { error: balErr } = await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", transaction.user_id);

      if (balErr) console.error("Failed to update balance:", balErr);
      else console.log(`Balance updated for user ${transaction.user_id}: +${transaction.amount}`);
    }
  }

  console.log(`Transaction ${order_id} updated to: ${newStatus}`);
  return { message: "OK", status: newStatus, httpStatus: 200 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("Midtrans notification received, method:", req.method);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const notification = await req.json();
    console.log("Notification payload:", JSON.stringify(notification));

    const result = await processNotification(supabase, notification);
    const httpStatus = result.httpStatus || (result.status === 200 ? 200 : result.status as number) || 200;

    return new Response(JSON.stringify(result), {
      status: typeof httpStatus === "number" ? httpStatus : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Notification handler error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
