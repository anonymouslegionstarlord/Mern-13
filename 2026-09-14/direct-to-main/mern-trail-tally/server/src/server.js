import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT || 4400);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5176' }));
app.use(express.json({ limit: '24kb' }));

const trailSchema = new mongoose.Schema(
  {
    trailCode: {
      type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20,
      match: [/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Use letters, numbers, and single hyphens'],
    },
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    region: { type: String, required: true, trim: true, minlength: 2, maxlength: 70 },
    inspectorAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    distanceKm: { type: Number, required: true, min: 0.1, max: 500 },
    difficulty: { type: String, required: true, enum: ['easy', 'moderate', 'hard', 'expert'] },
    surface: { type: String, required: true, enum: ['paved', 'gravel', 'earth', 'rock', 'mixed'] },
    status: { type: String, required: true, enum: ['open', 'caution', 'maintenance', 'closed'], default: 'open' },
    inspectedOn: { type: Date, required: true },
    reviewBy: { type: Date, required: true },
    conditionNote: { type: String, required: true, trim: true, minlength: 8, maxlength: 320 },
  },
  { timestamps: true, versionKey: false }
);

trailSchema.pre('validate', function validateDates(next) {
  if (this.inspectedOn && this.reviewBy && this.inspectedOn > this.reviewBy) {
    this.invalidate('reviewBy', 'Review date must be on or after inspection date');
  }
  next();
});

const Trail = mongoose.model('Trail', trailSchema);
const writable = new Set([
  'trailCode', 'name', 'region', 'inspectorAlias', 'distanceKm', 'difficulty',
  'surface', 'status', 'inspectedOn', 'reviewBy', 'conditionNote',
]);
const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const present = (trail) => {
  const item = trail.toObject ? trail.toObject() : trail;
  return { ...item, reviewOverdue: item.status !== 'closed' && new Date(item.reviewBy) < new Date() };
};

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'trail-tally' }));

app.get('/api/trails', asyncRoute(async (request, response) => {
  const filter = {};
  for (const key of ['status', 'difficulty', 'surface']) {
    const value = String(request.query[key] || '');
    if (value) filter[key] = value;
  }
  const search = String(request.query.search || '').trim().slice(0, 80);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { trailCode: pattern }, { region: pattern }, { inspectorAlias: pattern }];
  }
  const trails = await Trail.find(filter).sort({ reviewBy: 1, name: 1 }).limit(100).lean();
  response.json(trails.map(present));
}));

app.get('/api/trails/metrics', asyncRoute(async (_request, response) => {
  const [total, caution, unavailable, overdue, distance] = await Promise.all([
    Trail.countDocuments(), Trail.countDocuments({ status: 'caution' }),
    Trail.countDocuments({ status: { $in: ['maintenance', 'closed'] } }),
    Trail.countDocuments({ status: { $ne: 'closed' }, reviewBy: { $lt: new Date() } }),
    Trail.aggregate([{ $group: { _id: null, kilometres: { $sum: '$distanceKm' } } }]),
  ]);
  response.json({ total, caution, unavailable, overdue, kilometres: Number((distance[0]?.kilometres || 0).toFixed(1)) });
}));

app.post('/api/trails', asyncRoute(async (request, response) => {
  const trail = await Trail.create(request.body);
  response.status(201).json(present(trail));
}));

app.patch('/api/trails/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Invalid trail id' });
  const updates = Object.entries(request.body).filter(([key]) => writable.has(key));
  if (!updates.length) return response.status(400).json({ error: 'Provide a supported field' });
  const trail = await Trail.findById(request.params.id);
  if (!trail) return response.status(404).json({ error: 'Trail not found' });
  updates.forEach(([key, value]) => { trail[key] = value; });
  await trail.save();
  return response.json(present(trail));
}));

app.delete('/api/trails/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Invalid trail id' });
  const trail = await Trail.findByIdAndDelete(request.params.id);
  return trail ? response.status(204).end() : response.status(404).json({ error: 'Trail not found' });
}));

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
  if (error.code === 11000) return response.status(409).json({ error: 'Trail code already exists' });
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
  .then(() => app.listen(port, () => console.log(`TrailTally API listening on ${port}`)))
  .catch((error) => {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  });
