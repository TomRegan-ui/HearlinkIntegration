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
    "X-API-Key": process.env.HEARLINK_API_KEY,
    "Content-Type": "application/json"
  }
});

/*
|--------------------------------------------------------------------------
| Helper Function - Split Full Name
|--------------------------------------------------------------------------
*/

function splitName(fullName) {

  if (!fullName) {
    return {
      firstName: "",
      lastName: ""
    };
  }

  const parts = fullName.trim().split(" ");

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || ""
  };

}

/*
|--------------------------------------------------------------------------
| Helper Function - Normalise Phone Number
|--------------------------------------------------------------------------
*/

function normaliseNumber(number = "") {
  return number
    .replace(/\s/g, "")
    .replace(/^\+44/, "0");
}

/*
|--------------------------------------------------------------------------
| Home
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
| Environment Variable Check
|--------------------------------------------------------------------------
*/

app.get("/env-check", (req, res) => {
  res.json({
    apiConfigured: !!process.env.HEARLINK_API_KEY,
    apiKeyLength: process.env.HEARLINK_API_KEY
      ? process.env.HEARLINK_API_KEY.length
      : 0,
    apiUrl: process.env.HEARLINK_API_URL
  });
});

/*
|--------------------------------------------------------------------------
| Get All Patients
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
| Lookup Patient By Number
|--------------------------------------------------------------------------
*/

app.get("/lookup", async (req, res) => {

  try {

    const number = normaliseNumber(
      req.query.number ||
      req.query.phone ||
      ""
    );

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
| Yeastar Contact Lookup
|--------------------------------------------------------------------------
*/

app.get("/yeastar/contact", async (req, res) => {

  console.log("=================================");
  console.log("YEASTAR REQUEST RECEIVED");
  console.log("QUERY:", req.query);

  try {

    const phone = normaliseNumber(
      req.query.phone ||
      req.query.number ||
      ""
    );

    console.log("NORMALISED PHONE:", phone);

    if (!phone) {
      return res.status(400).json({
        error: "phone parameter required"
      });
    }

    const response = await hearlink.get("/patients", {
      params: {
        phoneNumber: phone
      }
    });

    const patients = response.data?.data || [];

    console.log("PATIENTS FOUND:", patients.length);

    if (patients.length === 0) {
      return res.json([]);
    }

    const patient = patients[0];

    const name = splitName(patient.fullName);

    return res.json([
      {
        id: patient.uid,
        first_name: name.firstName,
        last_name: name.lastName,
        full_name: patient.fullName,
        phone: patient.phoneNumber,
        mobile: patient.secondaryPhoneNumber || "",
        email: patient.emailAddress || ""
      }
    ]);

  } catch (error) {

    console.error(
      "Yeastar Lookup Error:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error: error.response?.data || error.message
    });

  }

});

/*
|--------------------------------------------------------------------------
| Contact URL Endpoint
|--------------------------------------------------------------------------
*/

app.get("/yeastar/contacturl", async (req, res) => {

  try {

    const phone = normaliseNumber(
      req.query.phone ||
      req.query.number ||
      ""
    );

    console.log("CONTACTURL QUERY:", req.query);
    console.log("CONTACTURL PHONE:", phone);

    if (!phone) {
      return res.status(400).json({
        error: "phone parameter required"
      });
    }

    const response = await hearlink.get("/patients", {
      params: {
        phoneNumber: phone
      }
    });

    const patient = response.data?.data?.[0];

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    res.json({
      uid: patient.uid,
      fullName: patient.fullName
    });

  } catch (error) {

    console.error(
      "Contact URL Error:",
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
