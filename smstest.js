import smsService from "./twilioService.js"; // path to your Twilio code

// POST /api/test-delivery-sms
const testDeliverySMS = async (req, res) => {
  try {
    await smsService.sendNewOrderToDeliveryBoys(
      {
        body: {
          phones: req.body.phones || ["+919876543210"], // replace with your test number
          orderId: req.body.orderId || "TEST123"
        }
      },
      res
    );
  } catch (error) {
    console.error("Test SMS failed:", error);
    res.status(500).json({ error: "Test failed" });
  }
};

export default testDeliverySMS;
