import { getPublicAuthConfig } from "../src/public-config.js";

export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(getPublicAuthConfig());
}
