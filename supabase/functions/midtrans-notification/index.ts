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

async function creditReferralBonus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  transactionId: string,
  depositAmount: number
) {
  try {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("referred_by")
      .eq("id", userId)
      .single();

    if (!userProfile?.referred_by) return;

    const referrerId = userProfile.referred_by;
    const commissionAmount = Math.floor(depositAmount * 0.02);
    if (commissionAmount <= 0) return;

    const { data: existing } = await supabase
      .from("referral_commissions")
      .select("id")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (existing) return;

    const { data: referrer } = await supabase
      .from("profiles")
      .select("bonus_balance")
      .eq("id", referrerId)
      .single();

    if (!referrer) return;

    await supabase
      .from("profiles")
      .update({ bonus_balance: (referrer.bonus_balance || 0) + commissionAmount })
      .eq("id", referrerId);

    await supabase.from("referral_commissions").insert({
      referrer_id: referrerId,
      referred_id: userId,
      transaction_id: transactionId,
      deposit_amount: depositAmount,
      commission_amount: commissionAmount,
    });

    console.log(`Referral bonus: ${commissionAmount} to ${referrerId}`);
  } catch (err) {
    console.error("Referral bonus error:", err);
  }
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

    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = notification;

    const serverKey = Deno.env.get("MIDTRANS_SERVER_KEY")!;
    const expectedSignature = await sha512(`${order_id}${status_code}${gross_amount}${serverKey}`);

    if (signature_key !== expectedSignature) {
      console.error("Invalid signature for order:", order_id);
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    if (transaction.status === "success") {
      return new Response(JSON.stringify({ message: "Already processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let newStatus = "pending";
    if (transaction_status === "capture" || transaction_status === "settlement") {
      newStatus = (fraud_status === "accept" || !fraud_status) ? "success" : "failed";
    } else if (["cancel", "deny", "expire"].includes(transaction_status)) {
      newStatus = "failed";
    }

    await supabase.from("transactions").update({ status: newStatus }).eq("id", transaction.id);

    if (newStatus === "success") {
      const { data: profile } = await supabase
        .from("profiles").select("balance").eq("id", transaction.user_id).single();

      if (profile) {
        const newBalance = (profile.balance || 0) + parseFloat(transaction.amount);
        await supabase.from("profiles").update({ balance: newBalance }).eq("id", transaction.user_id);
        console.log(`Balance updated for user ${transaction.user_id}: +${transaction.amount}`);
      }

      await creditReferralBonus(supabase, transaction.user_id, transaction.id, parseFloat(transaction.amount));
    }

    return new Response(JSON.stringify({ message: "OK", status: newStatus }), {
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
