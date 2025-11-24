// routes/adminAnalytics.js
const express = require('express');
const {BetaAnalyticsDataClient} = require('@google-analytics/data');
const router = express.Router();

// Requiere GOOGLE_APPLICATION_CREDENTIALS apuntando al JSON del service account
// y la variable env GA4_PROPERTY_ID = '11490453701'
const propertyId = process.env.GA4_PROPERTY_ID || '11490453701';
const client = new BetaAnalyticsDataClient();

async function runReport() {
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{startDate: '7daysAgo', endDate: 'today'}],
    dimensions: [{name: 'date'}],
    metrics: [{name: 'sessions'}, {name: 'activeUsers'}, {name: 'screenPageViews'}],
  });
  return response;
}

router.get('/admin/analytics', async (req, res) => {
  try {
    // 1) request: últimos 7 días
    const report = await runReport();

    // Parsear el reporte: rows -> date + metrics
    const rows = report.rows || [];
    const series = rows.map(r => {
      const date = r.dimensionValues?.[0]?.value || '';
      const sessions = r.metricValues?.[0]?.value || '0';
      return { label: date, value: Number(sessions) };
    });

    // 2) metrics agregadas (suma)
    const sessions = series.reduce((s, it) => s + (it.value || 0), 0);
    const users = (report.rows && report.rows.length) ? Number(report.totals?.[0]?.values?.[1] || 0) : 0;
    // fallback: request realtime for active users if desired (requires separate API)
    const pageviews = report.rows ? series.reduce((acc, r) => acc + (r.value || 0), 0) : 0;

    // Ejemplo simple de respuesta
    res.json({
      users: users,
      sessions: sessions,
      pageviews: pageviews,
      realtimeActiveUsers: 0,
      series
    });
  } catch (err) {
    console.error('GA endpoint error', err);
    res.status(500).json({ error: err.message || 'GA error' });
  }
});

module.exports = router;