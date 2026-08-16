# Getting TLS in front of the deployment

**Why this matters (FIXES-01 §3 note):** the app is currently served over
plain `http://e6l15q30xqqatx3iin2wtya9.147.93.105.212.sslip.io/` and:

- Every session cookie, every client detail, every price travels
  unencrypted between the browser and the Coolify host.
- **The browser blocks the Geolocation API on plain HTTP.** Site-visit
  check-in silently fails — the reviewer's "site visit capture is not
  working" (§9) is almost certainly this, not a code bug.
- Fifteen-minute fix. No reason to ship without it.

Pick ONE of the three paths below. All three end at the same place:
`https://<your-domain>` serving what the sslip URL currently serves.

---

## Option A — Cloudflare (recommended for speed, free)

Best if you already own a domain and have (or can create) a free
Cloudflare account. TLS in ~5 minutes. Cloudflare's cert auto-renews,
and their proxy DDoS-shields the origin as a bonus.

1. **Add your domain to Cloudflare.** Dashboard → Add site →
   follow the nameserver-swap wizard at your registrar.
2. **Create an A record**:
   - Name: `app` (or whatever subdomain you want — `mandovara.digitalvetri.com`, `app.mandovara.com`, etc.)
   - IPv4 address: `147.93.105.212`
   - Proxy status: **Proxied (orange cloud)** — this is what gives you TLS.
3. **SSL/TLS mode** → Overview → set to **Full**.
   - `Full` (not `Full (strict)`) because the origin uses a self-signed
     or no cert. Full gets the browser HTTPS while accepting the
     unencrypted origin. Fine for now — upgrade to `Full (strict)` once
     the origin has a real cert (Option B or C).
4. **Wait ~2 minutes** for Cloudflare to issue the edge cert (Universal
   SSL). Visit `https://app.your-domain.com` — should serve the app.
5. **In Coolify** → mandovara-app → Environment Variables:
   - Set `NEXT_PUBLIC_APP_URL=https://app.your-domain.com`
   - Redeploy the app so Next.js knows its real URL.

---

## Option B — Coolify's built-in Let's Encrypt (recommended if you own the domain)

If you have a domain and you're OK pointing it at Coolify directly
(no Cloudflare in front), Coolify has native Let's Encrypt support.

1. **DNS**: create an A record `app.your-domain.com → 147.93.105.212`.
   Wait for propagation (`dig app.your-domain.com +short` should
   return your VPS IP).
2. **In Coolify** → mandovara-app → **Domains** tab (or Settings →
   Domains, depending on your version):
   - Add `app.your-domain.com`.
   - Toggle "Enable HTTPS" (Coolify handles the ACME cert dance).
3. **Wait ~30 seconds** for Coolify + Let's Encrypt handshake.
   Coolify shows a green ✓ when the cert issues.
4. Update `NEXT_PUBLIC_APP_URL` to the https URL and redeploy.

---

## Option C — Caddy on the Coolify host (no domain change, cert-only)

Use this if you want TLS at the *sslip URL itself* without moving to
a real domain. Caddy talks Let's Encrypt for you, no config beyond
one Caddyfile.

1. On the Coolify host (SSH as root):

   ```bash
   apt install -y caddy
   ```

2. Write `/etc/caddy/Caddyfile`:

   ```
   e6l15q30xqqatx3iin2wtya9.147.93.105.212.sslip.io {
     reverse_proxy http://127.0.0.1:3000
   }
   ```

3. Reload Caddy:

   ```bash
   systemctl reload caddy
   ```

4. Caddy auto-obtains a cert from Let's Encrypt (sslip.io is a
   proper TLD as far as ACME is concerned). Visit
   `https://e6l15q30xqqatx3iin2wtya9.147.93.105.212.sslip.io/`.

   **Caveat**: this binds Caddy to :443 on the host. If Coolify's
   own proxy also wants :443, you'll conflict — check Coolify's
   proxy status first (`docker ps | grep coolify-proxy`) and turn
   off Coolify's HTTPS if it's on.

---

## After TLS is live — verification checklist

- [ ] `curl -sI https://<your-url>/api/health` returns `HTTP/1.1 200 OK`.
- [ ] Browser address bar shows a padlock, not a "Not Secure" warning.
- [ ] Open the site-visit check-in flow — the browser now prompts
      for geolocation permission (didn't before).
- [ ] `NEXT_PUBLIC_APP_URL` in Coolify env is set to the https URL.
- [ ] Redeploy so Next.js knows its real origin.

---

## While you're at it — HSTS

Once you're confident the https URL works, add HSTS to prevent
protocol downgrade:

- **Cloudflare (Option A)**: SSL/TLS → Edge Certificates → HSTS →
  Enable, max-age 6 months.
- **Coolify Let's Encrypt (Option B)**: Coolify sets HSTS by default.
- **Caddy (Option C)**: Caddy sets `Strict-Transport-Security` by
  default on any TLS-terminated site. Nothing to do.
