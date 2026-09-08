require("dotenv").config();
const axios = require("axios");

async function testFirecrawl() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const baseUrl = process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev";
  console.log("Using API Key:", apiKey ? apiKey.slice(0, 8) + "..." : "NONE");
  console.log("Using Base URL:", baseUrl);

  try {
    const res = await axios.post(
      `${baseUrl}/v1/scrape`,
      { url: "https://example.com" },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("SUCCESS:", res.status, res.data);
  } catch (err) {
    if (err.response) {
      console.log("RESPONSE ERROR STATUS:", err.response.status);
      console.log("RESPONSE ERROR DATA:", JSON.stringify(err.response.data));
    } else {
      console.log("NETWORK/OTHER ERROR:", err.message);
    }
  }
}

testFirecrawl();
