require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cron = require("node-cron");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

const HEARLINK_API_URL =
  process.env.HEARLINK_API_URL || "https://api.hearlink.co.uk";

const HEARLINK_API_KEY = process.env.HEARLINK_API_KEY;

const YEASTAR_HOST = process.env.YEASTAR_HOST;
const YEASTAR_USERNAME = process.env.YEASTAR_USERNAME;
const YEASTAR_PASSWORD = process.env.YEASTAR_PASSWORD;
const YEASTAR_PHONEBOOK_ID = process.env.YEASTAR_PHONEBOOK_ID;

/*
|--------------------------------------------------------------------------
| HEARLINK CLIENT
|--------------------------------------------------------------------------
*/

const hearlink = axios.create({
  baseURL: HEARLINK_API_URL,
  headers: {
    Authorization: `Bearer ${HEARLINK_API_KEY}`,
    "Content-Type": "application/json",
  },
});

async function findPatientByPhone(phoneNumber) {
  try {
    const response = await hearlink.get("/patients", {
      params: {
        phoneNumber,
      },
    });

    if (
      response.data &&
      response.data.data &&
      response.data.data.length > 0
    ) {
      return response.data.data[0];
    }

    return null;
  } catch (err) {
    console.error("HearLink lookup failed:", err.message);
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| YEASTAR AUTH
|--------------------------------------------------------------------------
*/

let yeastarToken = null;

async function loginYeastar() {
  try {
    const response = await axios.post(
      `${YEASTAR_HOST}/openapi/v1.0/login`,
      {
        username: YEASTAR_USERNAME,
        password: YEASTAR_PASSWORD,
      }
    );

    yeastarToken = response.data.data.token;

    console.log("Yeastar authenticated");
  } catch (error) {
    console.error("Yeastar login failed:", error.message);
  }
}

async function yeastarRequest(method, endpoint, data = {}) {
  if (!yeastarToken) {
    await loginYeastar();
  }

  return axios({
    method,
    url: `${YEASTAR_HOST}${endpoint}`,
    headers: {
      Authorization: `Bearer ${yeastarToken}`,
      "Content-Type": "application/json",
    },
    data,
  });
}

/*
|--------------------------------------------------------------------------
| INCOMING CALL LOOKUP
|--------------------------------------------------------------------------
|
| Configure a Yeastar webhook to POST caller details here.
|
*/

app.post("/incoming-call", async (req, res) => {
  try {
    const caller =
      req.body.caller ||
      req.body.callerid ||
      req.body.number ||
      "";

    console.log("Incoming call from:", caller);

    const patient = await findPatientByPhone(caller);

    if (!patient) {
      return res.json({
        found: false,
        caller,
      });
    }

    return res.json({
      found: true,
      caller,
      patient: {
        uid: patient.uid,
        name: patient.fullName,
        phone: patient.phoneNumber,
        email: patient.emailAddress,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Lookup failed",
    });
  }
});

/*
|--------------------------------------------------------------------------
| CONTACT CREATION IN YEASTAR
|--------------------------------------------------------------------------
*/

async function createOrUpdateYeastarContact(patient) {
  try {
    await yeastarRequest(
      "POST",
      `/openapi/v1.0/phonebooks/${YEASTAR_PHONEBOOK_ID}/contacts`,
      {
        name: patient.fullName,
        officeNumber: patient.phoneNumber,
        mobileNumber: patient.secondaryPhoneNumber || "",
        email: patient.emailAddress || "",
        externalId: patient.uid,
      }
    );

    console.log(`Synced ${patient.fullName}`);
  } catch (error) {
    console.error(
      `Failed syncing ${patient.fullName}`,
      error.response?.data || error.message
    );
  }
}

/*
|--------------------------------------------------------------------------
| FULL CONTACT SYNC
|--------------------------------------------------------------------------
*/

async function syncHearlinkContacts() {
  try {
    console.log("Starting HearLink sync");

    const response = await hearlink.get("/patients");

    const patients = response.data.data || [];

    for (const patient of patients) {
      await createOrUpdateYeastarContact(patient);
    }

    console.log(`Completed sync for ${patients.length} contacts`);
  } catch (error) {
    console.error("Contact sync failed:", error.message);
  }
}

/*
|--------------------------------------------------------------------------
| HEARLINK WEBHOOKS
|--------------------------------------------------------------------------
|
| Configure HearLink webhooks:
| patient.created
| patient.updated
|
*/

app.post("/webhooks/hearlink", async (req, res) => {
  try {
    const event = req.body.type;
    const patient = req.body.data;

    console.log("Webhook received:", event);

    if (
      event === "patient.created" ||
      event === "patient.updated"
    ) {
      await createOrUpdateYeastarContact(patient);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});

/*
|--------------------------------------------------------------------------
| MANUAL SYNC
|--------------------------------------------------------------------------
*/

app.post("/sync", async (req, res) => {
  await syncHearlinkContacts();

  res.json({
    success: true,
  });
});

/*
|--------------------------------------------------------------------------
| HEALTHCHECK
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  res.send("HearLink ↔ Yeastar Integration Running");
});

/*
|--------------------------------------------------------------------------
| SCHEDULED SYNC
|--------------------------------------------------------------------------
|
| Every hour
|
*/

cron.schedule("0 * * * *", async () => {
  await syncHearlinkContacts();
});

/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

app.listen(PORT, async () => {
  console.log(`Listening on ${PORT}`);

  await loginYeastar();
});
