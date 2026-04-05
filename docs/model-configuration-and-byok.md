# Model configuration, platform models, and BYOK

This guide describes how AI model selection works in this repository **as implemented today**: where to change settings, what “platform” vs “BYOK” means, and what is **not** available yet (custom OpenAI-compatible providers).

---

## Quick reference

| Goal | Supported today? | Where / how |
|------|------------------|-------------|
| Use **platform** models (Workers AI, hosted quota) | Yes | Settings → **AI Model Configurations**, or per-operation **Configure** in the app; pick **primary** and **fallback** models. |
| Use **your own API keys** (BYOK) for known providers | Partially | Keys are stored in the **encrypted vault**. UI to manage them from the model dialog is limited (see [BYOK API keys](#byok-api-keys-bring-your-own-key)). |
| Register a **custom provider** (your own `baseUrl` + API key) | **No** | Server returns **503** for create/update on user providers API; no supported end-user flow. |
| Create **LANDiBUILD API keys** (SDK / automation) | Yes | Settings → **API Keys** (not the same as OpenAI/Anthropic keys). |

---

## Concepts

### Platform models

Models served **through the product** with **platform quota**. You do **not** supply a provider API key for these. The UI explains that usage may be limited; primary and fallback let you define failover behavior.

### BYOK (Bring Your Own Key)

Your keys for **specific providers** supported by BYOK **templates** (loaded from the API, e.g. OpenAI, Anthropic, Google AI Studio, Cerebras). Keys are **encrypted** in the user **vault** (Durable Object–backed secrets store), not stored as plain text in the UI.

BYOK is **not** the same as “type any OpenAI-compatible base URL.” That second capability is the **custom provider** feature, which is **disabled** in the worker (see below).

### Custom provider (OpenAI-compatible endpoint)

A registered **name + base URL + API key** for an arbitrary compatible API. The backend has controller code and D1 service support, but **mutating** operations are intentionally turned off:

- Creating/updating/deleting custom providers responds with **503** and a message to use BYOK in vault settings.

So you **cannot** complete this flow in the UI or via a supported API call until product re-enables it (typically after SSRF and security review).

### LANDiBUILD API keys (Settings → API Keys)

These authenticate **your apps** to **LANDiBUILD** (SDK usage). They are **not** OpenAI/Anthropic/Google provider keys. The Settings copy that points to “API Keys & Secrets” for provider keys is **misaligned** with the current layout: the **SecretsManager** vault UI is **commented out** in Settings, so provider keys are not managed from that card today.

---

## Where to configure models

### 1. Settings → AI Model Configurations

Path: **Settings** (`/settings`), section **AI Model Configurations**.

- Uses **`ModelConfigTabs`** and opens **`ConfigModal`** per agent operation (code generation, screenshot analysis, debugger, etc.).
- You can set **primary model**, **fallback model**, **temperature**, **reasoning effort**, save, reset to defaults, and test where wired.
- **Configuration status** shows **Custom** vs **Default** depending on whether you overrode the system default.

### 2. In-context “Configure …” dialogs

Some flows open the same **`ConfigModal`** from the product surface you are using (e.g. configuring **Screenshot Analysis**). Behavior matches Settings: platform model pickers, recommendations (e.g. vision-capable models for screenshot analysis), and the same BYOK limitations.

---

## BYOK API keys (Bring Your Own Key)

### Vault lifecycle

1. **Not set up** — First time you try to save a BYOK key, the app can prompt you to run the **Vault Setup Wizard** (password or passkey path).
2. **Locked** — You must **unlock** the vault before secrets can be listed or added.
3. **Unlocked** — You can add and remove BYOK-backed secrets.

Implementation reference: `src/components/byok-api-keys-modal.tsx`, `src/contexts/vault-context.tsx`, `src/components/vault/VaultSetupWizard.tsx`, `src/components/vault/VaultUnlockModal.tsx`.

### Opening the BYOK keys modal

The modal is **`ByokApiKeysModal`**. It is mounted from **`ConfigModal`** (`src/components/config-modal.tsx`).

- The header action labeled **Coming Soon** (key icon) is **`disabled`** in code with an explicit security comment. You **cannot** rely on that button to open key management today.
- If the UI shows **“API key needed for …”** with **Setup now**, that link **does** call the same open handler and can open **`ByokApiKeysModal`** so you can set up the vault and add a key.

If you never see that banner (e.g. you only use platform models), you may have **no in-app path** to the BYOK modal until the product re-enables the header button or restores a Settings vault section.

### Adding a key (when the modal is open)

1. Open **Add** tab.
2. Wait for **BYOK templates** to load (`GET` BYOK templates via `apiClient.getBYOKTemplates()`).
3. Select a **provider**; paste a key that passes the template’s **validation** regex.
4. If the vault is not set up or locked, follow **Setup** or **Unlock**.
5. Save; the key is stored with **metadata** (`provider`, `envVarName`) so inference can resolve BYOK for that provider.

### Managing existing keys

Use the **Manage** tab after unlock to list BYOK secrets (filtered by provider metadata) and delete if needed.

---

## Custom provider (when it exists)

**Current status:** Not configurable for end users.

- API surface (for reference): `GET /api/user/providers` may list data; **POST/PATCH/DELETE** and similar flows return **503** from `ModelProvidersController` with guidance to use BYOK.
- Do not expect OpenRouter-as-custom-base-URL or self-hosted vLLM registration through the UI until this is re-enabled and documented in release notes.

---

## Inference behavior (why your key might not “stick”)

The product merges **build-time defaults**, **D1 user overrides**, and **vault BYOK** in the worker. Known sharp edges (for debugging, not end-user steps):

- Some **recursive inference** paths have been reviewed for **dropping `runtimeOverrides`** (BYOK/merged config) on follow-up hops; if behavior looks inconsistent across turns, treat it as a product bug to fix in `worker/agents/inferutils/`, not as user misconfiguration.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| **Coming Soon** on the key button | Expected: button is disabled by design. Use **Setup now** if visible, or wait for a product change to expose vault/BYOK elsewhere. |
| Settings says provider keys are under “API Keys & Secrets” but you only see **LANDiBUILD API keys** | **SecretsManager** is commented out in `src/routes/settings/index.tsx`; provider vault UI is not on that page today. |
| Custom OpenAI URL returns error / nothing to click | Custom providers are **503** on write operations; use platform models or BYOK templates only. |
| “Unlock vault” / agent says vault required | Chat and vault contexts can request unlock (`vault_required` WebSocket message handling). Complete unlock in **`VaultUnlockModal`**. |

---

## For maintainers (re-enabling BYOK entry points)

If product and security sign off:

1. **`src/components/config-modal.tsx`** — Remove **`disabled`** from the **Coming Soon** button (and resolve the security note) so `openByokModal()` is reachable from every configure dialog.
2. **`src/routes/settings/index.tsx`** — Consider uncommenting **`SecretsManager`** so Settings matches the copy for provider keys and vault management.

Re-enabling **`ModelProvidersController`** create/update/delete requires **SSRF-safe** outbound policy (e.g. `testProvider` and user `baseUrl`), not only UI work.

---

## Related code (map)

| Area | Path |
|------|------|
| Model configure dialog | `src/components/config-modal.tsx` |
| Settings model tabs | `src/components/model-config-tabs.tsx` |
| BYOK modal | `src/components/byok-api-keys-modal.tsx` |
| Vault state / crypto | `src/contexts/vault-context.tsx`, `src/lib/vault-crypto.ts` |
| Default agent model config | `worker/agents/inferutils/config.ts` |
| User providers API (503 on write) | `worker/api/controllers/modelProviders/controller.ts` |
| BYOK templates / model list API | `src/lib/api-client.ts` (`getBYOKTemplates`, `getByokProviders`) |

---

*Last aligned to repository behavior as of the guide authoring date; re-check worker responses and Settings layout after upgrades.*
