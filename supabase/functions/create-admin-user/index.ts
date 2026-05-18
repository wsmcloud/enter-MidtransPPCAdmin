import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const adminEmail = "btiums@gmail.com";
  const adminPassword = "wsm12345";

  // Check if user already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", adminEmail)
    .maybeSingle();

  if (existing) {
    // Just promote to admin
    await supabase.from("profiles").update({ role: "admin" }).eq("email", adminEmail);
    return new Response(
      JSON.stringify({ success: true, message: "User already exists, promoted to admin", id: existing.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Create new user
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: {
      full_name: "Administrator",
      role: "admin",
    },
  });

  if (error) {
    console.error("Create user error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Promote to admin role
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ role: "admin", full_name: "Administrator" })
    .eq("id", data.user.id);

  if (updateError) {
    // Try insert if update fails
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: "Administrator",
      email: adminEmail,
      role: "admin",
    });
  }

  return new Response(
    JSON.stringify({ success: true, message: "Admin created successfully", id: data.user.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
