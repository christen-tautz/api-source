process.chdir(`${process.cwd()}/src`);

import express from 'express';
import morgan from 'morgan';

import { MongoClient } from 'mongodb';

import { FileHandling } from "./workers/file.mjs";
import { Uploader } from "./workers/expressUpload.cjs";

const configCache = await JSON.parse(FileHandling.Read("./config.json"));
const client = new MongoClient(configCache.database.uri, { useNewUrlParser: true, useUnifiedTopology: true });
const api = express();

function pre(api) {
    Uploader(api);
} pre(api);

api.use(morgan('dev'));

async function main() {
    api.listen(configCache.api.port, () => {
        console.log(`Server running on port ${configCache.api.port}`);
    });

    api.get('/v1/media/neko', async (req, res, next) => {
        dbGET("neko", res, req);
    });

    api.get('/v1/media', async (req, res, next) => {
        client.connect(async function (err) {
            let db = client.db(configCache.database.name);
            let endpoints = []

            await db.collection("links").find({ name: { $exists: true } }).toArray(function (err, docs) {
                try {
                    docs.forEach(function (doc) {
                        endpoints.push(doc.name);
                    });
                    res.status(200);
                    res.json({ "available_endpoints": endpoints });
                } finally {
                    client.close();
                };
            });
        });
    });

    api.get('/v2/media/*', async (req, res, next) => {
        dbGET(req.url.split("/").pop(), res, req);
    });

    api.post('/v2/media/*', async (req, res, next) => {
        dbPOST(req.url.split("/").pop(), res, req);
    });

    api.get('/v2/media', async (req, res, next) => {
        client.connect(async function (err) {
            let db = client.db(configCache.database.name);
            let endpoints = []

            await db.collection("links").find({ name: { $exists: true } }).toArray(function (err, docs) {
                try {
                    docs.forEach(function (doc) {
                        endpoints.push(doc.name);
                    });
                    res.status(200);
                    res.json({ "available_endpoints": endpoints });
                } finally {
                    client.close();
                };
            });
        });
    });
};
main();

async function dbPOST(name, res, req) {

    let sentToken = req.headers["x-access-token"] || req.headers["authorization"];

    if (!sentToken) return ERR(res, 401, "Access denied. No token provided.");
    if (sentToken != configCache.api.token) {
        ERR(res, 403, "Invalid token.");
    } else {
        client.connect(async function (err) {

            if (err) {
                console.log(err);
                ERR(res, 500, "Something went wrong!");
                return;
            };

            if (!req.files) {
                ERR(res, 400, "No file uploaded.");
                return;
            };

            let db = client.db(configCache.database.name);

            await db.collection("links").findOne({ name: name }).then(async docs => {

                if (docs == undefined) {
                    await db.collection("links").insertOne({ name: name, links: [] });
                    docs = await db.collection("links").findOne({ name: name })
                };

                let upImage = req.files.image;
                let fileExt = upImage.name.split(".").slice(-1);
                let fileName = docs.links.length + 1;
                docs.links.push(`https://cdn.${configCache.api.url}/media/${name}/${fileName}.${fileExt}`);
                upImage.mv(`../cdn/media/${name}/${fileName}.${fileExt}`);

                await db.collection("links").updateOne({ name: name }, { $set: docs });

                res.status(200);
                res.json({ "msg": "Successfully uploaded.", "link": `https://cdn.${configCache.api.url}/media/${name}/${fileName}.${fileExt}` });
            });

        });
    };
};

async function dbGET(name, res, req) {
    client.connect(async function (err) {

        if (err) {
            console.log(err);
            ERR(res, 500, "Something went wrong!");
            return;
        };

        let db = client.db(configCache.database.name);

        await db.collection("links").findOne({ name: name }).then(docs => {

            if (docs == undefined) {
                ERR(res, 404, "Not Found.");
            } else {
                res.status(200);
                res.json({ "image": docs.links[Math.floor(Math.random() * (docs.links.length - 0) + 0)] });
            };
        });

        client.close();
    });
};

async function ERR(res, status, message) {
    res.status(status).send({
        code: status,
        message: message
    })
};