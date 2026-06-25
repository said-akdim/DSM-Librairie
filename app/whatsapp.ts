const WA_PHONE_ID = "1222766347580412";
const WA_TOKEN = "EAAOwrZAgt5jABR19GTxxyVkGP6p4ABf8ZAGdBOebzZCcpddC5DRbwd71GeA7dsJPENDLzq6Vf7OwrOcWJuYwZBzpeZCLROeUaHQ9sjnbGZAiKrWXeSZCqpyX13eUZCJmYn1SGG4uuIH5PPopJz3BAECRFv1GNtZCoaKui8FwRrvNyb2r5b78N0395ZAtG8qKmAUQFN2gZDZD";

function normaliserTelephone(phone: string): string | null {
  if (!phone) return null;
  let p = phone.replace(/[\s\-().+]/g, "");
  if (p.startsWith("0")) p = "212" + p.slice(1);
  if (!p.startsWith("212")) p = "212" + p.slice(-9);
  return p.length >= 12 ? p : null;
}

export async function envoyerWhatsApp(phone: string | null | undefined, message: string): Promise<boolean> {
  const to = normaliserTelephone(phone || "");
  if (!to) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WA_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: message },
      }),
    });
    return res.ok;
  } catch { return false; }
}
