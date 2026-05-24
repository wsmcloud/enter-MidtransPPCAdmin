const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendBrevoEmail(opts: {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}) {
  const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY not configured");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: "IklanCuan", email: "otp@iklancuan.com" },
      to: [{ email: opts.to, name: opts.toName || opts.to }],
      subject: opts.subject,
      htmlContent: opts.htmlContent,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Brevo error: ${JSON.stringify(data)}`);
  }
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { to, toName, subject, htmlContent } = await req.json();

    if (!to || !subject || !htmlContent) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, htmlContent" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const result = await sendBrevoEmail({ to, toName, subject, htmlContent });
    console.log(`Email sent to ${to}: ${subject}`);

    return new Response(JSON.stringify({ success: true, messageId: result.messageId }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
