const https = require('https');
const express = require('express');
const { asyncHandler } = require('../../middlewares/asyncHandler');
const { requireAuth } = require('../../middlewares/auth');

const router = express.Router();

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

router.get('/autocomplete', requireAuth, asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ suggestions: [] });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=address&key=${key}`;

  const data = await httpsGet(url);

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('Places autocomplete error:', data.status, data.error_message);
    return res.status(502).json({ error: 'Places API error.', detail: data.status });
  }

  const suggestions = (data.predictions || []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
  }));

  res.json({ suggestions });
}));

router.get('/details', requireAuth, asyncHandler(async (req, res) => {
  const { placeId } = req.query;
  if (!placeId) {
    return res.status(400).json({ error: 'placeId is required.' });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=formatted_address,geometry&key=${key}`;

  const data = await httpsGet(url);

  if (data.status !== 'OK') {
    return res.status(502).json({ error: 'Places API error.' });
  }

  const { result } = data;
  res.json({
    address: result.formatted_address,
    latitude: result.geometry.location.lat,
    longitude: result.geometry.location.lng,
  });
}));

module.exports = router;
