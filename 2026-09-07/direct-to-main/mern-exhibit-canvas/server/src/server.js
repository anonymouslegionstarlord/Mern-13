import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT || 4100);

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '32kb' }));

const exhibitionSchema = new mongoose.Schema(
  {
    exhibitCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 24,
      match: [/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, 'Use letters, numbers, and single hyphens'],
    },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    galleryZone: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    curatorAlias: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    medium: {
      type: String,
      required: true,
      enum: ['painting', 'sculpture', 'photography', 'digital', 'mixed', 'other'],
    },
    status: {
      type: String,
      required: true,
      enum: ['planned', 'installing', 'open', 'closed'],
      default: 'planned',
    },
    itemCount: { type: Number, required: true, min: 1, max: 10000 },
    installationDate: { type: Date, required: true },
    openingDate: { type: Date, required: true },
    closingDate: { type: Date, required: true },
    accessibilityNotes: { type: String, required: true, trim: true, minlength: 5, maxlength: 300 },
  },
  { timestamps: true, versionKey: false }
);

exhibitionSchema.pre('validate', function validateDates(next) {
  const datesExist = this.installationDate && this.openingDate && this.closingDate;
  if (datesExist && (this.installationDate > this.openingDate || this.openingDate > this.closingDate)) {
    this.invalidate('openingDate', 'Dates must be ordered installation, opening, then closing');
  }
  next();
});

const Exhibition = mongoose.model('Exhibition', exhibitionSchema);
const editable = new Set([
  'exhibitCode', 'title', 'galleryZone', 'curatorAlias', 'medium', 'status', 'itemCount',
  'installationDate', 'openingDate', 'closingDate', 'accessibilityNotes',
]);
const asyncRoute = (handler) => (request, response, next) => {
  Promise.resolve(handler(request, response, next)).catch(next);
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

app.get('/api/health', (_request, response) => response.json({ status: 'ok', service: 'exhibit-canvas' }));

app.get('/api/exhibits', asyncRoute(async (request, response) => {
  const filter = {};
  const status = String(request.query.status || '');
  const medium = String(request.query.medium || '');
  const search = String(request.query.search || '').trim().slice(0, 80);
  if (status) filter.status = status;
  if (medium) filter.medium = medium;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { title: pattern }, { exhibitCode: pattern }, { galleryZone: pattern }, { curatorAlias: pattern },
    ];
  }
  const exhibits = await Exhibition.find(filter).sort({ openingDate: 1, title: 1 }).limit(100).lean();
  response.json(exhibits);
}));

app.get('/api/exhibits/metrics', asyncRoute(async (_request, response) => {
  const now = new Date();
  const [total, open, installing, upcoming, totals] = await Promise.all([
    Exhibition.countDocuments(),
    Exhibition.countDocuments({ status: 'open' }),
    Exhibition.countDocuments({ status: 'installing' }),
    Exhibition.countDocuments({ openingDate: { $gt: now }, status: { $ne: 'closed' } }),
    Exhibition.aggregate([{ $group: { _id: null, items: { $sum: '$itemCount' } } }]),
  ]);
  response.json({ total, open, installing, upcoming, items: totals[0]?.items || 0 });
}));

app.post('/api/exhibits', asyncRoute(async (request, response) => {
  const exhibit = await Exhibition.create(request.body);
  response.status(201).json(exhibit);
}));

app.patch('/api/exhibits/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid exhibition id' });
  }
  const updates = Object.entries(request.body).filter(([key]) => editable.has(key));
  if (!updates.length) return response.status(400).json({ error: 'Provide a supported field' });
  const exhibit = await Exhibition.findById(request.params.id);
  if (!exhibit) return response.status(404).json({ error: 'Exhibition not found' });
  updates.forEach(([key, value]) => { exhibit[key] = value; });
  await exhibit.save();
  return response.json(exhibit);
}));

app.delete('/api/exhibits/:id', asyncRoute(async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid exhibition id' });
  }
  const exhibit = await Exhibition.findByIdAndDelete(request.params.id);
  return exhibit ? response.status(204).end() : response.status(404).json({ error: 'Exhibition not found' });
}));

app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error, _request, response, _next) => {
  if (error.code === 11000) return response.status(409).json({ error: 'Exhibit code already exists' });
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
  .then(() => app.listen(port, () => console.log(`ExhibitCanvas API listening on ${port}`)))
  .catch((error) => {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  });
