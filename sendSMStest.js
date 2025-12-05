import twilio from "twilio";

const accountSid = "ACb963d22e66c7e7b9dbac6cfad10a405a";
const authToken = "1f6bfe7fea07d7d3005d4a1d10bb0fc4";
const fromNumber = "+16824705397"; // e.g. +16824705397
const toNumber = "+919322506730"; // your phone number in E.164 format (+91XXXXXXXXXX)

const client = twilio(accountSid, authToken);

(async () => {
  try {
    const message = await client.messages.create({
      body: "✅ Test message from Twilio (FarmFerry)",
      from: fromNumber,
      to: toNumber,
    });

    console.log("✅ SMS sent successfully!");
    console.log("SID:", message.sid);
  } catch (error) {
    console.error("❌ SMS failed:", error);
  }
})();
