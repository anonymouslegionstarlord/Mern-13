import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT || 4300);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5175' }));
app.use(express.json({ limit: '24kb' }));

const turnSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 16,
      match: [/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Use letters, numbers, and single hyphens'],
    },
    zone: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    attendantAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    priority: { type: String, required: true, enum: ['standard', 'early-arrival', 'vip'], default: 'standard' },
    status: {
      type: String, required: true, enum: ['dirty', 'cleaning', 'inspection', 'ready', 'blocked'], default: 'dirty',
    },
    checkoutTime: { type: Date, required: true },
    targetReadyTime: { type: Date, required: true },
    readyAt: { type: Date, default: null },
    notes: { type: String, required: true, trim: true, minlength: 4, maxlength: 280 },
  },
  { timestamps: true, versionKey: false }
);

turnSchema.pre('validate', function validateTime(next) {
  if (this.checkoutTime && this.targetReadyTime && this.checkoutTime > this.targetReadyTime) {
    this.invalidate('targetReadyTime', 'Target-ready time must be after checkout');
  }
  if (this.isModified('status')) {
    this.readyAt = this.status === 'ready' ? this.readyAt || new Date() : null;
  }
  next();
});

const Turn = mongoose.model('Turn', turnSchema);
const writable = new Set(['roomCode', 'zone', 'attendantAlias', 'priority', 'status', 'checkoutTime', 'targetReadyTime', 'notes']);
const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const present = (turn) => {
  const item = turn.toObject ? turn.toObject() : turn;
  const overdue = item.status !== 'ready' && new Date(item.targetReadyTime) < new Date();
  const turnaroundMinutes = item.readyAt ? Math.max(0, Math.round((new Date(item.readyAt) - new Date(item.checkoutTime)) / 60000)) : null;
  return { ...item, overdue, turnaroundMinutes };
};

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'turn-ready' }));

app.get('/api/turns', asyncRoute(async (request, response) => {
  const filter = {};
  for (const key of ['status', 'priority']) {
    const value = String(request.query[key] || '');
    if (value) filter[key] = value;
  }
  const zone = String(request.query.zone || '').trim().slice(0, 40);
  if (zone) filter.zone = new RegExp(`^${escapeRegex(zone)}$`, 'i');
  const search = String(request.query.search || '').trim().slice(0, 80);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ roomCode: pattern }, { zone: pattern }, { attendantAlias: pattern }];
  }
  const turns = await Turn.find(filter).sort({ targetReadyTime: 1, roomCode: 1 }).limit(100).lean();
  response.json(turns.map(present));
}));

app.get('/api/turns/metrics', asyncRoute(async (_request, response) => {
  const now = new Date();
  const [total, ready, active, blocked, overdue, timing] = await Promise.all([
    Turn.countDocuments(), Turn.countDocuments({ status: 'ready' }),
    Turn.countDocuments({ status: { $in: ['cleaning', 'inspection'] } }),
    Turn.countDocuments({ status: 'blocked' }),
    Turn.countDocuments({ status: { $ne: 'ready' }, targetReadyTime: { $lt: now } }),
    Turn.aggregate([
      { $match: { readyAt: { $ne: null } } },
      { $group: { _id: null, averageMs: { $avg: { $subtract: ['$readyAt', '$checkoutTime'] } } } },
    ]),
  ]);
  const averageTurnMinutes = timing[0] ? Math.max(0, Math.round(timing[0].averageMs / 60000)) : 0;
  response.json({ total, ready, active, blocked, overdue, averageTurnMinutes });
}));

app.post('/api/turns', asyncRoute(async (request, response) => {
  const turn = await Turn.create(request.body);
  response.status(201).json(present(turn));
}));

app.patch('/api/turns/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Invalid room-turn id' });
  const updates = Object.entries(request.body).filter(([key]) => writable.has(key));
  if (!updates.length) return response.status(400).json({ error: 'Provide a supported field' });
  const turn = await Turn.findById(request.params.id);
  if (!turn) return response.status(404).json({ error: 'Room turn not found' });
  updates.forEach(([key, value]) => { turn[key] = value; });
  await turn.save();
  return response.json(present(turn));
}));

app.delete('/api/turns/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Invalid room-turn id' });
  const turn = await Turn.findByIdAndDelete(request.params.id);
  return turn ? response.status(204).end() : response.status(404).json({ error: 'Room turn not found' });
}));

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
  if (error.code === 11000) return response.status(409).json({ error: 'Room code already exists' });
  if (error.name === 'ValidationError') {
    return response.status(400).json({ error: 'Validation failed', details: Object.values(error.errors).map((item) => item.message) });
  }
  console.error(error);
  return response.status(500).json({ error: 'Unexpected server error' });
});

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is required. Copy .env.example to .env.');
  process.exit(1);
}
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => app.listen(port, () => console.log(`TurnReady API listening on ${port}`)))
  .catch((error) => {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  });
