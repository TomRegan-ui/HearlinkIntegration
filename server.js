require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const hearlink = axios.create({
  baseURL: process.env.HEARLINK_API_URL || "https://api.hearlink.co.uk",
  headers: {
    Authorization: `Bearer ${process.env.HEARLINK_API_KEY}`,
    "Content-Type": "application/json"
  }
});

/*
|--------------------------------------------------------------------------
| HOME
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.send("HearLink Integration Running");
});

/*
|--------------------------------------------------------------------------
| TEST
|--------------------------------------------------------------------------
*/

app.get("/test", (req, res) => {
  res.json({
    status: "working"
  });
});

/*
|--------------------------------------------------------------------------
| GET ALL PATIENTS
|--------------------------------------------------------------------------
*/

app.get("/patients", async (req, res) => {
  try {
    const response = await hearlink.get("/patients");

    res.json(response.data);
  } catch (error) {
    console.error("Patients Error:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| LOOKUP PATIENT BY PHONE NUMBER
|--------------------------------------------------------------------------
|
| Example:
| /lookup?number=07700123456
|
*/

app.get("/lookup", async (req, res) => {
  try {
    const number = req.query.number;

    if (!number) {
      return res.status(400).json({
        success: false,
        message: "Please provide a phone number using ?number="
      });
    }

    const response = await hearlink.get("/patients", {
      params: {
        phoneNumber: number
      }
    });

    const patients = response.data?.data || [];

    res.json({
      success: true,
      count: patients.length,
      patient: patients.length > 0 ? patients[0] : null
    });

  } catch (error) {
    console.error("Lookup Error:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
