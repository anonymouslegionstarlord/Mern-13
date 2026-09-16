import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT || 4600);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5178' }));
app.use(express.json({ limit: '24kb' }));

const handoffSchema = new mongoose.Schema(
  {
    handoffCode: {
      type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 24,
      match: [/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Use letters, numbers, and single hyphens'],
    },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    teamAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 70 },
    ownerAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    fromShift: { type: String, required: true, enum: ['morning', 'evening', 'night', 'weekend'] },
    priority: { type: String, required: true, enum: ['low', 'medium', 'high', 'critical'] },
    category: { type: String, required: true, enum: ['operations', 'customer', 'technical', 'safety', 'general'] },
    status: { type: String, required: true, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    occurredAt: { type: Date, required: true },
    dueBy: { type: Date, required: true },
    summary: { type: String, required: true, trim: true, minlength: 10, maxlength: 400 },
  },
  { timestamps: true, versionKey: false }
);

handoffSchema.pre('validate', function validateDates(next) {
  if (this.occurredAt && this.dueBy && this.occurredAt > this.dueBy) {
    this.invalidate('dueBy', 'Due time must be on or after the event time');
  }
  next();
});

const Handoff = mongoose.model('Handoff', handoffSchema);
const writable = new Set([
  'handoffCode', 'title', 'teamAlias', 'ownerAlias', 'fromShift', 'priority',
  'category', 'status', 'occurredAt', 'dueBy', 'summary',
]);
const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
const escapeRegex = (value) => value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&');
const present = (handoff) => {
  const item = handoff.toObject ? handoff.toObject() : handoff;
  return { ...item, overdue: item.status !== 'resolved' && new Date(item.dueBy) < new Date() };
};

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'shift-signal' }));

app.get('/api/handoffs', asyncRoute(async (request, response) => {
  const filter = {};
  for (const key of ['status', 'priority', 'category', 'fromShift']) {
    const value = String(request.query[key] || '');
    if (value) filter[key] = value;
  }
  const search = String(request.query.search || '').trim().slice(0, 80);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { title: pattern }, { handoffCode: pattern }, { teamAlias: pattern },
      { ownerAlias: pattern }, { summary: pattern },
    ];
  }
  const handoffs = await Handoff.find(filter).sort({ dueBy: 1, priority: 1 }).limit(100).lean();
  response.json(handoffs.map(present));
}));

app.get('/api/handoffs/metrics', asyncRoute(async (_request, response) => {
  const [total, critical, open, acknowledged, overdue] = await Promise.all([
    Handoff.countDocuments(),
    Handoff.countDocuments({ priority: 'critical', status: { $ne: 'resolved' } }),
    Handoff.countDocuments({ status: 'open' }),
    Handoff.countDocuments({ status: 'acknowledged' }),
    Handoff.countDocuments({ status: { $ne: 'resolved' }, dueBy: { $lt: new Date() } }),
  ]);
  response.json({ total, critical, open, acknowledged, overdue });
}));

app.post('/api/handoffs', asyncRoute(async (request, response) => {
  const handoff = await Handoff.create(request.body);
  response.status(201).json(present(handoff));
}));

app.patch('/api/handoffs/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid handoff id' });
  }
  const updates = Object.entries(request.body).filter(([key]) => writable.has(key));
  if (!updates.length) return response.status(400).json({ error: 'Provide a supported field' });
  const handoff = await Handoff.findById(request.params.id);
  if (!handoff) return response.status(404).json({ error: 'Handoff not found' });
  updates.forEach(([key, value]) => { handoff[key] = value; });
  await handoff.save();
  return response.json(present(handoff));
}));

app.delete('/api/handoffs/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid handoff id' });
  }
  const handoff = await Handoff.findByIdAndDelete(request.params.id);
  return handoff
    ? response.status(204).end()
    : response.status(404).json({ error: 'Handoff not found' });
}));

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
  if (error.code === 11000) return response.status(409).json({ error: 'Handoff code already exists' });
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
  .then(() => app.listen(port, () => console.log('ShiftSignal API listening on ' + port)))
  .catch((error) => {
    console.error('MongoDB connection failed: ' + error.message);
    process.exit(1);
  });
