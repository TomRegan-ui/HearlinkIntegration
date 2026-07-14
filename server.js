require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("HearLink -> Yeastar Integration Running");
});

app.post("/hearlink-webhook", async (req, res) => {

    console.log("Webhook received:", req.body);

    try {

        const patient = req.body.data;

        await axios.post(
            `${process.env.YEASTAR_URL}/api`,
            {
                action: "extension_query"
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.YEASTAR_TOKEN}`
                }
            }
        );

        res.status(200).send("OK");

    } catch (err) {

        console.error(err.response?.data || err.message);

        res.status(500).send("Failed");
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});
