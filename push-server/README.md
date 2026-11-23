# Shred Coach push server

Cloudflare Worker that sends the rest-over notification. Deploy by importing this repo in Cloudflare (Workers & Pages > Create > Import a repository) with **Root directory** set to `push-server`. No secrets needed: the notification keys are created on first use.
