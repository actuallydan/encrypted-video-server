import express from "express";

import {
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { createCipheriv, createDecipheriv } from "crypto";

import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const key = Buffer.from(process.env.key); // ... replace with your key
const iv = Buffer.from(process.env.iv); // ... replace with your initialization vector
const metadataFilePath = "./metadata.json";

const app = express();

app.get("/upload", (req, res) => {
  res.sendFile(__dirname + "/public/upload.html");
});

app.post("/upload", upload.single("file"), (req, res) => {
  const { file } = req;

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encryptedBuffer = Buffer.concat([
    cipher.update(file.buffer),
    cipher.final(),
  ]);

  // Save the encrypted content to a file
  const encryptedFileName = `${file.originalname.split(".")[0]}-enc.mp4`;
  const encryptedFilePath = `./uploads/${encryptedFileName}`;

  const writeStream = createWriteStream(encryptedFilePath);
  writeStream.write(encryptedBuffer);
  writeStream.end();

  // Save metadata (filename and pre-encrypted content length) to a JSON file
  const metadata = {
    filename: encryptedFileName,
    preEncryptedContentLength: file.size,
  };

  let metadataJSON = {};

  //check if metadata file exists
  if (existsSync(metadataFilePath)) {
    metadataJSON = JSON.parse(readFileSync(metadataFilePath, "utf-8"));
  } else {
    writeFileSync(metadataFilePath, JSON.stringify(metadataJSON));
  }

  metadataJSON[encodeURI(encryptedFileName)] = metadata;

  writeFileSync(metadataFilePath, JSON.stringify(metadataJSON));

  res.status(200).send("File uploaded and encrypted successfully!");
});

app.get("/video/:videoName", (req, res) => {

  const videoName = req.params.videoName;

  // Path to the encrypted file
  const file = `${videoName}-enc.mp4`;
  const filePath = `./uploads/${file}`;

    // get the length by reading the metadata file
    const metadata = JSON.parse(readFileSync(metadataFilePath, "utf-8"));
    const { preEncryptedContentLength: length } = metadata[encodeURI(file)]

  // Create a read stream for the encrypted file
  const readStream = createReadStream(filePath);

  // Create a decipher object with the specified algorithm, key, and IV
  const decipher = createDecipheriv("aes-256-cbc", key, iv);

  // Pipe the encrypted file stream through the decipher stream
  const decryptedStream = readStream.pipe(decipher);

  // Set the appropriate headers for the response
  res.setHeader("Content-Disposition", `inline; filename=${file}`);
  res.setHeader("Content-Type", "video/mp4");

  res.setHeader("Content-Length", length);
  res.setHeader("Accept-Ranges", "bytes");

  // Pipe the decrypted stream to the response
  decryptedStream.pipe(res);
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
