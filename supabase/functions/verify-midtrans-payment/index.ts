import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function creditReferralBonus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  transactionId: string,
  depositAmount: number
) {
  try {
    // Get user's referrer
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("referred_by")
      .eq("id", userId)
      .single();

    if (!userProfile?.referred_by) return;

    const referrerId = userProfile.referred_by;
    const commissionAmount = Math.floor(depositAmount * 0.02); // 2%

    if (commissionAmount <= 0) return;

    // Check if referral commission already given for this transaction
    const { data: existing } = await supabase
      .from("referral_commissions")
      .select("id")
      .eq("transaction_id", transactionId)
      .maybeSingle();

    if (existing) {
      console.log("Referral commission already credited for transaction:", transactionId);
      return;
    }

    // Get referrer's current bonus balance
    const { data: referrer } = await supabase
      .from("profiles")
      .select("bonus_balance")
      .eq("id", referrerId)
      .single();

    if (!referrer) return;

    const newBonusBalance = (referrer.bonus_balance || 0) + commissionAmount;

    // Update referrer bonus balance
    await supabase
      .from("profiles")
      .update({ bonus_balance: newBonusBalance })
      .eq("id", referrerId);

    // Record commission
    await supabase.from("referral_commissions").insert({
      referrer_id: referrerId,
      referred_id: userId,
      transaction_id: transactionId,
      deposit_amount: depositAmount,
      commission_amount: commissionAmount,
    });

    console.log(`Referral bonus: ${commissionAmount} credited to ${referrerId} for deposit ${depositAmount} by ${userId}`);
  } catch (err) {
    console.error("Referral bonus error:", err);
  }
}

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

    const { data: transaction, error: txErr } = await supabase
      .from("transactions")
      .select("*")
      .eq("midtrans_order_id", order_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (txErr || !transaction) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (transaction.status === "success") {
      return new Response(JSON.stringify({ status: "success", already_credited: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    console.log("Midtrans status:", JSON.stringify(midtransData));

    const { transaction_status, fraud_status } = midtransData;

    let newStatus = "pending";
    if (transaction_status === "capture" || transaction_status === "settlement") {
      newStatus = (fraud_status === "accept" || !fraud_status) ? "success" : "failed";
    } else if (["cancel", "deny", "expire"].includes(transaction_status)) {
      newStatus = "failed";
    }

    await supabase.from("transactions").update({ status: newStatus }).eq("id", transaction.id);

    if (newStatus === "success") {
      const { data: profile } = await supabase
        .from("profiles").select("balance").eq("id", user.id).single();

      if (profile) {
        const newBalance = (profile.balance || 0) + parseFloat(transaction.amount);
        await supabase.from("profiles").update({ balance: newBalance }).eq("id", user.id);
        console.log(`Balance credited: +${transaction.amount} for ${user.id}`);
      }

      // Credit 2% referral bonus to referrer
      await creditReferralBonus(supabase, user.id, transaction.id, parseFloat(transaction.amount));
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
