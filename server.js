require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

/*
|--------------------------------------------------------------------------
| HearLink API Configuration
|--------------------------------------------------------------------------
*/

const hearlink = axios.create({
  baseURL: process.env.HEARLINK_API_URL || "https://api.hearlink.co.uk",
  headers: {
    Authorization: `Bearer ${process.env.HEARLINK_API_KEY}`,
    "Content-Type": "application/json"
  }
});

/*
|--------------------------------------------------------------------------
| Home Page
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.send("SERVER IS WORKING");
});

/*
|--------------------------------------------------------------------------
| Test Route
|--------------------------------------------------------------------------
*/

app.get("/test", (req, res) => {
  res.json({
    status: "ok"
  });
});

/*
|--------------------------------------------------------------------------
| Get All HearLink Patients
|--------------------------------------------------------------------------
*/

app.get("/patients", async (req, res) => {
  try {
    const response = await hearlink.get("/patients");

    res.json(response.data);

  } catch (error) {

    console.error(
      "Patients Error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| Lookup Patient By Phone Number
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
        message: "Please provide a number using ?number="
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
      found: patients.length > 0,
      count: patients.length,
      patient: patients[0] || null
    });

  } catch (error) {

    console.error(
      "Lookup Error:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(`Listening on ${PORT}`);
});
