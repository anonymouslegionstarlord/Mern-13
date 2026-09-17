import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT || 4700);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5179' }));
app.use(express.json({ limit: '24kb' }));

const finalStatuses = ['passed', 'waived'];
const checkSchema = new mongoose.Schema(
  {
    gateCode: {
      type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24,
      match: [/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Use letters, numbers, and single hyphens'],
    },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    releaseName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    serviceAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 70 },
    ownerAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    checkType: {
      type: String, required: true,
      enum: ['regression', 'security', 'performance', 'accessibility', 'documentation', 'deployment'],
    },
    severity: { type: String, required: true, enum: ['blocker', 'high', 'medium', 'low'] },
    status: {
      type: String, required: true,
      enum: ['not-started', 'running', 'passed', 'failed', 'waived'],
      default: 'not-started',
    },
    targetDate: { type: Date, required: true },
    evidenceUrl: {
      type: String, trim: true, maxlength: 300, default: '',
      validate: {
        validator: (value) => !value || /^https?:\/\/[^\s]+$/i.test(value),
        message: 'Evidence URL must begin with http:// or https://',
      },
    },
    notes: { type: String, required: true, trim: true, minlength: 8, maxlength: 400 },
    waiverReason: { type: String, trim: true, maxlength: 240, default: '' },
  },
  { timestamps: true, versionKey: false }
);

checkSchema.pre('validate', function validateWaiver(next) {
  if (this.status === 'waived' && this.waiverReason.trim().length < 8) {
    this.invalidate('waiverReason', 'Waived checks require a reason of at least 8 characters');
  }
  next();
});

const Check = mongoose.model('ReleaseCheck', checkSchema);
const writable = new Set([
  'gateCode', 'title', 'releaseName', 'serviceAlias', 'ownerAlias', 'checkType',
  'severity', 'status', 'targetDate', 'evidenceUrl', 'notes', 'waiverReason',
]);
const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
const present = (check) => {
  const item = check.toObject ? check.toObject() : check;
  return { ...item, overdue: !finalStatuses.includes(item.status) && new Date(item.targetDate) < new Date() };
};

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'release-gate' }));

app.get('/api/checks', asyncRoute(async (request, response) => {
  const filter = {};
  for (const key of ['status', 'severity', 'checkType']) {
    const value = String(request.query[key] || '');
    if (value) filter[key] = value;
  }
  const search = String(request.query.search || '').trim().slice(0, 80);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { title: pattern }, { gateCode: pattern }, { releaseName: pattern },
      { serviceAlias: pattern }, { ownerAlias: pattern },
    ];
  }
  const checks = await Check.find(filter).sort({ targetDate: 1, severity: 1 }).limit(100).lean();
  response.json(checks.map(present));
}));

app.get('/api/checks/metrics', asyncRoute(async (_request, response) => {
  const [total, blockers, failed, passed, overdue] = await Promise.all([
    Check.countDocuments(),
    Check.countDocuments({ severity: 'blocker', status: { $nin: finalStatuses } }),
    Check.countDocuments({ status: 'failed' }),
    Check.countDocuments({ status: 'passed' }),
    Check.countDocuments({ status: { $nin: finalStatuses }, targetDate: { $lt: new Date() } }),
  ]);
  response.json({ total, blockers, failed, passed, overdue, ready: total > 0 && blockers === 0 && failed === 0 });
}));

app.post('/api/checks', asyncRoute(async (request, response) => {
  const check = await Check.create(request.body);
  response.status(201).json(present(check));
}));

app.patch('/api/checks/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid check id' });
  }
  const updates = Object.entries(request.body).filter(([key]) => writable.has(key));
  if (!updates.length) return response.status(400).json({ error: 'Provide a supported field' });
  const check = await Check.findById(request.params.id);
  if (!check) return response.status(404).json({ error: 'Release check not found' });
  updates.forEach(([key, value]) => { check[key] = value; });
  await check.save();
  return response.json(present(check));
}));

app.delete('/api/checks/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid check id' });
  }
  const check = await Check.findByIdAndDelete(request.params.id);
  return check
    ? response.status(204).end()
    : response.status(404).json({ error: 'Release check not found' });
}));

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
  if (error.code === 11000) return response.status(409).json({ error: 'Gate code already exists' });
  if (error.name === 'ValidationError') {
    return response.status(400).json({
      error: 'Validation failed',
      details: Object.values(error.errors).map((item) => item.message),
    });
  }
  console.error(error);
  return response.status(500).json({ error: 'Unexpected server error' });
});

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required. Copy .env.example to .env.');
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => app.listen(port, () => console.log('ReleaseGate API listening on ' + port)))
  .catch((error) => {
    console.error('MongoDB connection failed: ' + error.message);
    process.exit(1);
  });

